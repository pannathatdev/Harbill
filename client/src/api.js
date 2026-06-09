export const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001"
const CACHE_TTL = 5 * 60 * 1000
const CACHE_PREFIX = "harbill:api:"

function getToken() {
  return localStorage.getItem("token")
}

function cacheKey(path) {
  return `${CACHE_PREFIX}${getToken() || "guest"}:${path}`
}

function readCache(path) {
  try {
    const raw = localStorage.getItem(cacheKey(path))
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached.savedAt > CACHE_TTL) return null
    return cached.data
  } catch {
    return null
  }
}

function writeCache(path, data) {
  try {
    localStorage.setItem(cacheKey(path), JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

function clearApiCache(paths = null) {
  const prefix = `${CACHE_PREFIX}${getToken() || "guest"}:`
  const matchPaths = Array.isArray(paths) ? paths : null
  Object.keys(localStorage)
    .filter(key => key.startsWith(prefix))
    .filter(key => !matchPaths || matchPaths.some(path => key.startsWith(`${prefix}${path}`)))
    .forEach(key => localStorage.removeItem(key))
}

async function req(path, options = {}) {
  const method = options.method || "GET"
  const skipCache = options.skipCache || options.cache === "no-store"
  const fetchOptions = { ...options }
  delete fetchOptions.skipCache
  const invalidate = fetchOptions.invalidate
  delete fetchOptions.invalidate

  if (method === "GET" && !skipCache) {
    const cached = readCache(path)
    if (cached) return cached
  }

  const res = await fetch(BASE + path, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`,
      ...(options.headers || {})
    }
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`API did not return JSON for ${path}. Make sure the API server is running on ${BASE}.`)
  }

  if (res.status === 401) {
    localStorage.removeItem("token")
    window.location.href = "/login"
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`)
  }

  if (method === "GET" && !skipCache) writeCache(path, data)
  if (method !== "GET") clearApiCache(invalidate)

  return data
}

function post(path, body, options = {}) {
  return req(path, { method: "POST", body: JSON.stringify(body), ...options })
}

function patch(path, body, options = {}) {
  return req(path, { method: "PATCH", body: JSON.stringify(body), ...options })
}

function del(path, options = {}) {
  return req(path, { method: "DELETE", ...options })
}

export const api = {
  // Auth
  register: (email, password, name) => post("/auth/register", { email, password, name }),
  login: (email, password) => post("/auth/login", { email, password }),
  me: () => req("/auth/me"),
  googleStatus: () => req("/auth/google/status"),
  googleLogin: () => { window.location.href = `${BASE}/auth/google` },
  clearCache: clearApiCache,

  // Analytics / Admin
  trackPageView: (data) => fetch(`${BASE}/analytics/page-view`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify(data)
  }).then(r => r.ok).catch(() => false),
  createAdminSession: (password, code) => post("/admin/session", { password, code }),
  getAdminSummary: (adminToken) => req("/admin/summary", {
    skipCache: true,
    headers: { "x-admin-token": adminToken }
  }),
  activateUserPro: (adminToken, userId, days = 30) => post("/admin/pro/activate", { userId, days }, {
    headers: { "x-admin-token": adminToken },
    invalidate: ["/admin/summary"]
  }),

  // Billing
  getProStatus: () => req("/billing/pro-status", { skipCache: true }),
  requestProManual: (reference) => post("/billing/pro/request", { reference }),

  // Friends
  getFriends: () => req("/friends"),
  addFriend: (name) => post("/friends", { name }, { invalidate: ["/friends"] }),
  deleteFriend: (id) => del(`/friends/${id}`, { invalidate: ["/friends"] }),

  // Groups
  getGroups: () => req("/groups"),
  addGroup: (name) => post("/groups", { name }, { invalidate: ["/groups"] }),
  updateGroup: (id, name) => patch(`/groups/${id}`, { name }, { invalidate: ["/groups"] }),
  deleteGroup: (id) => del(`/groups/${id}`, { invalidate: ["/groups"] }),
  addGroupMember: (gid, friend_name) => post(`/groups/${gid}/members`, { friend_name }, { invalidate: ["/groups"] }),
  removeGroupMember: (gid, name) => del(`/groups/${gid}/members/${name}`, { invalidate: ["/groups"] }),

  // Rounds
  getRounds: (options = {}) => {
    const { limit, meta, ...requestOptions } = options
    const params = new URLSearchParams()
    if (limit) params.set("limit", String(limit))
    if (meta) params.set("meta", "1")
    return req(`/rounds${params.toString() ? `?${params}` : ""}`, requestOptions)
  },
  createRound: (name, joiners) => post("/rounds", { name, joiners }, { invalidate: ["/rounds"] }),
  closeRound: (id) => patch(`/rounds/${id}/close`, undefined, { invalidate: ["/rounds"] }),
  reopenRound: (id) => patch(`/rounds/${id}/reopen`, undefined, { invalidate: ["/rounds"] }),
  addRoundMember: (roundId, friend_name) => post(`/rounds/${roundId}/members`, { friend_name }, { invalidate: ["/rounds"] }),

  // Items
  addItem: (roundId, name, price, splitWith) => post(`/rounds/${roundId}/items`, { name, price, splitWith }, { invalidate: ["/rounds"] }),
  updateItem: (itemId, name, price) => post(`/items/${itemId}/update`, { name, price }, { invalidate: ["/rounds"] }),
  updateSplits: (itemId, splitWith) => patch(`/items/${itemId}/splits`, { splitWith }, { invalidate: ["/rounds"] }),
  deleteItem: (id) => del(`/items/${id}`, { invalidate: ["/rounds"] }),

  // Payment
  getPaymentInfo: () => req("/payment-info"),
  savePaymentInfo: (data) => post("/payment-info", data, { invalidate: ["/payment-info"] }),
  deletePaymentInfo: (name) => del(`/payment-info/${name}`, { invalidate: ["/payment-info"] }),

  // Dues
  getDues: (params = {}) => {
    const query = new URLSearchParams()
    if (params.month) query.set("month", params.month)
    if (params.status && params.status !== "all") query.set("status", params.status)
    return req(`/dues${query.toString() ? `?${query}` : ""}`, { skipCache: true })
  },
  addDue: (data) => post("/dues", data),
  updateDue: (id, data) => patch(`/dues/${id}`, data),
  createDuePayLink: (data) => post("/dues/pay-link", data),
  getPublicPayment: (token) => req(`/pay/${token}`, { skipCache: true }),
  uploadPublicPaymentSlip: (token, file) => {
    const form = new FormData()
    form.append("slip", file)
    return fetch(`${BASE}/pay/${token}/slip`, {
      method: "POST",
      body: form
    }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || "Upload failed")
      return data
    })
  },
  uploadPublicDueItemSlip: (token, id, file) => {
    const form = new FormData()
    form.append("slip", file)
    return fetch(`${BASE}/pay/${token}/items/${id}/slip`, {
      method: "POST",
      body: form
    }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || "Upload failed")
      return data
    })
  },
  getDueSlipBlob: (id) => fetch(`${BASE}/dues/${id}/slip`, {
    headers: { "Authorization": `Bearer ${getToken()}` }
  }).then(async r => {
    if (!r.ok) {
      let message = "Slip not found"
      try {
        const data = await r.json()
        message = data?.error || message
      } catch {}
      throw new Error(message)
    }
    return r.blob()
  }),
  attachDueSlip: (id, file) => {
    const form = new FormData()
    form.append("slip", file)
    return fetch(`${BASE}/dues/${id}/slip`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${getToken()}` },
      body: form
    }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || "Upload failed")
      clearApiCache(["/dues"])
      return data
    })
  },

  // Scan
  scanReceipt: (file) => {
    const form = new FormData()
    form.append("image", file)
    return fetch(`${BASE}/scan`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${getToken()}` },
      body: form
    }).then(r => {
      clearApiCache(["/rounds"])
      return r.json()
    })
  }
}

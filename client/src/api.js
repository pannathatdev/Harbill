const BASE = "http://localhost:3001"

function getToken() {
  return localStorage.getItem("token")
}

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
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

  return data
}

function post(path, body) {
  return req(path, { method: "POST", body: JSON.stringify(body) })
}

function patch(path, body) {
  return req(path, { method: "PATCH", body: JSON.stringify(body) })
}

function del(path) {
  return req(path, { method: "DELETE" })
}

export const api = {
  // Auth
  register: (email, password, name) => post("/auth/register", { email, password, name }),
  login: (email, password) => post("/auth/login", { email, password }),
  me: () => req("/auth/me"),
  googleLogin: () => { window.location.href = `${BASE}/auth/google` },

  // Friends
  getFriends: () => req("/friends"),
  addFriend: (name) => post("/friends", { name }),
  deleteFriend: (id) => del(`/friends/${id}`),

  // Groups
  getGroups: () => req("/groups"),
  addGroup: (name) => post("/groups", { name }),
  deleteGroup: (id) => del(`/groups/${id}`),
  addGroupMember: (gid, friend_name) => post(`/groups/${gid}/members`, { friend_name }),
  removeGroupMember: (gid, name) => del(`/groups/${gid}/members/${name}`),

  // Rounds
  getRounds: () => req("/rounds"),
  createRound: (name, joiners) => post("/rounds", { name, joiners }),
  closeRound: (id) => patch(`/rounds/${id}/close`),
  reopenRound: (id) => fetch(`${BASE}/rounds/${id}/reopen`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${getToken()}` }
  }).then(r => r.json()),
  addRoundMember: (roundId, friend_name) => post(`/rounds/${roundId}/members`, { friend_name }),

  // Items
  addItem: (roundId, name, price, splitWith) => post(`/rounds/${roundId}/items`, { name, price, splitWith }),
  updateItem: (itemId, name, price) => post(`/items/${itemId}/update`, { name, price }),
  updateSplits: (itemId, splitWith) => patch(`/items/${itemId}/splits`, { splitWith }),
  deleteItem: (id) => del(`/items/${id}`),

  // Payment
  getPaymentInfo: () => req("/payment-info"),
  savePaymentInfo: (data) => post("/payment-info", data),
  deletePaymentInfo: (name) => del(`/payment-info/${name}`),

  // Scan
  scanReceipt: (file) => {
    const form = new FormData()
    form.append("image", file)
    return fetch(`${BASE}/scan`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${getToken()}` },
      body: form
    }).then(r => r.json())
  }
}

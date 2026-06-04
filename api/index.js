const express = require("express")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const crypto = require("crypto")
const jwt = require("jsonwebtoken")
const multer = require("multer")
const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const session = require("express-session")
require("dotenv").config()

const db = require("./db")
const { signToken, requireAuth } = require("./auth")

const PORT = process.env.PORT || 3001
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173"
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || `${API_BASE_URL}/auth/google/callback`
const isPlaceholder = value => !value || /^('|")?(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|JWT_SECRET)('|")?$/.test(value)
const googleAuthReady = !isPlaceholder(process.env.GOOGLE_CLIENT_ID) && !isPlaceholder(process.env.GOOGLE_CLIENT_SECRET)
const SESSION_SECRET = !isPlaceholder(process.env.JWT_SECRET) ? process.env.JWT_SECRET : "local-development-secret"
const emailRegisterEnabled = process.env.EMAIL_REGISTER_ENABLED === "true"

const app = express()
app.use(cors({ origin: CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }))
app.use(passport.initialize())
app.use(passport.session())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
})

let aiUsageSchemaReady = false
let monetizationSchemaReady = false
let analyticsSchemaReady = false

function dbErrorMessage(err) {
  if (err?.code === "ERR_OUT_OF_RANGE" || /offset.*out of range/i.test(err?.message || "")) {
    return `${err.message}. Check DB_HOST and DB_PORT: use the classic MySQL port from your database provider, not a MySQL X/Admin/HTTPS port.`
  }
  return err.message
}

async function ensureGoogleAuthSchema() {
  const [columns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME IN ('avatar', 'google_id')
  `)
  const existing = new Set(columns.map(column => column.COLUMN_NAME))

  if (!existing.has("avatar")) {
    await db.query("ALTER TABLE users ADD COLUMN avatar TEXT NULL")
  }

  if (!existing.has("google_id")) {
    await db.query("ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE")
  }
}

async function ensureMonetizationSchema() {
  if (monetizationSchemaReady) return

  const [columns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME IN ('plan', 'pro_until')
  `)
  const existing = new Set(columns.map(column => column.COLUMN_NAME))

  if (!existing.has("plan")) {
    await db.query("ALTER TABLE users ADD COLUMN plan VARCHAR(32) NOT NULL DEFAULT 'free'")
  }

  if (!existing.has("pro_until")) {
    await db.query("ALTER TABLE users ADD COLUMN pro_until DATETIME NULL")
  }

  monetizationSchemaReady = true
}

function userPlan(user) {
  const proUntil = user?.pro_until ? new Date(user.pro_until) : null
  const active = user?.plan === "pro" && proUntil && proUntil.getTime() > Date.now()
  return {
    plan: active ? "pro" : "free",
    isPro: Boolean(active),
    pro_until: active ? user.pro_until : null
  }
}

async function ensureAnalyticsSchema() {
  if (analyticsSchemaReady) return

  await db.query(`
    CREATE TABLE IF NOT EXISTS site_visits_daily (
      visit_date DATE NOT NULL,
      visitor_key VARCHAR(128) NOT NULL,
      user_id INT NULL,
      hostname VARCHAR(255) NULL,
      entry_path VARCHAR(255) NULL,
      sessions INT NOT NULL DEFAULT 1,
      first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (visit_date, visitor_key),
      INDEX idx_site_visits_daily_date (visit_date),
      INDEX idx_site_visits_daily_host_date (hostname, visit_date),
      CONSTRAINT fk_site_visits_daily_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  analyticsSchemaReady = true
}

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

function requireAdmin(req, res, next) {
  const allowed = adminEmails()
  const email = String(req.user?.email || "").toLowerCase()
  const localOpen = allowed.length === 0 && process.env.NODE_ENV !== "production"
  const token = String(req.headers["x-admin-token"] || "").replace("Bearer ", "")

  if (!token) {
    return res.status(401).json({ error: "Admin verification required" })
  }

  try {
    const decoded = jwt.verify(token, SESSION_SECRET)
    if (decoded?.scope !== "admin" || decoded?.userId !== req.user?.id) {
      return res.status(401).json({ error: "Invalid admin session" })
    }
  } catch {
    return res.status(401).json({ error: "Admin session expired" })
  }

  if (localOpen || allowed.includes(email)) return next()
  return res.status(403).json({ error: "Admin access required" })
}

function base32ToBuffer(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const clean = String(value || "").replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase()
  let bits = ""

  for (const char of clean) {
    const index = alphabet.indexOf(char)
    if (index === -1) continue
    bits += index.toString(2).padStart(5, "0")
  }

  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function hotp(secret, counter) {
  const key = base32ToBuffer(secret)
  if (key.length === 0) return null

  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buffer.writeUInt32BE(counter >>> 0, 4)

  const hmac = crypto.createHmac("sha1", key).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000

  return String(code).padStart(6, "0")
}

function verifyTotp(secret, code) {
  const clean = String(code || "").replace(/\D/g, "")
  if (!/^\d{6}$/.test(clean)) return false

  const counter = Math.floor(Date.now() / 30000)
  for (let drift = -1; drift <= 1; drift++) {
    if (hotp(secret, counter + drift) === clean) return true
  }
  return false
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header) return next()

  const token = header.replace("Bearer ", "")
  try {
    const jwt = require("jsonwebtoken")
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [decoded.id])
    req.user = rows[0] || null
  } catch {
    req.user = null
  }
  next()
}

async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    })
    return response.ok
  } catch (err) {
    console.error("Telegram notification failed:", err.message)
    return false
  }
}

async function ensureAiUsageSchema() {
  if (aiUsageSchemaReady) return

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_scan_usage (
      user_id INT NOT NULL,
      usage_date DATE NOT NULL,
      scans INT NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, usage_date),
      CONSTRAINT fk_ai_scan_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS scan_credit_balances (
      user_id INT PRIMARY KEY,
      credits INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_scan_credit_balances_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS scan_credit_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      credits INT NOT NULL,
      kind VARCHAR(32) NOT NULL,
      reference VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_scan_credit_reference (reference),
      INDEX idx_scan_credit_transactions_user_id (user_id),
      CONSTRAINT fk_scan_credit_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  aiUsageSchemaReady = true
}

async function checkAiScanLimit(userId) {
  const limit = Number(process.env.FREE_SCAN_DAILY_LIMIT || 5)
  await ensureAiUsageSchema()
  await ensureMonetizationSchema()

  const [userRows] = await db.query("SELECT plan, pro_until FROM users WHERE id=?", [userId])
  if (userPlan(userRows[0]).isPro) {
    return { allowed: true, source: "pro", limit: null, used: 0, paidCredits: 0 }
  }

  const [rows] = await db.query(
    "SELECT scans FROM ai_scan_usage WHERE user_id=? AND usage_date=CURRENT_DATE",
    [userId]
  )
  const used = rows[0]?.scans || 0
  if (!Number.isFinite(limit) || limit <= 0 || used < limit) {
    return { allowed: true, source: "free", limit: Number.isFinite(limit) ? limit : null, used, paidCredits: 0 }
  }

  const [creditRows] = await db.query("SELECT credits FROM scan_credit_balances WHERE user_id=?", [userId])
  const paidCredits = creditRows[0]?.credits || 0
  return { allowed: paidCredits > 0, source: paidCredits > 0 ? "paid" : "none", limit, used, paidCredits }
}

async function recordAiScan(userId, source = "free") {
  await db.query(`
    INSERT INTO ai_scan_usage (user_id, usage_date, scans)
    VALUES (?, CURRENT_DATE, 1)
    ON DUPLICATE KEY UPDATE scans=scans+1
  `, [userId])

  if (source === "paid") {
    await db.query(
      "UPDATE scan_credit_balances SET credits=GREATEST(credits-1, 0) WHERE user_id=?",
      [userId]
    )
    await db.query(
      "INSERT INTO scan_credit_transactions (user_id, credits, kind, reference) VALUES (?, -1, 'scan_used', NULL)",
      [userId]
    )
  }
}

async function addScanCredits(userId, credits, reference) {
  await ensureAiUsageSchema()
  await db.query(`
    INSERT INTO scan_credit_transactions (user_id, credits, kind, reference)
    VALUES (?, ?, 'purchase', ?)
  `, [userId, credits, reference])
  await db.query(`
    INSERT INTO scan_credit_balances (user_id, credits)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE credits=credits+VALUES(credits)
  `, [userId, credits])
}

app.get("/", (req, res) => {
  res.json({ ok: true, service: "harbill-api" })
})

// ── GOOGLE OAUTH ──────────────────────────────────────────────
if (googleAuthReady) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      await ensureGoogleAuthSchema()

      const email = profile.emails?.[0]?.value
      const name = profile.displayName
      const avatar = profile.photos?.[0]?.value
      const google_id = profile.id

      if (!email) return done(new Error("Google account does not expose an email address"))

      let [rows] = await db.query("SELECT * FROM users WHERE google_id = ? OR email = ?", [google_id, email])
      let user = rows[0]

      if (!user) {
        const [r] = await db.query(
          "INSERT INTO users (email, name, avatar, google_id) VALUES (?,?,?,?)",
          [email, name, avatar, google_id]
        )
        user = { id: r.insertId, email, name, avatar }
      } else if (!user.google_id) {
        await db.query("UPDATE users SET google_id=?, avatar=? WHERE id=?", [google_id, avatar, user.id])
        user = { ...user, google_id, avatar }
      }

      done(null, user)
    } catch (err) {
      done(err)
    }
  }))
} else {
  console.warn("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in api/.env.")
}

passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser(async (id, done) => {
  const [rows] = await db.query("SELECT * FROM users WHERE id=?", [id])
  done(null, rows[0])
})

app.get("/health", async (req, res) => {
  const usingDatabaseUrl = Boolean(process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_URI)
  const dbKeys = usingDatabaseUrl ? [] : ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
  const missing = [...dbKeys, "JWT_SECRET"].filter(key => isPlaceholder(process.env[key]))
  const dbConfig = typeof db.getDebugInfo === "function" ? db.getDebugInfo() : undefined

  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      db: false,
      error: `Missing environment variables: ${missing.join(", ")}`,
      googleAuthReady,
      googleCallbackUrl: GOOGLE_CALLBACK_URL,
      dbConfig
    })
  }

  try {
    await db.query("SELECT 1")
    res.json({ ok: true, db: true, googleAuthReady, googleCallbackUrl: GOOGLE_CALLBACK_URL, dbConfig })
  } catch (err) {
    res.status(500).json({ ok: false, db: false, error: dbErrorMessage(err), googleAuthReady, googleCallbackUrl: GOOGLE_CALLBACK_URL, dbConfig })
  }
})

app.get("/auth/google/status", (req, res) => {
  res.json({
    enabled: googleAuthReady,
    callbackUrl: GOOGLE_CALLBACK_URL,
    clientUrl: CLIENT_URL
  })
})

app.get("/auth/google", (req, res, next) => {
  if (!googleAuthReady) {
    return res.status(503).json({
      error: "Google login is not configured.",
      callbackUrl: GOOGLE_CALLBACK_URL
    })
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next)
})

app.get("/auth/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user) => {
    if (err) {
      console.error("Google OAuth callback failed:", err)
      return res.redirect(`${CLIENT_URL}/login?error=google_internal`)
    }

    if (!user) {
      return res.redirect(`${CLIENT_URL}/login?error=google`)
    }

    req.user = user
    const token = signToken(req.user)
    res.redirect(`${CLIENT_URL}/auth?token=${token}&name=${encodeURIComponent(req.user.name)}&avatar=${encodeURIComponent(req.user.avatar || "")}`)
  })(req, res, next)
})

// ── EMAIL AUTH ────────────────────────────────────────────────
app.post("/auth/register", async (req, res) => {
  if (!emailRegisterEnabled) {
    return res.status(403).json({ error: "Registration is temporarily closed." })
  }

  const { email, password, name } = req.body
  if (!email || !password || !name) return res.status(400).json({ error: "กรอกให้ครบครับ" })
  try {
    const hash = await bcrypt.hash(password, 10)
    const [r] = await db.query(
      "INSERT INTO users (email, password, name) VALUES (?,?,?)",
      [email, hash, name]
    )
    const user = { id: r.insertId, email, name }
    res.json({ token: signToken(user), user })
  } catch {
    res.status(400).json({ error: "อีเมลนี้ถูกใช้แล้วครับ" })
  }
})

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body
  const [rows] = await db.query("SELECT * FROM users WHERE email=?", [email])
  const user = rows[0]
  if (!user || !user.password) return res.status(400).json({ error: "ไม่พบบัญชีนี้ครับ" })
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้องครับ" })
  res.json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } })
})

app.get("/auth/me", requireAuth, async (req, res) => {
  await ensureMonetizationSchema()
  const [rows] = await db.query("SELECT id, email, name, avatar, plan, pro_until FROM users WHERE id=?", [req.user.id])
  const user = rows[0] || req.user
  const { id, email, name, avatar } = user
  res.json({ id, email, name, avatar, ...userPlan(user) })
})

app.post("/analytics/page-view", optionalAuth, async (req, res) => {
  await ensureAnalyticsSchema()

  const visitorKey = String(req.body.visitorKey || "").slice(0, 128)
  const entryPath = String(req.body.path || "/").split("?")[0].slice(0, 255)
  const hostname = String(req.body.hostname || req.hostname || "").slice(0, 255)

  if (!visitorKey) return res.status(400).json({ error: "Missing visitor key" })

  await db.query(`
    INSERT INTO site_visits_daily (visit_date, visitor_key, user_id, hostname, entry_path, sessions)
    VALUES (CURRENT_DATE, ?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      user_id=COALESCE(VALUES(user_id), user_id),
      hostname=COALESCE(VALUES(hostname), hostname),
      sessions=sessions+1,
      last_seen=CURRENT_TIMESTAMP
  `, [visitorKey, req.user?.id || null, hostname || null, entryPath || "/"])

  res.json({ ok: true })
})

app.post("/admin/session", requireAuth, async (req, res) => {
  const allowed = adminEmails()
  const email = String(req.user?.email || "").toLowerCase()
  const localOpen = allowed.length === 0 && process.env.NODE_ENV !== "production"

  if (!localOpen && !allowed.includes(email)) {
    return res.status(403).json({ error: "Admin access required" })
  }

  const password = String(req.body.password || "")
  const code = String(req.body.code || "")
  const passwordHash = process.env.ADMIN_PASSWORD_HASH
  const passwordPlain = process.env.ADMIN_PASSWORD
  const totpSecret = process.env.ADMIN_TOTP_SECRET

  if (!passwordHash && !passwordPlain && process.env.NODE_ENV === "production") {
    return res.status(500).json({ error: "ADMIN_PASSWORD or ADMIN_PASSWORD_HASH is not configured" })
  }

  if (!totpSecret && process.env.NODE_ENV === "production") {
    return res.status(500).json({ error: "ADMIN_TOTP_SECRET is not configured" })
  }

  const passwordOk = passwordHash
    ? await bcrypt.compare(password, passwordHash)
    : password === (passwordPlain || "admin")

  const totpOk = totpSecret
    ? verifyTotp(totpSecret, code)
    : process.env.NODE_ENV !== "production" && code === "000000"

  if (!passwordOk || !totpOk) {
    return res.status(401).json({ error: "Invalid admin password or authenticator code" })
  }

  const expiresInSeconds = 2 * 60 * 60
  const token = jwt.sign(
    { scope: "admin", userId: req.user.id, email },
    SESSION_SECRET,
    { expiresIn: expiresInSeconds }
  )

  res.json({
    token,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
  })
})

app.get("/admin/summary", requireAuth, requireAdmin, async (req, res) => {
  await ensureMonetizationSchema()
  await ensureAnalyticsSchema()
  await ensureAiUsageSchema()

  const aiScanCost = Number(process.env.AI_SCAN_COST_THB || 0)
  const serverMonthlyCost = Number(process.env.SERVER_MONTHLY_COST_THB || 0)
  const freeScanDailyLimit = Number(process.env.FREE_SCAN_DAILY_LIMIT || 5)
  const dbStorageLimitMb = Number(process.env.DB_STORAGE_LIMIT_MB || 1024)

  const [
    [usersRows],
    [proRows],
    [roundRows],
    [itemRows],
    [scanRows],
    [viewRows],
    [visitorRows],
    [domainRows],
    [pathRows],
    [recentUsers],
    [scanDailyRows],
    [dbSizeRows],
  ] = await Promise.all([
    db.query("SELECT COUNT(*) total, SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) last7 FROM users"),
    db.query("SELECT COUNT(*) activePro FROM users WHERE plan='pro' AND pro_until > NOW()"),
    db.query("SELECT COUNT(*) total, SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) last7, SUM(closed_at IS NOT NULL) closed FROM rounds"),
    db.query("SELECT COUNT(*) total, COALESCE(SUM(price),0) totalValue FROM items"),
    db.query("SELECT COALESCE(SUM(scans),0) total, COALESCE(SUM(CASE WHEN usage_date = CURRENT_DATE THEN scans ELSE 0 END),0) today, COALESCE(SUM(CASE WHEN usage_date >= CURRENT_DATE - INTERVAL 7 DAY THEN scans ELSE 0 END),0) last7 FROM ai_scan_usage"),
    db.query("SELECT COALESCE(SUM(sessions),0) total, COALESCE(SUM(CASE WHEN visit_date=CURRENT_DATE THEN sessions ELSE 0 END),0) today, COALESCE(SUM(CASE WHEN visit_date >= CURRENT_DATE - INTERVAL 7 DAY THEN sessions ELSE 0 END),0) last7 FROM site_visits_daily"),
    db.query("SELECT COUNT(*) total, SUM(visit_date=CURRENT_DATE) today, SUM(visit_date >= CURRENT_DATE - INTERVAL 7 DAY) last7 FROM site_visits_daily"),
    db.query("SELECT COALESCE(hostname, 'unknown') hostname, SUM(sessions) views, COUNT(*) visitors FROM site_visits_daily GROUP BY COALESCE(hostname, 'unknown') ORDER BY views DESC LIMIT 8"),
    db.query("SELECT COALESCE(entry_path, '/') path, SUM(sessions) views, COUNT(*) visitors FROM site_visits_daily GROUP BY COALESCE(entry_path, '/') ORDER BY views DESC LIMIT 8"),
    db.query("SELECT id, email, name, plan, pro_until, created_at FROM users ORDER BY created_at DESC LIMIT 8"),
    db.query("SELECT usage_date, SUM(scans) scans, COUNT(*) users FROM ai_scan_usage GROUP BY usage_date ORDER BY usage_date DESC LIMIT 14"),
    db.query(`
      SELECT
        COALESCE(SUM(data_length + index_length), 0) bytes,
        COALESCE(SUM(data_length), 0) dataBytes,
        COALESCE(SUM(index_length), 0) indexBytes,
        COUNT(*) tablesCount
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `),
  ])

  const scansTotal = Number(scanRows[0]?.total || 0)
  const estimatedAiCost = scansTotal * (Number.isFinite(aiScanCost) ? aiScanCost : 0)
  const monthlyCost = Number.isFinite(serverMonthlyCost) ? serverMonthlyCost : 0
  const dbBytes = Number(dbSizeRows[0]?.bytes || 0)
  const dbLimitBytes = Number.isFinite(dbStorageLimitMb) && dbStorageLimitMb > 0
    ? dbStorageLimitMb * 1024 * 1024
    : null

  res.json({
    generatedAt: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || "development",
      apiBaseUrl: API_BASE_URL,
      clientUrl: CLIENT_URL,
      requestHost: req.headers.host || "",
      configuredDomains: [CLIENT_URL, API_BASE_URL].filter(Boolean),
    },
    totals: {
      users: Number(usersRows[0]?.total || 0),
      usersLast7: Number(usersRows[0]?.last7 || 0),
      activePro: Number(proRows[0]?.activePro || 0),
      rounds: Number(roundRows[0]?.total || 0),
      roundsLast7: Number(roundRows[0]?.last7 || 0),
      closedRounds: Number(roundRows[0]?.closed || 0),
      items: Number(itemRows[0]?.total || 0),
      itemValue: Number(itemRows[0]?.totalValue || 0),
      scans: scansTotal,
      scansLast7: Number(scanRows[0]?.last7 || 0),
      scansToday: Number(scanRows[0]?.today || 0),
      pageViews: Number(viewRows[0]?.total || 0),
      pageViewsToday: Number(viewRows[0]?.today || 0),
      pageViewsLast7: Number(viewRows[0]?.last7 || 0),
      visitors: Number(visitorRows[0]?.total || 0),
      visitorsToday: Number(visitorRows[0]?.today || 0),
      visitorsLast7: Number(visitorRows[0]?.last7 || 0),
    },
    costs: {
      aiScanCostThb: Number.isFinite(aiScanCost) ? aiScanCost : 0,
      estimatedAiCostThb: estimatedAiCost,
      serverMonthlyCostThb: monthlyCost,
      estimatedTotalCostThb: estimatedAiCost + monthlyCost,
    },
    scanUsage: {
      freeDailyLimit: Number.isFinite(freeScanDailyLimit) ? freeScanDailyLimit : null,
      daily: scanDailyRows.map(row => ({
        date: row.usage_date,
        scans: Number(row.scans || 0),
        users: Number(row.users || 0),
      })),
    },
    database: {
      bytes: dbBytes,
      mb: dbBytes / 1024 / 1024,
      dataMb: Number(dbSizeRows[0]?.dataBytes || 0) / 1024 / 1024,
      indexMb: Number(dbSizeRows[0]?.indexBytes || 0) / 1024 / 1024,
      limitMb: dbLimitBytes ? dbLimitBytes / 1024 / 1024 : null,
      usedPercent: dbLimitBytes ? (dbBytes / dbLimitBytes) * 100 : null,
      tablesCount: Number(dbSizeRows[0]?.tablesCount || 0),
    },
    domains: domainRows,
    topPaths: pathRows,
    recentUsers: recentUsers.map(user => ({
      ...user,
      isPro: userPlan(user).isPro
    })),
  })
})

app.get("/billing/pro-status", requireAuth, async (req, res) => {
  await ensureMonetizationSchema()
  const [rows] = await db.query("SELECT plan, pro_until FROM users WHERE id=?", [req.user.id])
  res.json(userPlan(rows[0]))
})

app.post("/billing/pro/mock-activate", requireAuth, async (req, res) => {
  await ensureMonetizationSchema()
  const days = Math.min(Math.max(Number(req.body.days) || 30, 1), 366)
  const reference = String(req.body.reference || "").trim()

  if (process.env.ENABLE_MANUAL_PRO_ACTIVATION !== "true" && process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Manual Pro activation is disabled." })
  }

  await db.query(
    "UPDATE users SET plan='pro', pro_until=DATE_ADD(GREATEST(COALESCE(pro_until, NOW()), NOW()), INTERVAL ? DAY) WHERE id=?",
    [days, req.user.id]
  )

  const [rows] = await db.query("SELECT plan, pro_until FROM users WHERE id=?", [req.user.id])
  await notifyTelegram([
    "Harbill Pro request",
    `User: ${req.user.name || "-"} (${req.user.email || "-"})`,
    `Days: ${days}`,
    `Reference: ${reference || "-"}`,
    `Pro until: ${rows[0]?.pro_until || "-"}`,
    `Time: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`
  ].join("\n"))

  res.json({ ok: true, reference, ...userPlan(rows[0]) })
})

// ── FRIENDS ───────────────────────────────────────────────────
app.get("/friends", requireAuth, async (req, res) => {
  const [rows] = await db.query("SELECT * FROM friends WHERE user_id=? ORDER BY name", [req.user.id])
  res.json(rows)
})

app.post("/friends", requireAuth, async (req, res) => {
  const name = (req.body.name || "").trim()
  if (!name) {
    return res.status(400).json({ error: "กรุณากรอกชื่อเพื่อนก่อน" })
  }

  try {
    const [r] = await db.query("INSERT INTO friends (name, user_id) VALUES (?,?)", [name, req.user.id])
    res.json({ id: r.insertId, name })
  } catch (err) {
    console.error(err)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "ชื่อเพื่อนนี้ถูกใช้ไปแล้ว" })
    }
    res.status(500).json({ error: "ไม่สามารถเพิ่มชื่อเพื่อนได้ครับ" })
  }
})

app.delete("/friends/:id", requireAuth, async (req, res) => {
  await db.query("DELETE FROM friends WHERE id=? AND user_id=?", [req.params.id, req.user.id])
  res.json({ ok: true })
})

// ── GROUPS ────────────────────────────────────────────────────
app.get("/groups", requireAuth, async (req, res) => {
  const [groups] = await db.query("SELECT * FROM `groups` WHERE user_id=? ORDER BY name", [req.user.id])
  const [members] = await db.query(
    "SELECT gm.* FROM group_members gm JOIN `groups` g ON gm.group_id=g.id WHERE g.user_id=?",
    [req.user.id]
  )
  res.json(groups.map(g => ({
    ...g,
    members: members.filter(m => m.group_id === g.id).map(m => m.friend_name)
  })))
})

app.post("/groups", requireAuth, async (req, res) => {
  const name = (req.body.name || "").trim()
  if (!name) return res.status(400).json({ error: "กรุณากรอกชื่อกลุ่ม" })
  const [r] = await db.query("INSERT INTO `groups` (name, user_id) VALUES (?,?)", [name, req.user.id])
  res.json({ id: r.insertId, name, members: [] })
})

app.patch("/groups/:id", requireAuth, async (req, res) => {
  const name = (req.body.name || "").trim()
  if (!name) return res.status(400).json({ error: "กรุณากรอกชื่อกลุ่ม" })
  await db.query("UPDATE `groups` SET name=? WHERE id=? AND user_id=?", [name, req.params.id, req.user.id])
  res.json({ ok: true })
})

app.delete("/groups/:id", requireAuth, async (req, res) => {
  await db.query("DELETE FROM `groups` WHERE id=? AND user_id=?", [req.params.id, req.user.id])
  res.json({ ok: true })
})

app.post("/groups/:id/members", requireAuth, async (req, res) => {
  const { friend_name } = req.body
  await db.query("INSERT IGNORE INTO group_members VALUES (?,?)", [req.params.id, friend_name])
  res.json({ ok: true })
})

app.delete("/groups/:id/members/:name", requireAuth, async (req, res) => {
  await db.query("DELETE FROM group_members WHERE group_id=? AND friend_name=?", [req.params.id, req.params.name])
  res.json({ ok: true })
})

// ── ROUNDS ────────────────────────────────────────────────────
app.get("/rounds", requireAuth, async (req, res) => {
  const [rounds] = await db.query("SELECT * FROM rounds WHERE user_id=? ORDER BY created_at DESC", [req.user.id])
  const roundIds = rounds.map(r => r.id)
  if (roundIds.length === 0) return res.json([])

  const [members] = await db.query(`SELECT * FROM round_members WHERE round_id IN (${roundIds.map(() => "?").join(",")})`, roundIds)
  const [items] = await db.query(`SELECT * FROM items WHERE round_id IN (${roundIds.map(() => "?").join(",")})`, roundIds)
  const itemIds = items.map(i => i.id)
  const splits = itemIds.length > 0
    ? (await db.query(`SELECT * FROM item_splits WHERE item_id IN (${itemIds.map(() => "?").join(",")})`, itemIds))[0]
    : []

  res.json(rounds.map(r => ({
    ...r,
    joiners: members.filter(m => m.round_id === r.id).map(m => m.friend_name),
    items: items.filter(i => i.round_id === r.id).map(i => ({
      ...i,
      price: parseFloat(i.price),
      splitWith: splits.filter(s => s.item_id === i.id).map(s => s.friend_name)
    }))
  })))
})

app.post("/rounds", requireAuth, async (req, res) => {
  const { name, joiners } = req.body
  const [r] = await db.query("INSERT INTO rounds (name, user_id) VALUES (?,?)", [name || "รอบใหม่", req.user.id])
  const roundId = r.insertId
  for (const f of (joiners || [])) {
    await db.query("INSERT INTO round_members VALUES (?,?)", [roundId, f])
  }
  res.json({ id: roundId, name: name || "รอบใหม่", joiners: joiners || [], items: [] })
})

app.patch("/rounds/:id/close", requireAuth, async (req, res) => {
  await db.query("UPDATE rounds SET closed_at=NOW() WHERE id=? AND user_id=?", [req.params.id, req.user.id])
  res.json({ ok: true })
})

app.patch("/rounds/:id/reopen", requireAuth, async (req, res) => {
  await db.query("UPDATE rounds SET closed_at=NULL WHERE id=? AND user_id=?", [req.params.id, req.user.id])
  res.json({ ok: true })
})

app.post("/rounds/:id/members", requireAuth, async (req, res) => {
  const { friend_name } = req.body
  await db.query("INSERT IGNORE INTO round_members VALUES (?,?)", [req.params.id, friend_name])
  res.json({ ok: true })
})

// ── ITEMS ─────────────────────────────────────────────────────
app.post("/rounds/:id/items", requireAuth, async (req, res) => {
  const { name, price, splitWith } = req.body
  const [r] = await db.query("INSERT INTO items (round_id, name, price) VALUES (?,?,?)", [req.params.id, name, price])
  const itemId = r.insertId
  for (const person of (splitWith || [])) {
    await db.query("INSERT INTO item_splits VALUES (?,?)", [itemId, person])
  }
  res.json({ id: itemId, name, price: parseFloat(price), splitWith: splitWith || [] })
})

app.patch("/items/:id", requireAuth, async (req, res) => {
  const name = (req.body.name || "").trim()
  const price = parseFloat(req.body.price)
  if (!name || Number.isNaN(price)) return res.status(400).json({ error: "Invalid item" })

  await db.query("UPDATE items SET name=?, price=? WHERE id=?", [name, price, req.params.id])
  res.json({ id: parseInt(req.params.id, 10), name, price })
})

app.post("/items/:id/update", requireAuth, async (req, res) => {
  const name = (req.body.name || "").trim()
  const price = parseFloat(req.body.price)
  if (!name || Number.isNaN(price)) return res.status(400).json({ error: "Invalid item" })

  await db.query("UPDATE items SET name=?, price=? WHERE id=?", [name, price, req.params.id])
  res.json({ id: parseInt(req.params.id, 10), name, price })
})

app.patch("/items/:id/splits", requireAuth, async (req, res) => {
  const { splitWith } = req.body
  await db.query("DELETE FROM item_splits WHERE item_id=?", [req.params.id])
  for (const person of splitWith) {
    await db.query("INSERT INTO item_splits VALUES (?,?)", [req.params.id, person])
  }
  res.json({ ok: true })
})

app.delete("/items/:id", requireAuth, async (req, res) => {
  await db.query("DELETE FROM items WHERE id=?", [req.params.id])
  res.json({ ok: true })
})

// ── PAYMENT INFO ──────────────────────────────────────────────
app.get("/payment-info", requireAuth, async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM payment_info WHERE user_id=?",
    [req.user.id]
  )
  res.json(rows)
})

app.post("/payment-info", requireAuth, async (req, res) => {
  const { friend_name, bank_name, account_number, promptpay, display_name } = req.body
  await db.query(`
    INSERT INTO payment_info (user_id, friend_name, bank_name, account_number, promptpay, display_name)
    VALUES (?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE bank_name=VALUES(bank_name), account_number=VALUES(account_number),
    promptpay=VALUES(promptpay), display_name=VALUES(display_name)
  `, [req.user.id, friend_name, bank_name, account_number, promptpay, display_name])
  res.json({ ok: true })
})

app.delete("/payment-info/:name", requireAuth, async (req, res) => {
  await db.query("DELETE FROM payment_info WHERE user_id=? AND friend_name=?", [req.user.id, req.params.name])
  res.json({ ok: true })
})

// ── SCAN ──────────────────────────────────────────────────────
app.post("/billing/scan-credits/webhook", async (req, res) => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret || req.headers["x-webhook-secret"] !== secret) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const userId = Number(req.body.userId)
  const credits = Number(req.body.credits)
  const reference = String(req.body.reference || "")

  if (!userId || !Number.isInteger(credits) || credits <= 0 || !reference) {
    return res.status(400).json({ error: "Invalid credit payload" })
  }

  try {
    await addScanCredits(userId, credits, reference)
    res.json({ ok: true, userId, credits })
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.json({ ok: true, duplicate: true })
    }
    throw err
  }
})

app.post("/scan", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" })

    const usage = await checkAiScanLimit(req.user.id)
    if (!usage.allowed) {
      return res.status(429).json({
        error: `ใช้โควตาสแกน AI วันนี้ครบแล้ว (${usage.used}/${usage.limit})`,
        limit: usage.limit,
        used: usage.used
      })
    }

    const imageData = req.file.buffer
    const base64 = imageData.toString("base64")
    const mimeType = req.file.mimetype

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: `ดูรูปนี้แล้วหารายการอาหารและราคาทั้งหมด ตอบเป็น JSON array เท่านั้น ห้ามมีข้อความอื่น รูปแบบ: [{"name":"ชื่อรายการ","price":ราคาตัวเลข}] ถ้าไม่เจอรายการอาหาร ตอบว่า []` }
            ]
          }]
        })
      }
    )

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]"
    const clean = text.replace(/```json|```/g, "").trim()
    const items = JSON.parse(clean)
    await recordAiScan(req.user.id, usage.source)
    res.json({
      items,
      usage: {
        source: usage.source,
        limit: usage.limit,
        used: usage.used + 1,
        paidCredits: usage.source === "paid" ? usage.paidCredits - 1 : usage.paidCredits
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "อ่านไม่ได้ครับ" })
  }
})

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`API ready on port ${PORT}`)
    console.log(`Google callback URL: ${GOOGLE_CALLBACK_URL}`)
  })
}

module.exports = app

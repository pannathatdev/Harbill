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
let duesSchemaReady = false
let telegramSchemaReady = false
const adminSessionAttempts = new Map()

function dbErrorMessage(err) {
  if (err?.code === "ERR_OUT_OF_RANGE" || /offset.*out of range/i.test(err?.message || "")) {
    return `${err.message}. Check DB_HOST and DB_PORT: use the classic MySQL port from your database provider, not a MySQL X/Admin/HTTPS port.`
  }
  return err.message
}

function publicDbHealthInfo() {
  const dbConfig = typeof db.getDebugInfo === "function" ? db.getDebugInfo() : undefined
  if (!dbConfig) return undefined
  return {
    source: dbConfig.source,
    ssl: Boolean(dbConfig.ssl)
  }
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

  await db.query(`
    CREATE TABLE IF NOT EXISTS pro_payment_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      days INT NOT NULL,
      reference VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      notification_sent TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pro_payment_requests_user_created (user_id, created_at),
      INDEX idx_pro_payment_requests_status_created (status, created_at),
      CONSTRAINT fk_pro_payment_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

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

async function ensureDuesSchema() {
  if (duesSchemaReady) return

  await db.query(`
    CREATE TABLE IF NOT EXISTS dues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      person_name VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      due_month CHAR(7) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'unpaid',
      note TEXT NULL,
      due_slip_id INT NULL,
      slip_name VARCHAR(255) NULL,
      slip_type VARCHAR(128) NULL,
      slip_uploaded_at DATETIME NULL,
      paid_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_dues_user_month (user_id, due_month),
      INDEX idx_dues_user_status (user_id, status),
      CONSTRAINT fk_dues_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS due_slips (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      payment_token VARCHAR(64) NULL,
      person_name VARCHAR(255) NOT NULL,
      due_month CHAR(7) NOT NULL,
      amount_paid DECIMAL(10,2) NULL,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(128) NOT NULL,
      file_data MEDIUMBLOB NOT NULL,
      file_hash CHAR(64) NULL,
      check_status VARCHAR(32) NOT NULL DEFAULT 'needs_review',
      check_note TEXT NULL,
      check_payload JSON NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_due_slips_user_month (user_id, due_month),
      INDEX idx_due_slips_token (payment_token),
      INDEX idx_due_slips_hash (user_id, file_hash),
      CONSTRAINT fk_due_slips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS due_payment_links (
      token VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL,
      person_name VARCHAR(255) NOT NULL,
      due_month CHAR(7) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NULL,
      INDEX idx_due_payment_links_user_month (user_id, due_month),
      CONSTRAINT fk_due_payment_links_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  const [dueColumns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'dues'
      AND COLUMN_NAME IN (
        'due_slip_id',
        'created_by_user_id',
        'debtor_user_id',
        'slip_uploaded_by_user_id',
        'created_by_telegram_id',
        'created_by_name',
        'creditor_name',
        'source',
        'approval_status',
        'telegram_chat_id',
        'telegram_message_id',
        'batch_token'
      )
  `)
  const existingDueColumns = new Set(dueColumns.map(column => column.COLUMN_NAME))
  if (!existingDueColumns.has("due_slip_id")) {
    await db.query("ALTER TABLE dues ADD COLUMN due_slip_id INT NULL AFTER note")
  }
  if (!existingDueColumns.has("created_by_user_id")) {
    await db.query("ALTER TABLE dues ADD COLUMN created_by_user_id INT NULL AFTER user_id")
  }
  if (!existingDueColumns.has("debtor_user_id")) {
    await db.query("ALTER TABLE dues ADD COLUMN debtor_user_id INT NULL AFTER created_by_user_id")
    await db.query("CREATE INDEX idx_dues_debtor_user ON dues (debtor_user_id)")
  }
  if (!existingDueColumns.has("slip_uploaded_by_user_id")) {
    await db.query("ALTER TABLE dues ADD COLUMN slip_uploaded_by_user_id INT NULL AFTER slip_uploaded_at")
  }
  if (!existingDueColumns.has("created_by_telegram_id")) {
    await db.query("ALTER TABLE dues ADD COLUMN created_by_telegram_id VARCHAR(64) NULL AFTER created_by_user_id")
  }
  if (!existingDueColumns.has("created_by_name")) {
    await db.query("ALTER TABLE dues ADD COLUMN created_by_name VARCHAR(255) NULL AFTER created_by_telegram_id")
  }
  if (!existingDueColumns.has("creditor_name")) {
    await db.query("ALTER TABLE dues ADD COLUMN creditor_name VARCHAR(255) NULL AFTER person_name")
  }
  if (!existingDueColumns.has("source")) {
    await db.query("ALTER TABLE dues ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'web' AFTER note")
  }
  if (!existingDueColumns.has("approval_status")) {
    await db.query("ALTER TABLE dues ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'approved' AFTER source")
  }
  if (!existingDueColumns.has("telegram_chat_id")) {
    await db.query("ALTER TABLE dues ADD COLUMN telegram_chat_id VARCHAR(64) NULL AFTER approval_status")
  }
  if (!existingDueColumns.has("telegram_message_id")) {
    await db.query("ALTER TABLE dues ADD COLUMN telegram_message_id VARCHAR(64) NULL AFTER telegram_chat_id")
  }
  if (!existingDueColumns.has("batch_token")) {
    await db.query("ALTER TABLE dues ADD COLUMN batch_token VARCHAR(64) NULL AFTER telegram_message_id")
    await db.query("CREATE INDEX idx_dues_batch_token ON dues (batch_token)")
  }

  const [slipColumns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'due_slips'
      AND COLUMN_NAME IN ('file_hash', 'check_status', 'check_note', 'check_payload')
  `)
  const existingSlipColumns = new Set(slipColumns.map(column => column.COLUMN_NAME))

  const [paymentLinkColumns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'due_payment_links'
      AND COLUMN_NAME = 'debtor_user_id'
  `)
  if (!paymentLinkColumns[0]) {
    await db.query("ALTER TABLE due_payment_links ADD COLUMN debtor_user_id INT NULL AFTER user_id")
    await db.query("CREATE INDEX idx_due_payment_links_debtor ON due_payment_links (debtor_user_id)")
  }
  if (!existingSlipColumns.has("file_hash")) {
    await db.query("ALTER TABLE due_slips ADD COLUMN file_hash CHAR(64) NULL AFTER file_data")
  }
  if (!existingSlipColumns.has("check_status")) {
    await db.query("ALTER TABLE due_slips ADD COLUMN check_status VARCHAR(32) NOT NULL DEFAULT 'needs_review' AFTER file_hash")
  }
  if (!existingSlipColumns.has("check_note")) {
    await db.query("ALTER TABLE due_slips ADD COLUMN check_note TEXT NULL AFTER check_status")
  }
  if (!existingSlipColumns.has("check_payload")) {
    await db.query("ALTER TABLE due_slips ADD COLUMN check_payload JSON NULL AFTER check_note")
  }

  duesSchemaReady = true
}

async function ensureTelegramSchema() {
  if (telegramSchemaReady) return

  await ensureDuesSchema()

  await db.query(`
    CREATE TABLE IF NOT EXISTS telegram_chats (
      chat_id VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NULL,
      type VARCHAR(32) NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_telegram_chats_user_id (user_id),
      CONSTRAINT fk_telegram_chats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS telegram_members (
      chat_id VARCHAR(64) NOT NULL,
      telegram_user_id VARCHAR(64) NOT NULL,
      user_id INT NULL,
      friend_name VARCHAR(255) NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'member',
      username VARCHAR(255) NULL,
      display_name VARCHAR(255) NULL,
      onboarding_message_id VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (chat_id, telegram_user_id),
      INDEX idx_telegram_members_user_id (user_id),
      INDEX idx_telegram_members_username (chat_id, username),
      CONSTRAINT fk_telegram_members_chat FOREIGN KEY (chat_id) REFERENCES telegram_chats(chat_id) ON DELETE CASCADE,
      CONSTRAINT fk_telegram_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  const [telegramMemberColumns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'telegram_members'
      AND COLUMN_NAME = 'onboarding_message_id'
  `)
  if (!telegramMemberColumns[0]) {
    await db.query("ALTER TABLE telegram_members ADD COLUMN onboarding_message_id VARCHAR(64) NULL AFTER display_name")
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS telegram_connect_tokens (
      token VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_telegram_connect_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS telegram_due_drafts (
      token CHAR(32) PRIMARY KEY,
      chat_id VARCHAR(64) NOT NULL,
      telegram_user_id VARCHAR(64) NOT NULL,
      owner_user_id INT NOT NULL,
      payload JSON NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_telegram_due_drafts_lookup (chat_id, telegram_user_id),
      INDEX idx_telegram_due_drafts_expires (expires_at),
      CONSTRAINT fk_telegram_due_drafts_chat FOREIGN KEY (chat_id) REFERENCES telegram_chats(chat_id) ON DELETE CASCADE,
      CONSTRAINT fk_telegram_due_drafts_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  telegramSchemaReady = true
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

function adminAttemptKey(req) {
  return `${req.user?.id || "anon"}:${req.ip || req.headers["x-forwarded-for"] || "unknown"}`
}

function checkAdminSessionAttempts(req) {
  const windowMs = 15 * 60 * 1000
  const maxAttempts = Math.min(Math.max(Number(process.env.ADMIN_SESSION_MAX_ATTEMPTS) || 5, 1), 50)
  const now = Date.now()
  const key = adminAttemptKey(req)
  const existing = adminSessionAttempts.get(key) || { count: 0, resetAt: now + windowMs }

  if (existing.resetAt <= now) {
    existing.count = 0
    existing.resetAt = now + windowMs
  }

  if (existing.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      maxAttempts
    }
  }

  adminSessionAttempts.set(key, existing)
  return { allowed: true, key, maxAttempts }
}

function recordAdminSessionFailure(key) {
  if (!key) return
  const attempt = adminSessionAttempts.get(key)
  if (!attempt) return
  attempt.count += 1
  adminSessionAttempts.set(key, attempt)
}

function clearAdminSessionFailures(key) {
  if (key) adminSessionAttempts.delete(key)
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

async function sendTelegramMessage(chatId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return null

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...options
      })
    })
    const data = await response.json().catch(() => null)
    return response.ok ? data?.result || null : null
  } catch (err) {
    console.error("Telegram send failed:", err.message)
    return null
  }
}

async function answerTelegramCallback(callbackQueryId, text = "") {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !callbackQueryId) return false
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text })
    })
    return response.ok
  } catch (err) {
    console.error("Telegram callback answer failed:", err.message)
    return false
  }
}

async function editTelegramMessage(chatId, messageId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId || !messageId) return false
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, ...options })
    })
    return response.ok
  } catch (err) {
    console.error("Telegram message edit failed:", err.message)
    return false
  }
}

async function deleteTelegramMessage(chatId, messageId) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId || !messageId) return false
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    })
    return response.ok
  } catch (err) {
    console.error("Telegram message delete failed:", err.message)
    return false
  }
}

function telegramName(user = {}) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username || String(user.id || "")
}

function telegramAdminIds() {
  return String(process.env.TELEGRAM_ADMIN_USER_IDS || "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
}

function telegramAllowedChatIds() {
  return String(process.env.TELEGRAM_ALLOWED_CHAT_IDS || process.env.TELEGRAM_ALLOWED_CHAT_ID || "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
}

function currentBangkokMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date())
  const year = parts.find(part => part.type === "year")?.value
  const month = parts.find(part => part.type === "month")?.value
  return `${year}-${month}`
}

function parseTelegramText(text = "") {
  const raw = String(text || "").trim()
  const [firstLine = "", ...followingLines] = raw.split(/\r?\n/)
  const cleanedFirstLine = firstLine.trim().replace(/\s+/g, " ")
  const [rawCommand = "", ...rest] = cleanedFirstLine.split(" ")
  const command = rawCommand.split("@")[0].toLowerCase()
  const body = [rest.join(" "), ...followingLines].filter(Boolean).join("\n").trim()
  return { command, args: rest, body, text: raw }
}

function parseTelegramBatch(body, defaultCreditor = "") {
  const lines = String(body || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  let creditor = defaultCreditor
  let month = currentBangkokMonth()
  const items = []

  for (const line of lines) {
    const setting = line.match(/^(creditor|เจ้าหนี้|คนรับเงิน|month|เดือน)\s*[:=]\s*(.+)$/i)
    if (setting) {
      if (/^(month|เดือน)$/i.test(setting[1])) month = setting[2].trim().slice(0, 7)
      else creditor = setting[2].trim()
      continue
    }

    const parts = line.split("|").map(value => value.trim())
    if (parts.length !== 3) return { error: `รูปแบบไม่ถูกต้อง: ${line}` }
    const [title, rawAmount, rawDebtors] = parts
    const amount = Number(rawAmount.replace(/,/g, ""))
    const debtors = [...new Set(rawDebtors.split(/[,，]/).map(name => name.trim().replace(/^@/, "")).filter(Boolean))]
    if (!title || !Number.isFinite(amount) || amount <= 0 || debtors.length === 0) {
      return { error: `ข้อมูลไม่ครบหรือยอดไม่ถูกต้อง: ${line}` }
    }
    items.push({ title, amount, debtors })
  }

  if (!creditor) return { error: "ยังไม่พบชื่อเจ้าหนี้ กรุณาเชื่อมบัญชีหรือตั้งค่า เจ้าหนี้: ชื่อ" }
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "เดือนต้องอยู่ในรูปแบบ YYYY-MM" }
  if (items.length === 0) return { error: "ยังไม่มีรายการ รูปแบบคือ ชื่อรายการ | ยอดรวม | คน1,คน2" }
  if (items.length > 20) return { error: "เพิ่มได้สูงสุด 20 รายการต่อครั้ง" }

  const normalizedItems = items.map(item => {
    const debtors = item.debtors.filter(name => name !== creditor)
    if (debtors.length === 0) return { ...item, debtors, allocations: [] }
    const totalCents = Math.round(item.amount * 100)
    const baseCents = Math.floor(totalCents / debtors.length)
    const remainder = totalCents - (baseCents * debtors.length)
    const allocations = debtors.map((name, index) => ({
      name,
      amount: (baseCents + (index < remainder ? 1 : 0)) / 100
    }))
    return { ...item, debtors, allocations }
  })
  if (normalizedItems.some(item => item.debtors.length === 0)) {
    return { error: "อย่างน้อยหนึ่งรายการไม่มีลูกหนี้หลังตัดชื่อเจ้าหนี้ออก" }
  }
  return { creditor, month, items: normalizedItems }
}

function parseTelegramAdd(body, defaultCreditor = "") {
  const tokens = body.split(" ").filter(Boolean)
  const byIndex = tokens.findIndex(token => /^by$/i.test(token) || token === "จ่ายโดย")
  const splitIndex = tokens.findIndex(token => /^split$/i.test(token) || token === "หาร")
  const monthIndex = tokens.findIndex(token => /^month$/i.test(token) || token === "เดือน")
  const amountIndex = tokens.findIndex(token => !Number.isNaN(Number(String(token).replace(/,/g, ""))))

  if (amountIndex <= 0 || splitIndex === -1 || splitIndex <= amountIndex) return null
  if (byIndex !== -1 && splitIndex <= byIndex + 1) return null

  const title = tokens.slice(0, amountIndex).join(" ")
  const amount = Number(tokens[amountIndex].replace(/,/g, ""))
  const creditor = byIndex !== -1 ? tokens[byIndex + 1] : defaultCreditor
  const month = monthIndex !== -1 ? tokens[monthIndex + 1] : currentBangkokMonth()
  const splitEnd = monthIndex !== -1 ? monthIndex : tokens.length
  const splitWith = tokens.slice(splitIndex + 1, splitEnd)
    .flatMap(value => value.split(","))
    .map(value => value.trim())
    .filter(Boolean)

  if (!title || !Number.isFinite(amount) || amount <= 0 || !creditor || !/^\d{4}-\d{2}$/.test(month) || splitWith.length === 0) {
    return null
  }

  return { title, amount, creditor, splitWith, month }
}

async function getTelegramContext(message) {
  await ensureTelegramSchema()

  const chat = message.chat || {}
  const from = message.from || {}
  const chatId = String(chat.id || "")
  const telegramUserId = String(from.id || "")
  if (!chatId || !telegramUserId) return null

  const allowedChatIds = telegramAllowedChatIds()
  if (allowedChatIds.length > 0 && !allowedChatIds.includes(chatId)) {
    return { blocked: true, chatId, reason: "This Telegram chat is not allowed." }
  }

  const [chatRows] = await db.query("SELECT * FROM telegram_chats WHERE chat_id=? AND enabled=1", [chatId])
  const linkedChat = chatRows[0] || null
  let [memberRows] = linkedChat
    ? await db.query("SELECT * FROM telegram_members WHERE chat_id=? AND telegram_user_id=?", [chatId, telegramUserId])
    : [[]]
  if (linkedChat && !memberRows[0] && !from.is_bot) {
    const displayName = telegramName(from)
    await upsertTelegramMember({
      chatId,
      telegramUserId,
      friendName: displayName || from.username || `tg-${telegramUserId}`,
      role: "member",
      username: from.username || null,
      displayName
    })
    const mention = from.username ? `@${from.username}` : displayName
    const sent = await sendTelegramMessage(chatId, [
      `👋 ${mention || "สมาชิกใหม่"} กรุณาเชื่อมบัญชี Harbill ก่อนใช้งาน`,
      "เชื่อมเพียงครั้งเดียว หลังเชื่อมสำเร็จข้อความนี้จะหายไปอัตโนมัติ"
    ].join("\n"), {
      reply_markup: {
        inline_keyboard: [[
          { text: "🔗 เชื่อมบัญชีตอนนี้", url: `${CLIENT_URL}/telegram/connect` }
        ]]
      }
    })
    if (sent?.message_id) {
      await db.query(`
        UPDATE telegram_members SET onboarding_message_id=?
        WHERE chat_id=? AND telegram_user_id=? AND user_id IS NULL
      `, [String(sent.message_id), chatId, telegramUserId])
    }
    ;[memberRows] = await db.query(
      "SELECT * FROM telegram_members WHERE chat_id=? AND telegram_user_id=?",
      [chatId, telegramUserId]
    )
  }
  const member = memberRows[0] || null
  const envAdmin = telegramAdminIds().includes(telegramUserId)
  const isAdmin = envAdmin || member?.role === "admin"

  return {
    chatId,
    chat,
    from,
    telegramUserId,
    linkedChat,
    member,
    isAdmin,
    ownerUserId: linkedChat?.user_id || null
  }
}

async function upsertTelegramMember({ chatId, telegramUserId, userId = null, friendName = null, role = "member", username = null, displayName = null }) {
  await db.query(`
    INSERT INTO telegram_members (chat_id, telegram_user_id, user_id, friend_name, role, username, display_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      user_id=COALESCE(VALUES(user_id), user_id),
      friend_name=COALESCE(VALUES(friend_name), friend_name),
      role=VALUES(role),
      username=VALUES(username),
      display_name=VALUES(display_name)
  `, [chatId, telegramUserId, userId, friendName, role, username, displayName])
}

async function telegramCanManageDue(context, due) {
  if (!context || !due) return false
  if (context.isAdmin) return true
  if (due.created_by_user_id && context.member?.user_id && Number(due.created_by_user_id) === Number(context.member.user_id)) return true
  return Boolean(due.created_by_telegram_id && String(due.created_by_telegram_id) === context.telegramUserId)
}

function verifyTelegramWebAppInitData(initData) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !initData) return null

  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null
  params.delete("hash")

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest()
  const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")
  const hashBuffer = Buffer.from(hash, "hex")
  const calculatedBuffer = Buffer.from(calculated, "hex")
  if (hashBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) return null

  const authDate = Number(params.get("auth_date") || 0)
  const maxAgeSeconds = Math.min(Math.max(Number(process.env.TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS) || 86400, 60), 604800)
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null

  let user = null
  try {
    user = JSON.parse(params.get("user") || "null")
  } catch {
    user = null
  }
  if (!user?.id) return null

  return {
    user,
    queryId: params.get("query_id") || "",
    chatType: params.get("chat_type") || "",
    chatInstance: params.get("chat_instance") || "",
  }
}

async function getTelegramWebAppContext(initData, chatId) {
  await ensureTelegramSchema()
  const verified = verifyTelegramWebAppInitData(initData)
  if (!verified) return { status: 401, error: "Invalid Telegram session" }

  const normalizedChatId = String(chatId || "").trim()
  const telegramUserId = String(verified.user.id)
  const allowedChatIds = telegramAllowedChatIds()
  if (allowedChatIds.length > 0 && !allowedChatIds.includes(normalizedChatId)) {
    return { status: 403, error: "This Telegram chat is not allowed" }
  }

  const [chatRows] = await db.query("SELECT * FROM telegram_chats WHERE chat_id=? AND enabled=1", [normalizedChatId])
  const linkedChat = chatRows[0]
  if (!linkedChat) return { status: 404, error: "Telegram chat is not connected" }

  const [memberRows] = await db.query(
    "SELECT * FROM telegram_members WHERE chat_id=? AND telegram_user_id=?",
    [normalizedChatId, telegramUserId]
  )
  const member = memberRows[0]
  if (!member?.user_id) return { status: 403, error: "Please connect your Google account first" }

  return {
    status: 200,
    verified,
    chatId: normalizedChatId,
    telegramUserId,
    linkedChat,
    member,
    isAdmin: member.role === "admin" || telegramAdminIds().includes(telegramUserId),
    ownerUserId: linkedChat.user_id,
  }
}

function formatAdminTime(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(date)
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
  const dbConfig = publicDbHealthInfo()

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
    res.status(500).json({
      ok: false,
      db: false,
      error: process.env.NODE_ENV === "production" ? "Database health check failed" : dbErrorMessage(err),
      googleAuthReady,
      googleCallbackUrl: GOOGLE_CALLBACK_URL,
      dbConfig
    })
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

app.post("/telegram/connect-token", requireAuth, async (req, res) => {
  await ensureTelegramSchema()
  const token = crypto.randomBytes(16).toString("hex")
  const expiresMinutes = Math.min(Math.max(Number(process.env.TELEGRAM_CONNECT_TOKEN_MINUTES) || 15, 1), 1440)
  await db.query(
    "INSERT INTO telegram_connect_tokens (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
    [token, req.user.id, expiresMinutes]
  )
  const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || "harbill_group_bot")
    .replace(/^@/, "")
    .trim()
  res.json({
    token,
    command: `/connect ${token}`,
    expiresMinutes,
    deepLink: `https://t.me/${botUsername}?start=connect_${token}`
  })
})

app.post("/telegram/web-app/auth", async (req, res) => {
  await ensureTelegramSchema()
  const verified = verifyTelegramWebAppInitData(req.body?.initData)
  if (!verified) return res.status(401).json({ error: "Invalid Telegram session" })

  const [rows] = await db.query(`
    SELECT u.*
    FROM telegram_members tm
    JOIN users u ON u.id=tm.user_id
    WHERE tm.telegram_user_id=? AND tm.user_id IS NOT NULL
    ORDER BY tm.updated_at DESC
    LIMIT 1
  `, [String(verified.user.id)])
  const user = rows[0]
  if (!user) {
    return res.status(403).json({ error: "กรุณาเชื่อม Telegram กับ Harbill หนึ่งครั้งก่อน" })
  }
  res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar }
  })
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

  const attempt = checkAdminSessionAttempts(req)
  if (!attempt.allowed) {
    return res.status(429).json({
      error: `ลองรหัสหลังบ้านผิดหลายครั้ง กรุณารอประมาณ ${Math.ceil(attempt.retryAfterSeconds / 60)} นาที`,
      code: "ADMIN_SESSION_RATE_LIMIT",
      retryAfterSeconds: attempt.retryAfterSeconds
    })
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
    recordAdminSessionFailure(attempt.key)
    return res.status(401).json({ error: "Invalid admin password or authenticator code" })
  }

  clearAdminSessionFailures(attempt.key)

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

app.post("/admin/pro/activate", requireAuth, requireAdmin, async (req, res) => {
  await ensureMonetizationSchema()
  const userId = Number(req.body.userId)
  const days = Math.min(Math.max(Number(req.body.days) || 30, 1), 366)

  if (!userId) return res.status(400).json({ error: "Missing user id" })

  await db.query(
    "UPDATE users SET plan='pro', pro_until=DATE_ADD(GREATEST(COALESCE(pro_until, NOW()), NOW()), INTERVAL ? DAY) WHERE id=?",
    [days, userId]
  )

  const [rows] = await db.query("SELECT id, email, name, plan, pro_until FROM users WHERE id=?", [userId])
  if (!rows[0]) return res.status(404).json({ error: "User not found" })

  await notifyTelegram([
    "เปิด Harbill Pro โดยแอดมิน",
    `แอดมิน: ${req.user.email || "-"}`,
    `ผู้ใช้: ${rows[0].name || "-"} (${rows[0].email || "-"})`,
    `จำนวนวัน: ${days}`,
    `หมดอายุ: ${rows[0].pro_until ? formatAdminTime(new Date(rows[0].pro_until)) : "-"}`,
    `เวลา: ${formatAdminTime()}`
  ].join("\n"))

  res.json({ ok: true, user: { ...rows[0], isPro: userPlan(rows[0]).isPro } })
})

app.get("/billing/pro-status", requireAuth, async (req, res) => {
  await ensureMonetizationSchema()
  const [rows] = await db.query("SELECT plan, pro_until FROM users WHERE id=?", [req.user.id])
  res.json(userPlan(rows[0]))
})

app.post("/billing/pro/request", requireAuth, async (req, res) => {
  await ensureMonetizationSchema()
  const days = Math.min(Math.max(Number(process.env.PRO_PLAN_DAYS) || 30, 1), 366)
  const reference = String(req.body.reference || "").trim()
  const cooldownMinutes = Math.min(Math.max(Number(process.env.PRO_REQUEST_COOLDOWN_MINUTES) || 5, 1), 1440)
  const dailyLimit = Math.min(Math.max(Number(process.env.PRO_REQUEST_DAILY_LIMIT) || 5, 1), 50)

  const [[recent]] = await db.query(
    `SELECT id, created_at
     FROM pro_payment_requests
     WHERE user_id=?
       AND created_at >= DATE_SUB(NOW(), INTERVAL ${cooldownMinutes} MINUTE)
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.user.id]
  )
  if (recent) {
    return res.status(429).json({
      error: `ส่งแจ้งโอนล่าสุดไปแล้ว กรุณารอประมาณ ${cooldownMinutes} นาที ก่อนส่งซ้ำครับ`,
      code: "PRO_REQUEST_COOLDOWN",
      retryAfterMinutes: cooldownMinutes
    })
  }

  const [[today]] = await db.query(
    `SELECT COUNT(*) total
     FROM pro_payment_requests
     WHERE user_id=? AND DATE(created_at)=CURRENT_DATE`,
    [req.user.id]
  )
  if (Number(today?.total || 0) >= dailyLimit) {
    return res.status(429).json({
      error: `วันนี้ส่งแจ้งโอนครบ ${dailyLimit} ครั้งแล้วครับ ถ้าโอนแล้วกรุณารอแอดมินตรวจสอบ`,
      code: "PRO_REQUEST_DAILY_LIMIT",
      dailyLimit
    })
  }

  const [created] = await db.query(
    "INSERT INTO pro_payment_requests (user_id, days, reference, status) VALUES (?, ?, ?, 'pending')",
    [req.user.id, days, reference || null]
  )

  const notificationSent = await notifyTelegram([
    "คำขอแจ้งโอน Harbill Pro",
    `ผู้ใช้: ${req.user.name || "-"} (${req.user.email || "-"})`,
    `จำนวนวัน: ${days}`,
    `เลขอ้างอิง: ${reference || "-"}`,
    "สถานะ: รอตรวจสอบยอดโอน",
    `เวลา: ${formatAdminTime()}`
  ].join("\n"))

  await db.query(
    "UPDATE pro_payment_requests SET notification_sent=? WHERE id=?",
    [notificationSent ? 1 : 0, created.insertId]
  )

  res.json({ ok: true, reference, notificationSent, status: "pending" })
})

app.post("/billing/pro/mock-activate", requireAuth, requireAdmin, async (req, res) => {
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
  const notificationSent = await notifyTelegram([
    "เปิด Harbill Pro แล้ว",
    `ผู้ใช้: ${req.user.name || "-"} (${req.user.email || "-"})`,
    `จำนวนวัน: ${days}`,
    `เลขอ้างอิง: ${reference || "-"}`,
    `หมดอายุ: ${rows[0]?.pro_until ? formatAdminTime(new Date(rows[0].pro_until)) : "-"}`,
    `เวลา: ${formatAdminTime()}`
  ].join("\n"))

  res.json({ ok: true, reference, notificationSent, ...userPlan(rows[0]) })
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
  const limit = Math.min(Math.max(Number(req.query.limit) || 0, 0), 200)
  const withMeta = req.query.meta === "1"
  const [countRows] = withMeta
    ? await db.query("SELECT COUNT(*) total FROM rounds WHERE user_id=?", [req.user.id])
    : [[]]
  const [rounds] = limit > 0
    ? await db.query("SELECT * FROM rounds WHERE user_id=? ORDER BY created_at DESC LIMIT ?", [req.user.id, limit])
    : await db.query("SELECT * FROM rounds WHERE user_id=? ORDER BY created_at DESC", [req.user.id])
  const roundIds = rounds.map(r => r.id)
  if (roundIds.length === 0) {
    return res.json(withMeta ? { rounds: [], total: Number(countRows[0]?.total || 0), hasMore: false } : [])
  }

  const [members] = await db.query(`SELECT * FROM round_members WHERE round_id IN (${roundIds.map(() => "?").join(",")})`, roundIds)
  const [items] = await db.query(`SELECT * FROM items WHERE round_id IN (${roundIds.map(() => "?").join(",")})`, roundIds)
  const itemIds = items.map(i => i.id)
  const splits = itemIds.length > 0
    ? (await db.query(`SELECT * FROM item_splits WHERE item_id IN (${itemIds.map(() => "?").join(",")})`, itemIds))[0]
    : []

  const membersByRound = new Map()
  members.forEach(member => {
    const list = membersByRound.get(member.round_id) || []
    list.push(member.friend_name)
    membersByRound.set(member.round_id, list)
  })

  const splitsByItem = new Map()
  splits.forEach(split => {
    const list = splitsByItem.get(split.item_id) || []
    list.push(split.friend_name)
    splitsByItem.set(split.item_id, list)
  })

  const itemsByRound = new Map()
  items.forEach(item => {
    const list = itemsByRound.get(item.round_id) || []
    list.push({
      ...item,
      price: parseFloat(item.price),
      splitWith: splitsByItem.get(item.id) || []
    })
    itemsByRound.set(item.round_id, list)
  })

  const payload = rounds.map(r => ({
    ...r,
    joiners: membersByRound.get(r.id) || [],
    items: itemsByRound.get(r.id) || []
  }))

  res.json(withMeta
    ? { rounds: payload, total: Number(countRows[0]?.total || 0), hasMore: Number(countRows[0]?.total || 0) > payload.length }
    : payload
  )
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

// ── DUES ──────────────────────────────────────────────────────
function mapDue(row) {
  const hasStoredSlip = Boolean(row.due_slip_id || row.slip_id)
  return {
    id: row.id,
    person: row.person_name,
    title: row.title,
    amount: parseFloat(row.amount),
    month: row.due_month,
    status: row.status,
    note: row.note || "",
    slipName: row.slip_name || "",
    slipType: row.slip_type || "",
    slipUrl: hasStoredSlip ? `${API_BASE_URL}/dues/${row.id}/slip` : "",
    slipCheckStatus: row.check_status || row.slip_check_status || "",
    slipCheckNote: row.check_note || row.slip_check_note || "",
    creditor: row.creditor_name || "",
    source: row.source || "web",
    approvalStatus: row.approval_status || "approved",
    createdByUserId: row.created_by_user_id || null,
    debtorUserId: row.debtor_user_id || null,
    slipUploadedByUserId: row.slip_uploaded_by_user_id || null,
    createdByTelegramId: row.created_by_telegram_id || "",
    createdByName: row.created_by_name || "",
    telegramChatId: row.telegram_chat_id || "",
    telegramMessageId: row.telegram_message_id || "",
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function safeDownloadName(name) {
  return String(name || "slip")
    .replace(/[\\/:*?"<>|\r\n]+/g, "_")
    .slice(0, 180) || "slip"
}

function parseSlipCheckBody(body) {
  if (!body?.slipCheck) return null
  try {
    return typeof body.slipCheck === "string" ? JSON.parse(body.slipCheck) : body.slipCheck
  } catch {
    return null
  }
}

function normalizeSlipCheck(input, fileHash, duplicate) {
  const raw = input && typeof input === "object" ? input : {}
  const amountMatches = raw.amountMatches === true
  const amountFound = raw.amountFound !== undefined && raw.amountFound !== null ? Number(raw.amountFound) : null
  const barcodeText = String(raw.barcodeText || "").slice(0, 2000)
  const barcodeSupported = raw.barcodeSupported !== false

  if (duplicate) {
    return {
      status: "duplicate",
      note: "พบสลิปไฟล์เดียวกันเคยถูกอัปโหลดแล้ว",
      payload: { ...raw, fileHash, duplicate: true, barcodeText },
    }
  }

  if (amountMatches) {
    return {
      status: "amount_matched",
      note: "อ่านข้อมูลจากสลิปแล้วพบยอดตรงกับรายการ แต่ยังไม่ได้ตรวจเงินจริงกับธนาคาร",
      payload: { ...raw, fileHash, barcodeText, amountFound },
    }
  }

  if (amountFound !== null && !Number.isNaN(amountFound)) {
    return {
      status: "amount_mismatch",
      note: "อ่านยอดจากสลิปได้ แต่ยอดไม่ตรงกับรายการ",
      payload: { ...raw, fileHash, barcodeText, amountFound },
    }
  }

  return {
    status: barcodeSupported ? "needs_review" : "reader_unavailable",
    note: barcodeSupported
      ? "ยังอ่านยอดจากสลิปไม่ได้ เก็บสลิปไว้ให้เจ้าของตรวจ"
      : "อุปกรณ์นี้ยังไม่รองรับตัวอ่าน QR ฟรี เก็บสลิปไว้ให้เจ้าของตรวจ",
    payload: { ...raw, fileHash, barcodeText },
  }
}

async function createDueSlip({ userId, token = null, person, month, amount, file, clientCheck = null }) {
  const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex")
  const [duplicates] = await db.query(
    "SELECT id FROM due_slips WHERE user_id=? AND file_hash=? LIMIT 1",
    [userId, fileHash]
  )
  const slipCheck = normalizeSlipCheck(clientCheck, fileHash, Boolean(duplicates[0]))
  const [result] = await db.query(`
    INSERT INTO due_slips (user_id, payment_token, person_name, due_month, amount_paid, file_name, file_type, file_data, file_hash, check_status, check_note, check_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    token,
    person,
    month,
    Number.isFinite(Number(amount)) ? Number(amount) : null,
    file.originalname,
    file.mimetype || "application/octet-stream",
    file.buffer,
    fileHash,
    slipCheck.status,
    slipCheck.note,
    JSON.stringify(slipCheck.payload)
  ])
  return result.insertId
}

async function paymentPayloadForUser(token, viewerUserId) {
  const [links] = await db.query("SELECT * FROM due_payment_links WHERE token=?", [token])
  const link = links[0]
  if (!link) return { status: 404, error: "Payment link not found" }
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return { status: 410, error: "Payment link expired" }
  }

  let debtorUserId = link.debtor_user_id ? Number(link.debtor_user_id) : null
  if (!debtorUserId) {
    const [matches] = await db.query(`
      SELECT tm.user_id
      FROM dues d
      JOIN telegram_members tm
        ON tm.chat_id=d.telegram_chat_id
       AND tm.friend_name=d.person_name
      WHERE d.user_id=? AND d.person_name=? AND d.due_month=?
        AND tm.user_id=? AND tm.user_id IS NOT NULL
      LIMIT 1
    `, [link.user_id, link.person_name, link.due_month, viewerUserId])
    if (matches[0]?.user_id) {
      debtorUserId = Number(matches[0].user_id)
      await db.query("UPDATE due_payment_links SET debtor_user_id=? WHERE token=?", [debtorUserId, token])
      await db.query(`
        UPDATE dues SET debtor_user_id=?
        WHERE user_id=? AND person_name=? AND due_month=? AND debtor_user_id IS NULL
      `, [debtorUserId, link.user_id, link.person_name, link.due_month])
    }
  }
  if (!debtorUserId || debtorUserId !== Number(viewerUserId)) {
    return { status: 403, error: "รายการนี้ไม่ได้ผูกกับบัญชีของคุณ กรุณาเชื่อม Telegram กับ Harbill ก่อน" }
  }

  const [items] = await db.query(`
    SELECT d.id, d.person_name, d.debtor_user_id, d.title, d.amount, d.due_month, d.status, d.note, d.due_slip_id,
      d.slip_name, d.slip_type, d.slip_uploaded_at, d.paid_at, d.created_at, d.updated_at,
      s.check_status, s.check_note
    FROM dues d
    LEFT JOIN due_slips s ON s.id = d.due_slip_id
    WHERE d.user_id=? AND d.person_name=? AND d.due_month=? AND d.status <> 'paid'
      AND d.debtor_user_id=?
    ORDER BY d.created_at DESC
  `, [link.user_id, link.person_name, link.due_month, debtorUserId])

  const [ownerRows] = await db.query(`
    SELECT friend_name, promptpay, display_name
    FROM payment_info
    WHERE user_id=? AND promptpay IS NOT NULL AND promptpay <> ''
    ORDER BY updated_at DESC
    LIMIT 1
  `, [link.user_id])

  return {
    status: 200,
    body: {
      person: link.person_name,
      month: link.due_month,
      items: items.map(mapDue),
      total: items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      payment: ownerRows[0] || null
    },
    link
  }
}

app.get("/dues", requireAuth, async (req, res) => {
  await ensureDuesSchema()
  const month = String(req.query.month || "").slice(0, 7)
  const status = String(req.query.status || "")
  const clauses = ["user_id=?"]
  const values = [req.user.id]

  if (/^\d{4}-\d{2}$/.test(month)) {
    clauses.push("due_month=?")
    values.push(month)
  }
  if (["unpaid", "pending", "paid"].includes(status)) {
    clauses.push("status=?")
    values.push(status)
  }

  const [rows] = await db.query(`
    SELECT d.*, s.check_status, s.check_note
    FROM dues d
    LEFT JOIN due_slips s ON s.id = d.due_slip_id
    WHERE ${clauses.map(clause => `d.${clause}`).join(" AND ")}
    ORDER BY d.due_month DESC, d.person_name ASC, d.created_at DESC
  `, values)
  res.json(rows.map(mapDue))
})

app.post("/dues", requireAuth, async (req, res) => {
  await ensureDuesSchema()
  const person = String(req.body.person || "").trim()
  const title = String(req.body.title || "").trim()
  const amount = parseFloat(req.body.amount)
  const month = String(req.body.month || "").trim().slice(0, 7)
  const note = String(req.body.note || "").trim()
  const creditor = String(req.body.creditor || req.body.creditor_name || "").trim()

  if (!person || !title || Number.isNaN(amount) || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Invalid due item" })
  }

  const [result] = await db.query(`
    INSERT INTO dues (user_id, created_by_user_id, created_by_name, person_name, creditor_name, title, amount, due_month, status, note, source, approval_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, 'web', 'approved')
  `, [req.user.id, req.user.id, req.user.name || null, person, creditor || null, title, amount, month, note || null])

  const [rows] = await db.query("SELECT * FROM dues WHERE id=? AND user_id=?", [result.insertId, req.user.id])
  res.json(mapDue(rows[0]))
})

app.patch("/dues/:id", requireAuth, async (req, res) => {
  await ensureDuesSchema()
  const fields = []
  const values = []

  if (req.body.person !== undefined) {
    const person = String(req.body.person || "").trim()
    if (!person) return res.status(400).json({ error: "Invalid person" })
    fields.push("person_name=?")
    values.push(person)
  }
  if (req.body.title !== undefined) {
    const title = String(req.body.title || "").trim()
    if (!title) return res.status(400).json({ error: "Invalid title" })
    fields.push("title=?")
    values.push(title)
  }
  if (req.body.amount !== undefined) {
    const amount = parseFloat(req.body.amount)
    if (Number.isNaN(amount)) return res.status(400).json({ error: "Invalid amount" })
    fields.push("amount=?")
    values.push(amount)
  }
  if (req.body.month !== undefined) {
    const month = String(req.body.month || "").trim().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Invalid month" })
    fields.push("due_month=?")
    values.push(month)
  }
  if (req.body.note !== undefined) {
    fields.push("note=?")
    values.push(String(req.body.note || "").trim() || null)
  }
  if (req.body.status !== undefined) {
    const status = String(req.body.status || "")
    if (!["unpaid", "pending", "paid"].includes(status)) return res.status(400).json({ error: "Invalid status" })
    fields.push("status=?")
    values.push(status)
    fields.push("paid_at=?")
    values.push(status === "paid" ? new Date() : null)
  }

  if (fields.length === 0) return res.status(400).json({ error: "No changes" })

  values.push(req.params.id, req.user.id)
  await db.query(`UPDATE dues SET ${fields.join(", ")} WHERE id=? AND user_id=?`, values)
  const [rows] = await db.query("SELECT * FROM dues WHERE id=? AND user_id=?", [req.params.id, req.user.id])
  if (!rows[0]) return res.status(404).json({ error: "Due item not found" })
  res.json(mapDue(rows[0]))
})

app.post("/dues/:id/slip", requireAuth, upload.single("slip"), async (req, res) => {
  await ensureDuesSchema()
  if (!req.file) return res.status(400).json({ error: "Slip file required" })
  const [dueRows] = await db.query("SELECT * FROM dues WHERE id=? AND user_id=?", [req.params.id, req.user.id])
  const due = dueRows[0]
  if (!due) return res.status(404).json({ error: "Due item not found" })
  const slipId = await createDueSlip({
    userId: req.user.id,
    person: due.person_name,
    month: due.due_month,
    amount: due.amount,
    file: req.file,
    clientCheck: parseSlipCheckBody(req.body)
  })
  await db.query(`
    UPDATE dues
    SET status='pending', due_slip_id=?, slip_name=?, slip_type=?, slip_uploaded_at=NOW()
    WHERE id=? AND user_id=?
  `, [slipId, req.file.originalname, req.file.mimetype, req.params.id, req.user.id])
  const [rows] = await db.query(`
    SELECT d.*, s.check_status, s.check_note
    FROM dues d
    LEFT JOIN due_slips s ON s.id = d.due_slip_id
    WHERE d.id=? AND d.user_id=?
  `, [req.params.id, req.user.id])
  res.json(mapDue(rows[0]))
})

app.get("/dues/:id/slip", requireAuth, async (req, res) => {
  await ensureDuesSchema()
  const [rows] = await db.query(`
    SELECT s.file_name, s.file_type, s.file_data
    FROM dues d
    JOIN due_slips s ON s.id = d.due_slip_id
    WHERE d.id=? AND d.user_id=?
    LIMIT 1
  `, [req.params.id, req.user.id])
  const slip = rows[0]
  if (!slip) return res.status(404).json({ error: "Slip not found" })
  res.setHeader("Content-Type", slip.file_type || "application/octet-stream")
  res.setHeader("Content-Disposition", `inline; filename="${safeDownloadName(slip.file_name)}"`)
  res.send(slip.file_data)
})

app.post("/dues/pay-link", requireAuth, async (req, res) => {
  await ensureDuesSchema()
  const person = String(req.body.person || "").trim()
  const month = String(req.body.month || "").trim().slice(0, 7)
  if (!person || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Invalid payment link request" })
  }

  const [existing] = await db.query(
    "SELECT token FROM due_payment_links WHERE user_id=? AND person_name=? AND due_month=? ORDER BY created_at DESC LIMIT 1",
    [req.user.id, person, month]
  )
  const token = existing[0]?.token || crypto.randomBytes(18).toString("hex")

  if (!existing[0]) {
    await db.query(
      "INSERT INTO due_payment_links (token, user_id, person_name, due_month) VALUES (?, ?, ?, ?)",
      [token, req.user.id, person, month]
    )
  }

  res.json({ token, url: `${CLIENT_URL}/pay/${token}?name=${encodeURIComponent(person)}` })
})

app.delete("/dues/:id", requireAuth, async (req, res) => {
  await ensureDuesSchema()
  await db.query("DELETE FROM dues WHERE id=? AND user_id=?", [req.params.id, req.user.id])
  res.json({ ok: true })
})

app.get("/pay/:token", requireAuth, async (req, res) => {
  await ensureDuesSchema()
  const token = String(req.params.token || "")
  const result = await paymentPayloadForUser(token, req.user.id)
  if (result.status !== 200) return res.status(result.status).json({ error: result.error })
  res.json(result.body)
})

app.post("/pay/:token/slip", requireAuth, upload.single("slip"), async (req, res) => {
  await ensureDuesSchema()
  if (!req.file) return res.status(400).json({ error: "Slip file required" })
  const token = String(req.params.token || "")
  const result = await paymentPayloadForUser(token, req.user.id)
  if (result.status !== 200) return res.status(result.status).json({ error: result.error })
  const { link, body } = result
  if (!body.items.length || Number(body.total || 0) <= 0) {
    return res.status(400).json({ error: "No unpaid items for this payment link" })
  }

  const slipId = await createDueSlip({
    userId: link.user_id,
    token,
    person: link.person_name,
    month: link.due_month,
    amount: body.total,
    file: req.file,
    clientCheck: parseSlipCheckBody(req.body)
  })
  await db.query(`
    UPDATE dues
    SET status='pending', due_slip_id=?, slip_name=?, slip_type=?, slip_uploaded_at=NOW(),
        slip_uploaded_by_user_id=?
    WHERE user_id=? AND person_name=? AND due_month=? AND debtor_user_id=? AND status <> 'paid'
  `, [slipId, req.file.originalname, req.file.mimetype, req.user.id,
    link.user_id, link.person_name, link.due_month, req.user.id])

  const [telegramChats] = await db.query(`
    SELECT DISTINCT telegram_chat_id
    FROM dues
    WHERE user_id=? AND person_name=? AND due_month=? AND telegram_chat_id IS NOT NULL
  `, [link.user_id, link.person_name, link.due_month])
  await Promise.all(telegramChats.map(row => sendTelegramMessage(row.telegram_chat_id, [
    `📎 ${link.person_name} ส่งสลิปแล้ว`,
    `ยอดรวม ${Number(body.total).toFixed(2)} บาท`,
    `เดือน ${link.due_month}`,
    "เจ้าหนี้ตรวจสอบสลิปได้ใน Harbill"
  ].join("\n"), {
    reply_markup: {
      inline_keyboard: [[{ text: "🔎 ตรวจสลิป", url: `${CLIENT_URL}/dues` }]]
    }
  })))

  const fresh = await paymentPayloadForUser(token, req.user.id)
  res.json({ ok: true, ...fresh.body })
})

app.post("/pay/:token/items/:id/slip", requireAuth, upload.single("slip"), async (req, res) => {
  await ensureDuesSchema()
  if (!req.file) return res.status(400).json({ error: "Slip file required" })
  const token = String(req.params.token || "")
  const result = await paymentPayloadForUser(token, req.user.id)
  if (result.status !== 200) return res.status(result.status).json({ error: result.error })
  const { link } = result
  const [dueRows] = await db.query(`
    SELECT *
    FROM dues
    WHERE id=? AND user_id=? AND person_name=? AND due_month=? AND debtor_user_id=? AND status <> 'paid'
    LIMIT 1
  `, [req.params.id, link.user_id, link.person_name, link.due_month, req.user.id])
  const due = dueRows[0]
  if (!due) return res.status(404).json({ error: "Due item not found for this payment link" })

  const slipId = await createDueSlip({
    userId: link.user_id,
    token,
    person: link.person_name,
    month: link.due_month,
    amount: due.amount,
    file: req.file,
    clientCheck: parseSlipCheckBody(req.body)
  })
  await db.query(`
    UPDATE dues
    SET status='pending', due_slip_id=?, slip_name=?, slip_type=?, slip_uploaded_at=NOW(),
        slip_uploaded_by_user_id=?
    WHERE id=? AND user_id=?
  `, [slipId, req.file.originalname, req.file.mimetype, req.user.id, due.id, link.user_id])

  if (due.telegram_chat_id) {
    await sendTelegramMessage(due.telegram_chat_id, [
      `📎 ${link.person_name} ส่งสลิปแล้ว`,
      `${due.title} ${Number(due.amount).toFixed(2)} บาท`,
      "เจ้าหนี้ตรวจสอบสลิปได้ใน Harbill"
    ].join("\n"), {
      reply_markup: {
        inline_keyboard: [[{ text: "🔎 ตรวจสลิป", url: `${CLIENT_URL}/dues` }]]
      }
    })
  }

  const fresh = await paymentPayloadForUser(token, req.user.id)
  res.json({ ok: true, ...fresh.body })
})

// ── SCAN ──────────────────────────────────────────────────────
// TELEGRAM
async function handleTelegramConnect(context, token) {
  if (!token) return "Use /connect <token> from your Harbill account."

  const [tokenRows] = await db.query(`
    SELECT t.*, u.name, u.email
    FROM telegram_connect_tokens t
    JOIN users u ON u.id=t.user_id
    WHERE t.token=? AND t.used_at IS NULL AND t.expires_at > NOW()
    LIMIT 1
  `, [token])
  const row = tokenRows[0]
  if (!row) return "This connect token is invalid or expired."

  const chatTitle = context.chat.title || context.chat.username || context.chat.first_name || String(context.chatId)
  const [chatRows] = await db.query("SELECT * FROM telegram_chats WHERE chat_id=?", [context.chatId])
  const existingChat = chatRows[0]
  const ownerUserId = existingChat?.user_id || row.user_id

  if (!existingChat) {
    await db.query(
      "INSERT INTO telegram_chats (chat_id, user_id, title, type) VALUES (?, ?, ?, ?)",
      [context.chatId, row.user_id, chatTitle, context.chat.type || null]
    )
  } else {
    await db.query(
      "UPDATE telegram_chats SET title=?, type=?, enabled=1 WHERE chat_id=?",
      [chatTitle, context.chat.type || null, context.chatId]
    )
  }

  const [memberCountRows] = await db.query("SELECT COUNT(*) total FROM telegram_members WHERE chat_id=?", [context.chatId])
  const isFirstMember = Number(memberCountRows[0]?.total || 0) === 0
  const role = isFirstMember || Number(ownerUserId) === Number(row.user_id) || telegramAdminIds().includes(context.telegramUserId)
    ? "admin"
    : "member"

  await upsertTelegramMember({
    chatId: context.chatId,
    telegramUserId: context.telegramUserId,
    userId: row.user_id,
    friendName: row.name || null,
    role,
    username: context.from.username || null,
    displayName: telegramName(context.from)
  })
  await db.query("INSERT IGNORE INTO friends (user_id, name) VALUES (?, ?)", [ownerUserId, row.name || row.email || `tg-${context.telegramUserId}`])
  await db.query("UPDATE telegram_connect_tokens SET used_at=NOW() WHERE token=?", [token])

  return `Connected ${row.name || row.email} as ${role}.`
}

async function handleTelegramPrivateConnect(message, token) {
  await ensureTelegramSchema()
  await ensureDuesSchema()
  const telegramUserId = String(message?.from?.id || "")
  if (!telegramUserId || !token) return "ลิงก์เชื่อมบัญชีไม่ถูกต้อง กรุณากลับไปสร้างลิงก์ใหม่จาก Harbill"

  const [tokenRows] = await db.query(`
    SELECT t.*, u.name, u.email
    FROM telegram_connect_tokens t
    JOIN users u ON u.id=t.user_id
    WHERE t.token=? AND t.used_at IS NULL AND t.expires_at > NOW()
    LIMIT 1
  `, [token])
  const row = tokenRows[0]
  if (!row) return "ลิงก์เชื่อมบัญชีหมดอายุหรือถูกใช้งานแล้ว กรุณากลับไปหน้า Harbill แล้วลองใหม่"

  const [onboardingRows] = await db.query(`
    SELECT chat_id, onboarding_message_id
    FROM telegram_members
    WHERE telegram_user_id=? AND onboarding_message_id IS NOT NULL
  `, [telegramUserId])
  const [result] = await db.query(`
    UPDATE telegram_members
    SET user_id=?, username=?, display_name=?
    WHERE telegram_user_id=?
  `, [
    row.user_id,
    message.from.username || null,
    telegramName(message.from),
    telegramUserId
  ])
  if (!result.affectedRows) {
    return "ยังไม่พบคุณในกลุ่ม Harbill กรุณาเข้ากลุ่มและพิมพ์ /menu ในกลุ่มก่อน แล้วกลับมากดเชื่อมอีกครั้ง"
  }

  await db.query(`
    UPDATE dues d
    JOIN telegram_members tm
      ON tm.chat_id=d.telegram_chat_id
     AND tm.friend_name=d.person_name
    SET d.debtor_user_id=?
    WHERE tm.telegram_user_id=? AND d.status <> 'paid'
  `, [row.user_id, telegramUserId])
  await db.query(`
    UPDATE due_payment_links link_row
    JOIN dues d
      ON d.user_id=link_row.user_id
     AND d.person_name=link_row.person_name
     AND d.due_month=link_row.due_month
    SET link_row.debtor_user_id=?
    WHERE d.debtor_user_id=? AND d.status <> 'paid'
  `, [row.user_id, row.user_id])
  await db.query("UPDATE telegram_connect_tokens SET used_at=NOW() WHERE token=?", [token])
  await Promise.all(onboardingRows.map(item => (
    deleteTelegramMessage(item.chat_id, item.onboarding_message_id).catch(() => false)
  )))
  await db.query(`
    UPDATE telegram_members SET onboarding_message_id=NULL
    WHERE telegram_user_id=?
  `, [telegramUserId])
  return [
    `✅ เชื่อม Telegram กับบัญชี ${row.name || row.email} สำเร็จแล้ว`,
    "กลับไปหน้าชำระเงิน แล้วกด “ตรวจสอบอีกครั้ง” ได้เลย"
  ].join("\n")
}

async function handleTelegramAdd(context, body) {
  if (!context.linkedChat) return "This chat is not connected. Use /connect from Harbill first."
  if (!context.member?.user_id) return "Please connect your Google account before creating items."

  const parsed = parseTelegramAdd(body, context.member.friend_name || telegramName(context.from))
  if (!parsed) {
    return [
      "Invalid add command.",
      "Example: /add Dinner 900 by Bee split Me,A,C month 2026-07"
    ].join("\n")
  }

  const debtors = parsed.splitWith.filter(name => name !== parsed.creditor)
  if (debtors.length === 0) return "No debtor to charge after excluding the payer."

  const share = Math.round((parsed.amount / debtors.length) * 100) / 100
  const createdIds = []
  for (const person of debtors) {
    await db.query("INSERT IGNORE INTO friends (user_id, name) VALUES (?, ?)", [context.ownerUserId, person])
    const [result] = await db.query(`
      INSERT INTO dues (
        user_id, created_by_user_id, created_by_telegram_id, created_by_name,
        person_name, creditor_name, title, amount, due_month, status, note,
        source, approval_status, telegram_chat_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, 'telegram', 'approved', ?)
    `, [
      context.ownerUserId,
      context.member.user_id,
      context.telegramUserId,
      context.member.friend_name || telegramName(context.from),
      person,
      parsed.creditor,
      parsed.title,
      share,
      parsed.month,
      `Original amount ${parsed.amount}; split ${debtors.length} debtors`,
      context.chatId
    ])
    createdIds.push(result.insertId)
  }

  const reply = [
    `Added ${parsed.title} ${parsed.amount.toFixed(2)}`,
    `Pay to: ${parsed.creditor}`,
    `Debtors: ${debtors.length}, ${share.toFixed(2)} each`,
    `Created dues: ${createdIds.map(id => `#${id}`).join(", ")}`
  ].join("\n")
  const sent = await sendTelegramMessage(context.chatId, reply)
  if (sent?.message_id) {
    await db.query(
      `UPDATE dues SET telegram_message_id=? WHERE id IN (${createdIds.map(() => "?").join(",")}) AND user_id=?`,
      [String(sent.message_id), ...createdIds, context.ownerUserId]
    )
    return null
  }
  return reply
}

async function handleTelegramBatch(context, body) {
  if (!context.linkedChat) return "กลุ่มนี้ยังไม่ได้เชื่อมกับ Harbill"
  if (!context.member?.user_id) return "กรุณาเชื่อมบัญชี Google ก่อนสร้างรายการ"

  const creatorName = context.member.friend_name || telegramName(context.from)
  const parsed = parseTelegramBatch(body, creatorName)
  if (parsed.error) return parsed.error

  const token = crypto.randomBytes(16).toString("hex")
  const payload = {
    creditor: parsed.creditor,
    month: parsed.month,
    creatorName,
    items: parsed.items
  }
  await db.query("DELETE FROM telegram_due_drafts WHERE expires_at <= NOW()")
  await db.query(`
    INSERT INTO telegram_due_drafts (token, chat_id, telegram_user_id, owner_user_id, payload, expires_at)
    VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))
  `, [token, context.chatId, context.telegramUserId, context.ownerUserId, JSON.stringify(payload)])

  const debtorTotals = new Map()
  for (const item of parsed.items) {
    for (const allocation of item.allocations) {
      debtorTotals.set(allocation.name, Math.round(((debtorTotals.get(allocation.name) || 0) + allocation.amount) * 100) / 100)
    }
  }
  const preview = [
    `ตรวจสอบ ${parsed.items.length} รายการก่อนบันทึก`,
    `เจ้าหนี้: ${parsed.creditor}`,
    `เดือน: ${parsed.month}`,
    "",
    ...parsed.items.map((item, index) => `${index + 1}. ${item.title} ${item.amount.toFixed(2)} ÷ ${item.debtors.length} คน\n   ${item.allocations.map(allocation => `${allocation.name} ${allocation.amount.toFixed(2)}`).join(", ")}`),
    "",
    "ยอดที่แต่ละคนต้องจ่าย:",
    ...[...debtorTotals].map(([name, total]) => `• ${name}: ${total.toFixed(2)}`),
    "",
    "รายการร่างนี้หมดอายุใน 15 นาที"
  ].join("\n")

  if (preview.length > 3900) {
    await db.query("DELETE FROM telegram_due_drafts WHERE token=?", [token])
    return "รายการยาวเกินกว่าที่ Telegram แสดงได้ กรุณาแบ่งเป็นสองชุด"
  }

  await sendTelegramMessage(context.chatId, preview, {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ ยืนยันทั้งหมด", callback_data: `batch:confirm:${token}` },
        { text: "❌ ยกเลิก", callback_data: `batch:cancel:${token}` }
      ]]
    }
  })
  return null
}

async function handleTelegramBatchAction(context, action, token) {
  if (!/^[a-f0-9]{32}$/.test(token || "")) return "รายการร่างไม่ถูกต้อง"
  if (action !== "confirm" && action !== "cancel") return "คำสั่งรายการร่างไม่ถูกต้อง"

  const connection = await db.getConnection()
  const createdIds = []
  const paymentLinks = []
  let confirmedPayload = null
  try {
    await connection.beginTransaction()
    const [rows] = await connection.query(`
      SELECT * FROM telegram_due_drafts
      WHERE token=? AND chat_id=? AND telegram_user_id=? AND owner_user_id=? AND expires_at > NOW()
      LIMIT 1 FOR UPDATE
    `, [token, context.chatId, context.telegramUserId, context.ownerUserId])
    const draft = rows[0]
    if (!draft) {
      await connection.rollback()
      return "รายการร่างหมดอายุ ถูกยืนยันไปแล้ว หรือไม่ใช่รายการของคุณ"
    }
    if (action === "cancel") {
      await connection.query("DELETE FROM telegram_due_drafts WHERE token=?", [token])
      await connection.commit()
      return "ยกเลิกรายการร่างแล้ว"
    }

    const payload = typeof draft.payload === "string" ? JSON.parse(draft.payload) : draft.payload
    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      await connection.rollback()
      return "ข้อมูลรายการร่างไม่ถูกต้อง"
    }
    confirmedPayload = payload
    for (const item of payload.items) {
      for (const allocation of item.allocations) {
        await connection.query("INSERT IGNORE INTO friends (user_id, name) VALUES (?, ?)", [context.ownerUserId, allocation.name])
        const [result] = await connection.query(`
          INSERT INTO dues (
            user_id, created_by_user_id, created_by_telegram_id, created_by_name,
            person_name, creditor_name, title, amount, due_month, status, note,
            source, approval_status, telegram_chat_id, batch_token
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, 'telegram', 'approved', ?, ?)
        `, [
          context.ownerUserId,
          context.member.user_id,
          context.telegramUserId,
          payload.creatorName,
          allocation.name,
          payload.creditor,
          item.title,
          allocation.amount,
          payload.month,
          `Batch total ${Number(item.amount).toFixed(2)}; split ${item.debtors.length} people`,
          context.chatId,
          token
        ])
        createdIds.push(result.insertId)
      }
    }
    const debtorNames = [...new Set(payload.items.flatMap(item => item.allocations.map(allocation => allocation.name)))]
    for (const person of debtorNames) {
      const [existingLinks] = await connection.query(
        "SELECT token FROM due_payment_links WHERE user_id=? AND person_name=? AND due_month=? ORDER BY created_at DESC LIMIT 1",
        [context.ownerUserId, person, payload.month]
      )
      const paymentToken = existingLinks[0]?.token || crypto.randomBytes(18).toString("hex")
      if (!existingLinks[0]) {
        await connection.query(
          "INSERT INTO due_payment_links (token, user_id, person_name, due_month) VALUES (?, ?, ?, ?)",
          [paymentToken, context.ownerUserId, person, payload.month]
        )
      }
      paymentLinks.push({
        person,
        url: telegramPaymentUrl(paymentToken, person)
      })
    }
    await connection.query("DELETE FROM telegram_due_drafts WHERE token=?", [token])
    await connection.commit()
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }

  const debtorTotals = new Map()
  for (const item of confirmedPayload.items) {
    for (const allocation of item.allocations) {
      debtorTotals.set(allocation.name, Math.round(((debtorTotals.get(allocation.name) || 0) + allocation.amount) * 100) / 100)
    }
  }
  const [memberRows] = await db.query(`
    SELECT friend_name, username
    FROM telegram_members
    WHERE chat_id=? AND friend_name IS NOT NULL AND username IS NOT NULL AND username <> ''
  `, [context.chatId])
  const usernames = new Map(memberRows.map(member => [member.friend_name, member.username]))
  const text = [
    `✅ บันทึกแล้ว ${confirmedPayload.items.length} รายการ`,
    `เจ้าหนี้: ${confirmedPayload.creditor}`,
    `เดือน: ${confirmedPayload.month}`,
    "",
    ...[...debtorTotals].map(([name, total]) => {
      const username = usernames.get(name)
      return `• ${username ? `@${username}` : name} ต้องจ่าย ${total.toFixed(2)} บาท`
    }),
    "",
    `เลขรายการ: ${createdIds.map(id => `#${id}`).join(", ")}`
  ].join("\n")
  const payButtons = paymentLinks.map(link => [{
    text: `💳 ${String(link.person).slice(0, 32)} — ชำระ/ส่งสลิป`,
    url: link.url
  }])
  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        ...payButtons,
        ...telegramMainMenu(context).inline_keyboard
      ]
    }
  }
}

async function handleTelegramEdit(context, args) {
  if (!context.linkedChat) return "This chat is not connected."
  const id = Number(args[0])
  const field = String(args[1] || "").toLowerCase()
  const value = args.slice(2).join(" ").trim()
  if (!id || !field || !value) return "Use /edit <id> amount|title|person|creditor|month <value>."

  const [rows] = await db.query("SELECT * FROM dues WHERE id=? AND user_id=?", [id, context.ownerUserId])
  const due = rows[0]
  if (!due) return `Due #${id} was not found.`
  if (!await telegramCanManageDue(context, due)) return "Only the creator or an admin can edit this due."

  const updates = []
  const values = []
  if (field === "amount") {
    const amount = Number(value.replace(/,/g, ""))
    if (!Number.isFinite(amount) || amount <= 0) return "Invalid amount."
    updates.push("amount=?")
    values.push(amount)
  } else if (field === "title") {
    updates.push("title=?")
    values.push(value)
  } else if (field === "person") {
    updates.push("person_name=?")
    values.push(value)
  } else if (field === "creditor" || field === "payto") {
    updates.push("creditor_name=?")
    values.push(value)
  } else if (field === "month") {
    if (!/^\d{4}-\d{2}$/.test(value)) return "Month must be YYYY-MM."
    updates.push("due_month=?")
    values.push(value)
  } else {
    return "Editable fields: amount, title, person, creditor, month."
  }

  await db.query(`UPDATE dues SET ${updates.join(", ")} WHERE id=? AND user_id=?`, [...values, id, context.ownerUserId])
  return `Updated #${id}.`
}

async function handleTelegramPaid(context, args) {
  if (!context.linkedChat) return "This chat is not connected."
  const id = Number(args[0])
  if (!id) return "Use /paid <id>."

  const [rows] = await db.query("SELECT * FROM dues WHERE id=? AND user_id=?", [id, context.ownerUserId])
  const due = rows[0]
  if (!due) return `Due #${id} was not found.`
  if (!await telegramCanManageDue(context, due)) return "Only the creator or an admin can mark this due as paid."

  await db.query("UPDATE dues SET status='paid', paid_at=NOW() WHERE id=? AND user_id=?", [id, context.ownerUserId])
  return `Marked #${id} as paid.`
}

async function handleTelegramList(context, args) {
  if (!context.linkedChat) return "This chat is not connected."
  const month = /^\d{4}-\d{2}$/.test(args[0] || "") ? args[0] : currentBangkokMonth()
  const clauses = ["user_id=?", "due_month=?"]
  const values = [context.ownerUserId, month]

  if (!context.isAdmin) {
    clauses.push("(person_name=? OR created_by_user_id=? OR created_by_telegram_id=?)")
    values.push(context.member?.friend_name || "", context.member?.user_id || 0, context.telegramUserId)
  }

  const [rows] = await db.query(`
    SELECT *
    FROM dues
    WHERE ${clauses.join(" AND ")}
    ORDER BY status ASC, person_name ASC, created_at DESC
    LIMIT 20
  `, values)

  if (rows.length === 0) return `No dues for ${month}.`
  return [
    `Dues for ${month}`,
    ...rows.map(row => `#${row.id} ${row.person_name} -> ${row.creditor_name || "owner"} ${Number(row.amount).toFixed(2)} ${row.status} (${row.title})`)
  ].join("\n")
}

async function handleTelegramName(context, args) {
  if (!context.linkedChat) return "This chat is not connected."
  if (!context.member?.user_id) return "Please connect your Google account first."
  const name = args.join(" ").trim()
  if (!name) return "Use /name <your display name>."

  await db.query(
    "UPDATE telegram_members SET friend_name=? WHERE chat_id=? AND telegram_user_id=?",
    [name, context.chatId, context.telegramUserId]
  )
  await db.query("INSERT IGNORE INTO friends (user_id, name) VALUES (?, ?)", [context.ownerUserId, name])
  return `Your Telegram name is now ${name}. New items you create will be paid to this name.`
}

function telegramMainMenu(context) {
  const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim()
  const miniAppShortName = String(process.env.TELEGRAM_WEBAPP_SHORT_NAME || "").trim()
  const addButton = botUsername && miniAppShortName
    ? {
        text: "➕ เพิ่มรายการ",
        url: `https://t.me/${botUsername}/${miniAppShortName}?startapp=${encodeURIComponent(context.chatId)}`
      }
    : {
        text: "➕ เพิ่มรายการ",
        callback_data: "/batch_start"
      }
  return {
    inline_keyboard: [
      [addButton],
      [
        { text: "📋 รายการเดือนนี้", callback_data: "/list" },
        { text: "ℹ️ วิธีใช้", callback_data: "/help" }
      ]
    ]
  }
}

function telegramReplyKeyboard() {
  return {
    keyboard: [
      [
        { text: "➕ เพิ่มรายการ" },
        { text: "📋 รายการเดือนนี้" }
      ],
      [
        { text: "🔄 เปิดเมนู" },
        { text: "ℹ️ วิธีใช้" }
      ]
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "เลือกคำสั่ง Harbill…"
  }
}

function telegramBatchHelpText() {
  return [
    "ส่งข้อความหนึ่งชุดในรูปแบบนี้:",
    "",
    "/batch",
    "หมูกระทะ | 900 | บี,แบงค์,ปิโป้",
    "น้ำมัน | 600 | บี,ปิโป้",
    "เจ้าหนี้: ปิโป้",
    "เดือน: 2026-07",
    "",
    "แต่ละบรรทัดใช้: รายการ | ยอดรวม | รายชื่อคนหาร",
    "บรรทัดเจ้าหนี้และเดือนจะไม่ใส่ก็ได้"
  ].join("\n")
}

function telegramBatchInputPrompt() {
  return [
    "✏️ ตอบข้อความนี้ด้วยรายการที่ต้องการเพิ่ม",
    "",
    "รายการ | ราคา | คนที่ต้องจ่าย",
    "",
    "ตัวอย่าง:",
    "หมูกรอบ | 50 | ดีน",
    "น้ำมัน | 600 | บี,เอ",
    "",
    "ส่งหลายบรรทัดในข้อความเดียวได้",
    "ระบบจะใช้คุณเป็นเจ้าหนี้และใช้เดือนปัจจุบันให้อัตโนมัติ"
  ].join("\n")
}

function telegramPaymentUrl(paymentToken, person) {
  const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim()
  const miniAppShortName = String(process.env.TELEGRAM_WEBAPP_SHORT_NAME || "").trim()
  if (botUsername && miniAppShortName) {
    return `https://t.me/${botUsername}/${miniAppShortName}?startapp=pay_${paymentToken}`
  }
  return `${CLIENT_URL}/pay/${paymentToken}?name=${encodeURIComponent(person)}`
}

let telegramCommandsConfigured = false

async function ensureTelegramCommands() {
  if (telegramCommandsConfigured) return
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "menu", description: "เปิดกล่องคำสั่ง Harbill" },
          { command: "list", description: "ดูรายการเดือนนี้" },
          { command: "batch", description: "เพิ่มหลายรายการ" },
          { command: "connect", description: "เชื่อมบัญชี Harbill" },
          { command: "help", description: "ดูวิธีใช้งาน" }
        ],
        scope: { type: "all_group_chats" }
      })
    })
    if (response.ok) telegramCommandsConfigured = true
  } catch (err) {
    console.error("Telegram command setup failed:", err.message)
  }
}

async function sendTelegramMenu(context) {
  await sendTelegramMessage(context.chatId, "เมนู Harbill พร้อมใช้งานแล้ว", {
    reply_markup: telegramReplyKeyboard()
  })
  await sendTelegramMessage(context.chatId, "เลือกเพิ่มรายการจากปุ่มด้านล่าง หรือเปิดแบบฟอร์มจากปุ่มนี้", {
    reply_markup: telegramMainMenu(context)
  })
}

async function handleTelegramNewMembers(message) {
  await ensureTelegramSchema()
  const chatId = String(message?.chat?.id || "")
  const allNewMembers = Array.isArray(message?.new_chat_members)
    ? message.new_chat_members.filter(member => member?.id)
    : []
  const newMembers = allNewMembers.filter(member => !member.is_bot)
  const botWasAdded = allNewMembers.some(member => member.is_bot)
  if (!chatId || allNewMembers.length === 0) return

  const allowedChatIds = telegramAllowedChatIds()
  if (allowedChatIds.length > 0 && !allowedChatIds.includes(chatId)) return

  if (botWasAdded) {
    await sendTelegramMessage(chatId, [
      "✅ Harbill Bot พร้อมใช้งานแล้ว",
      "แถบคำสั่งด่วนอยู่เหนือช่องพิมพ์ หากกลุ่มยังไม่เชื่อม ให้เข้าสู่ระบบ Harbill แล้วเชื่อมกลุ่มก่อน"
    ].join("\n"), {
      reply_markup: telegramReplyKeyboard()
    })
  }
  if (newMembers.length === 0) return

  const [chatRows] = await db.query(
    "SELECT * FROM telegram_chats WHERE chat_id=? AND enabled=1",
    [chatId]
  )
  if (!chatRows[0]) return

  for (const member of newMembers) {
    const displayName = telegramName(member)
    const telegramUserId = String(member.id)
    await upsertTelegramMember({
      chatId,
      telegramUserId,
      friendName: displayName || member.username || `tg-${member.id}`,
      role: "member",
      username: member.username || null,
      displayName
    })
    const mention = member.username ? `@${member.username}` : displayName
    const sent = await sendTelegramMessage(chatId, [
      `👋 ${mention || "สมาชิกใหม่"} กรุณาเชื่อมบัญชี Harbill ก่อนใช้งาน`,
      "เชื่อมเพียงครั้งเดียว หลังเชื่อมสำเร็จข้อความนี้จะหายไปอัตโนมัติ"
    ].join("\n"), {
      reply_markup: {
        inline_keyboard: [[
          { text: "🔗 เชื่อมบัญชีตอนนี้", url: `${CLIENT_URL}/telegram/connect` }
        ]]
      }
    })
    if (sent?.message_id) {
      await db.query(`
        UPDATE telegram_members SET onboarding_message_id=?
        WHERE chat_id=? AND telegram_user_id=? AND user_id IS NULL
      `, [String(sent.message_id), chatId, telegramUserId])
    }
  }
}

app.post("/telegram/web-app/context", async (req, res) => {
  const context = await getTelegramWebAppContext(req.body?.initData, req.body?.chatId)
  if (context.status !== 200) return res.status(context.status).json({ error: context.error })

  const [friends] = await db.query("SELECT id, name FROM friends WHERE user_id=? ORDER BY name", [context.ownerUserId])
  const [telegramMembers] = await db.query(`
    SELECT telegram_user_id, user_id, friend_name, username, display_name
    FROM telegram_members
    WHERE chat_id=? AND friend_name IS NOT NULL AND friend_name <> ''
    ORDER BY friend_name
  `, [context.chatId])
  const selectablePeople = new Map()
  friends.forEach(friend => selectablePeople.set(friend.name, { id: `friend:${friend.id}`, name: friend.name, source: "harbill" }))
  telegramMembers.forEach(member => selectablePeople.set(member.friend_name, {
    id: `telegram:${member.telegram_user_id}`,
    name: member.friend_name,
    userId: member.user_id ? Number(member.user_id) : null,
    linked: Boolean(member.user_id),
    username: member.username || "",
    source: "telegram"
  }))
  res.json({
    chat: {
      id: context.chatId,
      title: context.linkedChat.title || ""
    },
    member: {
      name: context.member.friend_name || context.verified.user.first_name || telegramName(context.verified.user),
      role: context.member.role
    },
    friends: [...selectablePeople.values()]
  })
})

app.post("/telegram/web-app/dues", async (req, res) => {
  const context = await getTelegramWebAppContext(req.body?.initData, req.body?.chatId)
  if (context.status !== 200) return res.status(context.status).json({ error: context.error })

  const [linkedMemberRows] = await db.query(`
    SELECT friend_name, user_id
    FROM telegram_members
    WHERE chat_id=? AND user_id IS NOT NULL AND friend_name IS NOT NULL
  `, [context.chatId])
  const linkedUsersByName = new Map(
    linkedMemberRows.map(member => [member.friend_name, Number(member.user_id)])
  )
  const month = String(req.body.month || "").trim().slice(0, 7)
  const note = String(req.body.note || "").trim()
  const creditor = String(context.member.friend_name || context.verified.user.first_name || telegramName(context.verified.user)).trim()
  const inputItems = Array.isArray(req.body.items) ? req.body.items : [{
    title: req.body.title,
    amount: req.body.amount,
    debtors: req.body.debtors
  }]
  if (!/^\d{4}-\d{2}$/.test(month) || inputItems.length === 0 || inputItems.length > 20) {
    return res.status(400).json({ error: "เพิ่มได้ครั้งละ 1-20 รายการ" })
  }

  const parsedItems = []
  for (const input of inputItems) {
    const title = String(input?.title || "").trim()
    const amount = Number(String(input?.amount || "").replace(/,/g, ""))
    const debtorMap = new Map()
    ;(Array.isArray(input?.debtors) ? input.debtors : []).forEach(value => {
      const person = String(typeof value === "object" ? value?.name : value || "").trim()
      const debtorUserId = linkedUsersByName.get(person) || null
      if (person && person !== creditor) debtorMap.set(person, { person, debtorUserId })
    })
    const debtors = [...debtorMap.values()]
    if (!title || !Number.isFinite(amount) || amount <= 0 || debtors.length === 0) {
      return res.status(400).json({ error: "กรุณากรอกรายการ ราคา และเลือกคนที่ต้องจ่ายให้ครบ" })
    }
    const totalCents = Math.round(amount * 100)
    const baseCents = Math.floor(totalCents / debtors.length)
    const remainder = totalCents - (baseCents * debtors.length)
    parsedItems.push({
      title,
      amount,
      allocations: debtors.map((debtor, index) => ({
        person: debtor.person,
        debtorUserId: debtor.debtorUserId,
        amount: (baseCents + (index < remainder ? 1 : 0)) / 100
      }))
    })
  }

  const createdIds = []
  const paymentLinks = []
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    for (const item of parsedItems) {
      for (const allocation of item.allocations) {
        await connection.query("INSERT IGNORE INTO friends (user_id, name) VALUES (?, ?)", [context.ownerUserId, allocation.person])
        const [result] = await connection.query(`
          INSERT INTO dues (
            user_id, created_by_user_id, debtor_user_id, created_by_telegram_id, created_by_name,
            person_name, creditor_name, title, amount, due_month, status, note,
            source, approval_status, telegram_chat_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, 'telegram', 'approved', ?)
        `, [context.ownerUserId, context.member.user_id, allocation.debtorUserId, context.telegramUserId, creditor,
          allocation.person, creditor, item.title, allocation.amount, month,
          note || `Telegram total ${item.amount.toFixed(2)}`, context.chatId])
        createdIds.push(result.insertId)
      }
    }

    const debtorsByName = new Map()
    parsedItems.flatMap(item => item.allocations).forEach(allocation => {
      const current = debtorsByName.get(allocation.person)
      if (!current?.debtorUserId || allocation.debtorUserId) debtorsByName.set(allocation.person, allocation)
    })
    for (const [person, debtor] of debtorsByName) {
      const [existing] = await connection.query(
        "SELECT token, debtor_user_id FROM due_payment_links WHERE user_id=? AND person_name=? AND due_month=? ORDER BY created_at DESC LIMIT 1",
        [context.ownerUserId, person, month]
      )
      const paymentToken = existing[0]?.token || crypto.randomBytes(18).toString("hex")
      if (!existing[0]) {
        await connection.query(
          "INSERT INTO due_payment_links (token, user_id, debtor_user_id, person_name, due_month) VALUES (?, ?, ?, ?, ?)",
          [paymentToken, context.ownerUserId, debtor.debtorUserId, person, month]
        )
      } else if (!existing[0].debtor_user_id && debtor.debtorUserId) {
        await connection.query(
          "UPDATE due_payment_links SET debtor_user_id=? WHERE token=?",
          [debtor.debtorUserId, paymentToken]
        )
      }
      paymentLinks.push({
        person,
        linked: Boolean(debtor.debtorUserId || existing[0]?.debtor_user_id),
        url: telegramPaymentUrl(paymentToken, person)
      })
    }
    await connection.commit()
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }

  const totals = new Map()
  parsedItems.forEach(item => item.allocations.forEach(allocation => {
    totals.set(allocation.person, Math.round(((totals.get(allocation.person) || 0) + allocation.amount) * 100) / 100)
  }))
  const [memberRows] = await db.query(`
    SELECT friend_name, username FROM telegram_members
    WHERE chat_id=? AND friend_name IS NOT NULL AND username IS NOT NULL AND username <> ''
  `, [context.chatId])
  const usernames = new Map(memberRows.map(member => [member.friend_name, member.username]))
  const text = [
    `✅ บันทึกแล้ว ${parsedItems.length} รายการ`,
    `เจ้าหนี้: ${creditor}`,
    `เดือน: ${month}`,
    "",
    ...[...totals].map(([person, total]) => `• ${usernames.get(person) ? `@${usernames.get(person)}` : person} ต้องจ่าย ${total.toFixed(2)} บาท`)
  ].join("\n")
  const sent = await sendTelegramMessage(context.chatId, text, {
    reply_markup: {
      inline_keyboard: [
        ...paymentLinks.map(link => [{ text: `💳 ${String(link.person).slice(0, 30)} — ชำระ/ส่งสลิป`, url: link.url }]),
        ...telegramMainMenu(context).inline_keyboard
      ]
    }
  })
  if (sent?.message_id) {
    await db.query(
      `UPDATE dues SET telegram_message_id=? WHERE id IN (${createdIds.map(() => "?").join(",")}) AND user_id=?`,
      [String(sent.message_id), ...createdIds, context.ownerUserId]
    )
  }

  res.json({ ok: true, ids: createdIds, creditor, itemCount: parsedItems.length })
})

app.post("/telegram/webhook", async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const provided = String(req.headers["x-telegram-bot-api-secret-token"] || req.headers["x-telegram-secret"] || req.query.secret || "")
    if (provided !== secret) return res.status(401).json({ error: "Unauthorized" })
  }
  await ensureTelegramCommands()

  const callbackQuery = req.body?.callback_query
  const message = req.body?.message || req.body?.edited_message || (callbackQuery?.message ? { ...callbackQuery.message, from: callbackQuery.from } : null)
  if (message?.new_chat_members?.length) {
    try {
      await handleTelegramNewMembers(message)
    } catch (err) {
      console.error("Telegram new member handling failed:", err)
    }
    return res.json({ ok: true })
  }
  const text = req.body?.message?.text || req.body?.edited_message?.text || req.body?.callback_query?.data || ""
  if (!message || !text) return res.json({ ok: true })

  const privateStartMatch = message.chat?.type === "private"
    ? String(text).trim().match(/^\/start(?:@\w+)?\s+connect_([a-f0-9]{32})$/i)
    : null
  if (privateStartMatch) {
    try {
      const reply = await handleTelegramPrivateConnect(message, privateStartMatch[1])
      await sendTelegramMessage(String(message.chat.id), reply)
    } catch (err) {
      console.error("Telegram private connect failed:", err)
      await sendTelegramMessage(String(message.chat.id), "เชื่อมบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    }
    return res.json({ ok: true })
  }

  const context = await getTelegramContext(message)
  if (!context || context.blocked) {
    if (context?.chatId) await sendTelegramMessage(context.chatId, context.reason || "This chat is not allowed.")
    return res.json({ ok: true })
  }

  const { command, args, body } = parseTelegramText(text)
  const quickAction = String(text).trim()
  const isBatchInputReply = Boolean(
    req.body?.message?.reply_to_message?.from?.is_bot &&
    req.body.message.reply_to_message.text?.startsWith("✏️ ตอบข้อความนี้ด้วยรายการ")
  )
  let reply = null

  try {
    if (isBatchInputReply) {
      reply = await handleTelegramBatch(context, text)
      if (!reply && req.body.message.reply_to_message?.message_id) {
        await deleteTelegramMessage(context.chatId, req.body.message.reply_to_message.message_id)
      }
    } else if (callbackQuery && command.startsWith("batch:")) {
      const [, action, token] = command.split(":")
      const actionResult = await handleTelegramBatchAction(context, action, token)
      const actionReplyMarkup = typeof actionResult === "object" ? actionResult.replyMarkup : null
      reply = typeof actionResult === "object" ? actionResult.text : actionResult
      await answerTelegramCallback(callbackQuery.id, action === "confirm" ? "กำลังบันทึกรายการ" : "ยกเลิกรายการแล้ว")
      if (reply && callbackQuery.message?.message_id) {
        const edited = await editTelegramMessage(context.chatId, callbackQuery.message.message_id, reply, {
          reply_markup: actionReplyMarkup || telegramMainMenu(context)
        })
        if (edited) reply = null
      }
    } else if (command === "/start" || command === "/menu" || command === "เมนู" || quickAction === "🔄 เปิดเมนู") {
      await sendTelegramMenu(context)
      reply = null
    } else if (command === "/help" || command === "วิธีใช้" || quickAction === "ℹ️ วิธีใช้") {
      await sendTelegramMessage(context.chatId, [
        "Harbill commands:",
        "กดปุ่มเพิ่มรายการเพื่อเปิดฟอร์มใน Telegram",
        "/connect <token> เพื่อเชื่อม Google account",
        "/name Bee เพื่อตั้งชื่อคนรับเงินของคุณ",
        "/add Dinner 900 split Me,A,C",
        "เพิ่มหลายรายการ:",
        "/batch",
        "หมูกระทะ | 900 | บี,แบงค์,ปิโป้",
        "น้ำมัน | 600 | บี,ปิโป้",
        "เจ้าหนี้: ปิโป้",
        "เดือน: 2026-07",
        "/edit <id> amount 450",
        "/paid <id>",
        "/list 2026-07"
      ].join("\n"), { reply_markup: telegramMainMenu(context) })
      reply = null
    } else if (command === "/batch_help") {
      await sendTelegramMessage(context.chatId, telegramBatchHelpText(), {
        reply_markup: telegramMainMenu(context)
      })
      reply = null
    } else if (command === "/batch_start") {
      await sendTelegramMessage(context.chatId, telegramBatchInputPrompt(), {
        reply_markup: {
          force_reply: true,
          selective: true,
          input_field_placeholder: "หมูกรอบ | 50 | ดีน"
        }
      })
      reply = null
    } else if (command === "เพิ่มรายการ" || quickAction === "➕ เพิ่มรายการ") {
      await sendTelegramMessage(context.chatId, telegramBatchHelpText(), {
        reply_markup: telegramMainMenu(context)
      })
      reply = null
    } else if (command === "รายการเดือนนี้" || quickAction === "📋 รายการเดือนนี้") {
      reply = await handleTelegramList(context, [])
    } else if (command === "/connect") {
      reply = await handleTelegramConnect(context, args[0])
    } else if (command === "/add" || command === "/เพิ่ม") {
      reply = await handleTelegramAdd(context, body)
    } else if (command === "/batch" || command === "/ชุด" || command === "/หลายรายการ") {
      reply = await handleTelegramBatch(context, body)
    } else if (command === "/edit" || command === "/แก้") {
      reply = await handleTelegramEdit(context, args)
    } else if (command === "/paid" || command === "/จ่ายแล้ว") {
      reply = await handleTelegramPaid(context, args)
    } else if (command === "/list" || command === "/รายการ") {
      reply = await handleTelegramList(context, args)
    } else if (command === "/name" || command === "/ชื่อ") {
      reply = await handleTelegramName(context, args)
    }
  } catch (err) {
    console.error("Telegram webhook failed:", err)
    reply = "Sorry, Harbill could not process that command."
  }

  if (callbackQuery && !command.startsWith("batch:")) {
    await answerTelegramCallback(callbackQuery.id)
  }
  if (reply) await sendTelegramMessage(context.chatId, reply)
  res.json({ ok: true })
})

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

const express = require("express")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const multer = require("multer")
const fs = require("fs")
const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const session = require("express-session")
require("dotenv").config()

const db = require("./db")
const { signToken, requireAuth } = require("./auth")

const app = express()
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(session({ secret: process.env.JWT_SECRET, resave: false, saveUninitialized: false }))
app.use(passport.initialize())
app.use(passport.session())

const upload = multer({ dest: "uploads/" })

// ── GOOGLE OAUTH ──────────────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3001/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value
  const name = profile.displayName
  const avatar = profile.photos[0]?.value
  const google_id = profile.id

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
  }

  done(null, user)
}))

passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser(async (id, done) => {
  const [rows] = await db.query("SELECT * FROM users WHERE id=?", [id])
  done(null, rows[0])
})

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
)

app.get("/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=1` }),
  (req, res) => {
    const token = signToken(req.user)
    res.redirect(`${process.env.CLIENT_URL}/auth?token=${token}&name=${encodeURIComponent(req.user.name)}&avatar=${encodeURIComponent(req.user.avatar || "")}`)
  }
)

// ── EMAIL AUTH ────────────────────────────────────────────────
app.post("/auth/register", async (req, res) => {
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

app.get("/auth/me", requireAuth, (req, res) => {
  const { id, email, name, avatar } = req.user
  res.json({ id, email, name, avatar })
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
  const { name } = req.body
  const [r] = await db.query("INSERT INTO `groups` (name, user_id) VALUES (?,?)", [name, req.user.id])
  res.json({ id: r.insertId, name, members: [] })
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
app.post("/scan", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const imageData = fs.readFileSync(req.file.path)
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
    fs.unlinkSync(req.file.path)
    res.json({ items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "อ่านไม่ได้ครับ" })
  }
})

app.listen(process.env.PORT || 3001, () => console.log("API ready on port 3001"))

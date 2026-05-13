const jwt = require("jsonwebtoken")
const db = require("./db")

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  )
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ error: "Unauthorized" })
  const token = header.replace("Bearer ", "")
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [decoded.id])
    if (!rows[0]) return res.status(401).json({ error: "User not found" })
    req.user = rows[0]
    next()
  } catch {
    res.status(401).json({ error: "Invalid token" })
  }
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "90d" }  // เปลี่ยนจาก 30d เป็น 90d
  )
}

module.exports = { signToken, requireAuth }
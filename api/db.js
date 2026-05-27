const mysql = require("mysql2/promise")
const fs = require("fs")
require("dotenv").config()

function getSslConfig() {
  if (process.env.DB_SSL !== "true") return undefined
  if (process.env.DB_CA_PATH) {
    return { ca: fs.readFileSync(process.env.DB_CA_PATH, "utf8") }
  }
  return { rejectUnauthorized: false }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  charset: "utf8mb4_unicode_ci",
  ssl: getSslConfig()
})

module.exports = pool

const fs = require("fs")
const path = require("path")
const mysql = require("mysql2/promise")
require("dotenv").config()

async function main() {
  const database = process.env.DB_NAME
  if (!database) throw new Error("DB_NAME is missing in api/.env")

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true
  })

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await connection.query(`USE \`${database}\``)

  const schemaPath = path.join(__dirname, "..", "schema.sql")
  const schema = fs.readFileSync(schemaPath, "utf8")
  await connection.query(schema)
  await connection.end()

  console.log(`Database "${database}" is ready.`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})

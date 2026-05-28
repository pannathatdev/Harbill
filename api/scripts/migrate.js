const fs = require("fs")
const path = require("path")
const mysql = require("mysql2/promise")
const { getPoolConfig } = require("../dbConfig")
require("dotenv").config()

async function main() {
  const config = getPoolConfig()
  const database = config.database
  if (!database) throw new Error("DB_NAME is missing in api/.env")

  const connection = await mysql.createConnection({
    host: config.host || "localhost",
    port: config.port || 3306,
    user: config.user || "root",
    password: config.password || "",
    ssl: config.ssl,
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

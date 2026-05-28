const fs = require("fs")

function readSslConfig(url) {
  const sslMode = url?.searchParams.get("ssl-mode")?.toLowerCase()
  const sslRequired = process.env.DB_SSL === "true" ||
    process.env.DB_SSL_MODE?.toLowerCase() === "required" ||
    sslMode === "required"

  if (!sslRequired) return undefined

  if (process.env.DB_CA_PATH) {
    return { ca: fs.readFileSync(process.env.DB_CA_PATH, "utf8") }
  }

  return { rejectUnauthorized: false }
}

function readUrlConfig() {
  const raw = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_URI
  if (!raw) return null

  const url = new URL(raw)
  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must start with mysql://")
  }

  return {
    source: "DATABASE_URL",
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: readSslConfig(url)
  }
}

function readEnvConfig() {
  const host = process.env.DB_HOST
  if (host?.includes("://")) {
    throw new Error("DB_HOST must be only the hostname. Put the full mysql:// URI in DATABASE_URL instead.")
  }

  return {
    source: "DB_*",
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: readSslConfig()
  }
}

function readDbConfig() {
  const config = readUrlConfig() || readEnvConfig()

  if (!Number.isInteger(config.port) || config.port <= 0) {
    throw new Error(`Invalid DB_PORT: ${config.port}`)
  }

  return config
}

function getPoolConfig() {
  const config = readDbConfig()
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
    charset: "utf8mb4_unicode_ci",
    ssl: config.ssl
  }
}

function getDebugInfo() {
  const config = readDbConfig()
  return {
    source: config.source,
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
    ssl: Boolean(config.ssl)
  }
}

module.exports = { getPoolConfig, getDebugInfo }

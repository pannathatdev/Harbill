const mysql = require("mysql2/promise")
const { getPoolConfig, getDebugInfo } = require("./dbConfig")
require("dotenv").config()

const pool = mysql.createPool(getPoolConfig())
pool.getDebugInfo = getDebugInfo

module.exports = pool

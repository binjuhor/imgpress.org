import mysql from 'mysql2/promise'
import { config } from '../config/index.js'

let db = null

export function getDb() {
  return db
}

export async function initDb() {
  if (!config.DB_HOST) return

  db = await mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
  })
  await db.execute(`
    CREATE TABLE IF NOT EXISTS allowed_domains (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      domain     VARCHAR(255) NOT NULL UNIQUE,
      note       VARCHAR(500) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('[ImgPress] Database connected')
}

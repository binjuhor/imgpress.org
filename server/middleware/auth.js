import { config } from '../config/index.js'
import { getDb } from '../database/index.js'

export async function checkDomain(req, res, next) {
  const db = getDb()
  if (!db) return next()

  const domain = (req.headers['x-site-domain'] || '').trim().toLowerCase()
  if (!domain) return res.status(401).json({ error: 'X-Site-Domain header required' })

  try {
    const [rows] = await db.execute('SELECT id FROM allowed_domains WHERE domain = ?', [domain])
    if (rows.length === 0) {
      return res.status(403).json({ error: `Domain not authorized: ${domain}` })
    }
    next()
  } catch (err) {
    console.error('[ImgPress] DB error in domain check:', err)
    next()
  }
}

export function requireAdmin(req, res, next) {
  if (!config.ADMIN_KEY) {
    return res.status(503).json({ error: 'Admin panel not configured — set ADMIN_KEY' })
  }
  if (req.headers['x-admin-key'] !== config.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

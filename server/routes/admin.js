import express from 'express'
import { getDb } from '../database/index.js'
import { requireAdmin } from '../middleware/auth.js'

export const adminRouter = express.Router()

adminRouter.get('/domains', requireAdmin, async (req, res) => {
  const db = getDb()
  if (!db) return res.json({ domains: [] })
  try {
    const [rows] = await db.execute(
      'SELECT id, domain, note, created_at FROM allowed_domains ORDER BY created_at DESC'
    )
    res.json({ domains: rows })
  } catch (err) {
    console.error('[ImgPress] DB error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

adminRouter.post('/domains', requireAdmin, async (req, res) => {
  const db = getDb()
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const domain = (req.body?.domain || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase()
  if (!domain) return res.status(400).json({ error: 'domain is required' })
  const note = (req.body?.note || '').trim() || null

  try {
    await db.execute('INSERT INTO allowed_domains (domain, note) VALUES (?, ?)', [domain, note])
    const [rows] = await db.execute(
      'SELECT id, domain, note, created_at FROM allowed_domains WHERE domain = ?',
      [domain]
    )
    res.json({ domain: rows[0] })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Domain already exists' })
    console.error('[ImgPress] DB error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

adminRouter.delete('/domains/:id', requireAdmin, async (req, res) => {
  const db = getDb()
  if (!db) return res.status(503).json({ error: 'Database not configured' })
  try {
    await db.execute('DELETE FROM allowed_domains WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('[ImgPress] DB error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

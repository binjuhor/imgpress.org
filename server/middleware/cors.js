export function cors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Site-Domain, X-Admin-Key')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
}

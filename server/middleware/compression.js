import multer from 'multer'
import { config } from '../config/index.js'

export const upload = multer({
  limits: {
    fileSize: Math.max(config.MAX_FILE_SIZE_MB, config.MAX_VIDEO_FILE_SIZE_MB) * 1024 * 1024,
    files: config.MAX_FILES,
  },
})

export function compressTimeout(req, res, next) {
  res.setTimeout(config.COMPRESS_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'Processing timeout — server is busy, please retry.' })
    }
  })
  next()
}

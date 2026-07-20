import crypto from 'crypto'
import path from 'path'
import express from 'express'
import { config } from '../config/index.js'
import { MIME_TO_EXT } from '../constants/media.js'
import { checkDomain } from '../middleware/auth.js'
import { compressTimeout, upload } from '../middleware/compression.js'
import { compressFile, validateFileSize } from '../services/compressor.js'
import { deleteJob, getJob, storeJob } from '../stores/jobStore.js'
import { parseNumber } from '../utils/options.js'

export const compressionRouter = express.Router()

function requestOptions(query) {
  return {
    quality: parseNumber(query.quality, config.DEFAULT_QUALITY),
    width: parseNumber(query.width, config.DEFAULT_WIDTH),
    format: query.format == null ? null : String(query.format),
  }
}

function compressionStats(name, originalSize, result) {
  return {
    name,
    mime: result.mime,
    originalSize,
    compressedSize: result.buffer.length,
    savedBytes: originalSize - result.buffer.length,
    ratio: Number(((1 - result.buffer.length / originalSize) * 100).toFixed(1)),
    error: false,
  }
}

compressionRouter.post('/compress/one', compressTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' })

    const { originalname: name, buffer } = req.file
    const originalSize = buffer.length
    const sizeError = validateFileSize(req.file)
    if (sizeError) return res.json({ name, originalSize, error: true, message: sizeError })

    try {
      const result = await compressFile(req.file, requestOptions(req.query))
      return res.json({
        ...compressionStats(name, originalSize, result),
        data: result.buffer.toString('base64'),
      })
    } catch (err) {
      return res.json({ name, originalSize, error: true, message: err.message })
    }
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'compress failed' })
  }
})

async function compressForDownload(file, options) {
  const name = file.originalname
  const originalSize = file.buffer.length
  const sizeError = validateFileSize(file)
  if (sizeError) return { name, originalSize, error: true, message: sizeError }

  try {
    const result = await compressFile(file, options)
    const id = crypto.randomUUID()
    const extension = result.passthrough
      ? name.split('.').pop() ?? 'bin'
      : MIME_TO_EXT[result.mime] ?? 'bin'
    const filename = `${path.basename(name, path.extname(name))}.${extension}`
    storeJob(id, { buffer: result.buffer, mime: result.mime, filename })

    return {
      ...compressionStats(name, originalSize, result),
      id,
      downloadUrl: `/api/download/${id}`,
    }
  } catch (err) {
    return { name, originalSize, error: true, message: err.message }
  }
}

compressionRouter.post('/api/compress', checkDomain, compressTimeout, upload.array('files', config.MAX_FILES), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'files field required (multipart/form-data)' })
    }
    const options = requestOptions(req.query)
    const results = await Promise.all(req.files.map(file => compressForDownload(file, options)))
    return res.json({ results })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'compress failed' })
  }
})

compressionRouter.get('/api/download/:id', (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return res.status(404).json({ error: 'file not found or expired' })

  res.setHeader('Content-Type', job.mime)
  res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`)
  res.setHeader('Content-Length', job.buffer.length)
  res.send(job.buffer)
  deleteJob(req.params.id)
})

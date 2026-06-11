import dotenv from 'dotenv'
import http from 'http'
import express from 'express'
import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execFileAsync = promisify(execFile)

const config = {
  PORT: parseInt(process.env.PORT || '3000'),
  SERVER_TIMEOUT_MS: parseInt(process.env.SERVER_TIMEOUT_MS || '300000'),
  KEEP_ALIVE_TIMEOUT_MS: parseInt(process.env.KEEP_ALIVE_TIMEOUT_MS || '360000'),
  HEADERS_TIMEOUT_MS: parseInt(process.env.HEADERS_TIMEOUT_MS || '361000'),
  MAX_IMAGE_SIDE_PX: parseInt(process.env.MAX_IMAGE_SIDE_PX || '20000'),
  MAX_IMAGE_MEGAPIXELS: parseInt(process.env.MAX_IMAGE_MEGAPIXELS || '200'),
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '50'),
  MAX_VIDEO_FILE_SIZE_MB: parseInt(process.env.MAX_VIDEO_FILE_SIZE_MB || '500'),
  MAX_FILES: parseInt(process.env.MAX_FILES || '20'),
  COMPRESS_TIMEOUT_MS: parseInt(process.env.COMPRESS_TIMEOUT_MS || '300000'),
  DEFAULT_QUALITY: parseInt(process.env.DEFAULT_QUALITY || '80'),
  DEFAULT_WIDTH: parseInt(process.env.DEFAULT_WIDTH || '1600'),
  MAX_QUALITY_NO_ALPHA: parseInt(process.env.MAX_QUALITY_NO_ALPHA || '85'),
  MAX_QUALITY_WITH_ALPHA: parseInt(process.env.MAX_QUALITY_WITH_ALPHA || '90'),
  DITHER_MAX: parseFloat(process.env.DITHER_MAX || '0.7'),
  DITHER_MIN: parseFloat(process.env.DITHER_MIN || '0.3'),
  SHARP_CONCURRENCY: parseInt(process.env.SHARP_CONCURRENCY || '0'),
}

const app = express()

const upload = multer({
  limits: {
    fileSize: Math.max(config.MAX_FILE_SIZE_MB, config.MAX_VIDEO_FILE_SIZE_MB) * 1024 * 1024,
    files: config.MAX_FILES
  }
})

sharp.cache(false)
sharp.concurrency(config.SHARP_CONCURRENCY)

const MAX_SIDE_PX = config.MAX_IMAGE_SIDE_PX
const MAX_MEGAPIXELS = config.MAX_IMAGE_MEGAPIXELS

const MIME_TO_FORMAT = {
  'image/jpeg': 'jpeg', 'image/jpg': 'jpeg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif':  'gif',
  'image/tiff': 'jpeg', 'image/bmp': 'jpeg',
  'image/heic': 'jpeg', 'image/heif': 'jpeg',
}

const AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/flac', 'audio/x-flac', 'audio/ogg', 'audio/aac',
  'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/opus',
  'audio/webm', 'audio/3gpp',
])

const VIDEO_MIMES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi',
  'video/x-matroska', 'video/x-ms-wmv', 'video/wmv', 'video/x-flv',
  'video/webm', 'video/3gpp', 'video/mpeg', 'video/x-mpeg',
  'video/m4v', 'video/x-m4v',
])

const COMPRESS_TIMEOUT_MS = config.COMPRESS_TIMEOUT_MS

function compressTimeout(req, res, next) {
  res.setTimeout(COMPRESS_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'Processing timeout — server is busy, please retry.' })
    }
  })
  next()
}

function parseNumber(value, fallback) {
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
}

// ─── Temp file helpers ────────────────────────────────────────────────────────

async function writeTempFile(buffer, ext = '') {
  const p = path.join(os.tmpdir(), `imgpress-${crypto.randomUUID()}${ext}`)
  await fs.writeFile(p, buffer)
  return p
}

async function removeTempFiles(...paths) {
  await Promise.all(paths.map(p => fs.unlink(p).catch(() => {})))
}

// ─── Image ────────────────────────────────────────────────────────────────────

async function analyzeImage(buffer) {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata()

  const w = meta.width  ?? 0
  const h = meta.height ?? 0

  if (w > MAX_SIDE_PX || h > MAX_SIDE_PX) {
    throw new Error(`Image too large: ${w}×${h}px (max ${MAX_SIDE_PX}px per side)`)
  }
  if (w * h > MAX_MEGAPIXELS * 1_000_000) {
    throw new Error(`Image too large: ${(w * h / 1_000_000).toFixed(0)}MP (max ${MAX_MEGAPIXELS}MP)`)
  }

  return {
    width: w,
    channels: meta.channels ?? 3,
    hasAlpha: meta.hasAlpha ?? false,
    isAnimated: (meta.pages ?? 1) > 1,
    space: meta.space ?? 'srgb'
  }
}

function smartQuality(requestedQuality, info) {
  const base = Math.min(Math.max(requestedQuality, 1), 100)
  const maxQualityNoAlpha = config.MAX_QUALITY_NO_ALPHA
  const maxQualityWithAlpha = config.MAX_QUALITY_WITH_ALPHA
  if (info.channels >= 3 && !info.hasAlpha) return Math.min(base, maxQualityNoAlpha)
  return Math.min(base, maxQualityWithAlpha)
}

function smartDither(q) {
  const ditherMax = config.DITHER_MAX
  const ditherMin = config.DITHER_MIN
  const raw = ditherMax - (q / 100) * (ditherMax - ditherMin)
  return parseFloat(Math.max(ditherMin, Math.min(ditherMax, raw)).toFixed(2))
}

async function compressImage(buffer, options = {}) {
  const defaultQuality = config.DEFAULT_QUALITY
  const defaultWidth = config.DEFAULT_WIDTH
  const { format = 'webp', quality = defaultQuality, width = defaultWidth } = options
  const info = await analyzeImage(buffer)
  const q = smartQuality(quality, info)

  let pipeline = sharp(buffer, { failOn: 'none', animated: info.isAnimated })
    .withMetadata({ exif: {} })

  if (info.width > width) {
    pipeline = pipeline.resize({ width, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
  }

  if (info.space !== 'srgb') pipeline = pipeline.toColorspace('srgb')

  let mime
  if (format === 'jpeg' || format === 'jpg') {
    pipeline = pipeline.jpeg({ quality: q, mozjpeg: true, progressive: true, optimiseCoding: true, trellisQuantisation: true, overshootDeringing: true, optimiseScans: true })
    mime = 'image/jpeg'
  } else if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: q, effort: 10, dither: smartDither(q) })
    mime = 'image/png'
  } else if (format === 'avif') {
    pipeline = pipeline.avif({ quality: Math.min(q, 70), effort: 6, chromaSubsampling: '4:2:0', lossless: false })
    mime = 'image/avif'
  } else if (format === 'gif') {
    pipeline = pipeline.gif({ effort: 10, dither: smartDither(q), interFrameMaxError: 8 })
    mime = 'image/gif'
  } else {
    pipeline = pipeline.webp({ quality: q, alphaQuality: Math.min(q + 5, 100), smartSubsample: true, effort: 6, lossless: false, nearLossless: false, preset: 'photo' })
    mime = 'image/webp'
  }

  const output = await pipeline.toBuffer({ resolveWithObject: true })
  return { buffer: output.data, info: output.info, mime }
}

// ─── HEIC pre-conversion ──────────────────────────────────────────────────────
// libheif needs the libde265 plugin to decode HEIC. If it isn't available (local
// dev, older Docker image), fall back to FFmpeg which handles HEIC via its own
// HEVC decoder.

const HEIC_MIMES = new Set(['image/heic', 'image/heif'])

async function heicToPng(buffer) {
  const inputPath  = await writeTempFile(buffer, '.heic')
  const outputPath = inputPath.replace('.heic', '.png')
  try {
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vframes', '1',
      '-vf', 'format=rgb24',  // materialise all colour channels before encoding
      '-y',
      outputPath,
    ], { timeout: COMPRESS_TIMEOUT_MS })
    return await fs.readFile(outputPath)
  } finally {
    await removeTempFiles(inputPath, outputPath)
  }
}

// ─── Audio ────────────────────────────────────────────────────────────────────

async function compressAudio(buffer, options = {}) {
  const { quality = config.DEFAULT_QUALITY } = options
  const bitrate = Math.round(32 + (quality / 100) * 288)

  const inputPath = await writeTempFile(buffer)
  const outputPath = inputPath + '.m4a'

  try {
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-c:a', 'aac',
      '-b:a', `${bitrate}k`,
      '-vn',
      '-y',
      outputPath,
    ], { timeout: COMPRESS_TIMEOUT_MS })

    const output = await fs.readFile(outputPath)
    return { buffer: output, mime: 'audio/mp4' }
  } finally {
    await removeTempFiles(inputPath, outputPath)
  }
}

// ─── Video ────────────────────────────────────────────────────────────────────

async function convertVideo(buffer, options = {}) {
  const { quality = config.DEFAULT_QUALITY } = options
  const crf = Math.round(28 - (quality / 100) * 10)

  const inputPath = await writeTempFile(buffer)
  const outputPath = inputPath + '.mp4'

  try {
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-crf', String(crf),
      '-preset', 'medium',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ], { timeout: COMPRESS_TIMEOUT_MS })

    const output = await fs.readFile(outputPath)
    return { buffer: output, mime: 'video/mp4' }
  } finally {
    await removeTempFiles(inputPath, outputPath)
  }
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

function pdfPreset(quality) {
  if (quality >= 75) return 'printer'
  if (quality >= 40) return 'ebook'
  return 'screen'
}

async function compressPdf(buffer, options = {}) {
  const { quality = config.DEFAULT_QUALITY } = options
  const preset = pdfPreset(quality)

  const inputPath = await writeTempFile(buffer, '.pdf')
  const outputPath = inputPath.replace('.pdf', '-out.pdf')

  try {
    await execFileAsync('gs', [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=/${preset}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ], { timeout: COMPRESS_TIMEOUT_MS })

    const output = await fs.readFile(outputPath)
    return { buffer: output, mime: 'application/pdf' }
  } finally {
    await removeTempFiles(inputPath, outputPath)
  }
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'))
})

app.use(express.static(path.join(__dirname, '../client')))

// ─── /compress/one ────────────────────────────────────────────────────────────

app.post('/compress/one', compressTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' })

    const mime     = req.file.mimetype
    const origSize = req.file.buffer.length
    const name     = req.file.originalname
    const quality  = parseNumber(req.query.quality, config.DEFAULT_QUALITY)
    const width    = parseNumber(req.query.width, config.DEFAULT_WIDTH)

    // Per-type size validation
    const isVideo = VIDEO_MIMES.has(mime)
    const maxMB   = isVideo ? config.MAX_VIDEO_FILE_SIZE_MB : config.MAX_FILE_SIZE_MB
    if (origSize > maxMB * 1024 * 1024) {
      return res.json({ name, originalSize: origSize, error: true, message: `File too large (max ${maxMB} MB for this type)` })
    }

    try {
      let result

      if (AUDIO_MIMES.has(mime)) {
        result = await compressAudio(req.file.buffer, { quality })
      } else if (isVideo) {
        result = await convertVideo(req.file.buffer, { quality })
      } else if (mime === 'application/pdf') {
        result = await compressPdf(req.file.buffer, { quality })
      } else {
        let imgBuffer = req.file.buffer
        let imgMime   = mime

        // HEIC/HEIF: always pre-convert via FFmpeg.
        // sharp().metadata() with failOn:'none' never throws even when libheif
        // lacks the HEVC codec, so a probe-based fallback never fires. FFmpeg
        // uses its own internal HEVC decoder and reliably handles HEIC.
        if (HEIC_MIMES.has(mime)) {
          imgBuffer = await heicToPng(imgBuffer)
          imgMime   = 'image/png'
        }

        const rawFormat = String(req.query.format || 'webp')
        const format = rawFormat === 'auto' ? (MIME_TO_FORMAT[imgMime] ?? 'webp') : rawFormat
        result = await compressImage(imgBuffer, { format, quality, width })
      }

      const { buffer, mime: outMime } = result
      return res.json({
        name,
        mime: outMime,
        originalSize: origSize,
        compressedSize: buffer.length,
        savedBytes: origSize - buffer.length,
        ratio: Number(((1 - buffer.length / origSize) * 100).toFixed(1)),
        data: buffer.toString('base64'),
        error: false,
      })
    } catch (err) {
      return res.json({ name, originalSize: origSize, error: true, message: err.message })
    }
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'compress failed' })
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = config.PORT
const server = http.createServer(app)

server.timeout          = config.SERVER_TIMEOUT_MS
server.keepAliveTimeout = config.KEEP_ALIVE_TIMEOUT_MS
server.headersTimeout   = config.HEADERS_TIMEOUT_MS

server.listen(PORT, '0.0.0.0', () => {
  console.log(`imgpress running on :${PORT} (timeout: ${server.timeout / 1000}s)`)
})

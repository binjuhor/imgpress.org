import fs from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import sharp from 'sharp'
import { config } from '../config/index.js'
import { removeTempFiles, writeTempFile } from '../utils/tempFiles.js'

const execFileAsync = promisify(execFile)

sharp.cache(false)
sharp.concurrency(config.SHARP_CONCURRENCY)

async function analyzeImage(buffer) {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0

  if (width > config.MAX_IMAGE_SIDE_PX || height > config.MAX_IMAGE_SIDE_PX) {
    throw new Error(`Image too large: ${width}×${height}px (max ${config.MAX_IMAGE_SIDE_PX}px per side)`)
  }
  if (width * height > config.MAX_IMAGE_MEGAPIXELS * 1_000_000) {
    throw new Error(`Image too large: ${(width * height / 1_000_000).toFixed(0)}MP (max ${config.MAX_IMAGE_MEGAPIXELS}MP)`)
  }

  return {
    width,
    channels: meta.channels ?? 3,
    hasAlpha: meta.hasAlpha ?? false,
    isAnimated: (meta.pages ?? 1) > 1,
    space: meta.space ?? 'srgb',
  }
}

function smartQuality(requestedQuality, info) {
  const base = Math.min(Math.max(requestedQuality, 1), 100)
  if (info.channels >= 3 && !info.hasAlpha) {
    return Math.min(base, config.MAX_QUALITY_NO_ALPHA)
  }
  return Math.min(base, config.MAX_QUALITY_WITH_ALPHA)
}

function smartDither(quality) {
  const raw = config.DITHER_MAX - (quality / 100) * (config.DITHER_MAX - config.DITHER_MIN)
  return parseFloat(Math.max(config.DITHER_MIN, Math.min(config.DITHER_MAX, raw)).toFixed(2))
}

export async function compressImage(buffer, options = {}) {
  const {
    format = 'webp',
    quality = config.DEFAULT_QUALITY,
    width = config.DEFAULT_WIDTH,
  } = options
  const info = await analyzeImage(buffer)
  const outputQuality = smartQuality(quality, info)

  let pipeline = sharp(buffer, { failOn: 'none', animated: info.isAnimated })
    .withMetadata({ exif: {} })

  if (info.width > width) {
    pipeline = pipeline.resize({ width, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
  }
  if (info.space !== 'srgb') pipeline = pipeline.toColorspace('srgb')

  let mime
  if (format === 'jpeg' || format === 'jpg') {
    pipeline = pipeline.jpeg({ quality: outputQuality, mozjpeg: true, progressive: true, optimiseCoding: true, trellisQuantisation: true, overshootDeringing: true, optimiseScans: true })
    mime = 'image/jpeg'
  } else if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: outputQuality, effort: 10, dither: smartDither(outputQuality) })
    mime = 'image/png'
  } else if (format === 'avif') {
    pipeline = pipeline.avif({ quality: Math.min(outputQuality, 70), effort: 6, chromaSubsampling: '4:2:0', lossless: false })
    mime = 'image/avif'
  } else if (format === 'gif') {
    pipeline = pipeline.gif({ effort: 10, dither: smartDither(outputQuality), interFrameMaxError: 8 })
    mime = 'image/gif'
  } else {
    pipeline = pipeline.webp({ quality: outputQuality, alphaQuality: Math.min(outputQuality + 5, 100), smartSubsample: true, effort: 6, lossless: false, nearLossless: false, preset: 'photo' })
    mime = 'image/webp'
  }

  const output = await pipeline.toBuffer({ resolveWithObject: true })
  return { buffer: output.data, info: output.info, mime }
}

export async function heicToPng(buffer) {
  const inputPath = await writeTempFile(buffer, '.heic')
  const outputPath = inputPath.replace('.heic', '.png')
  try {
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vframes', '1',
      '-vf', 'format=rgb24',
      '-y',
      outputPath,
    ], { timeout: config.COMPRESS_TIMEOUT_MS })
    return await fs.readFile(outputPath)
  } finally {
    await removeTempFiles(inputPath, outputPath)
  }
}

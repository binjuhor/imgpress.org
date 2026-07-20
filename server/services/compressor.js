import { config } from '../config/index.js'
import { AUDIO_MIMES, HEIC_MIMES, PASSTHROUGH_MIMES, VIDEO_MIMES } from '../constants/media.js'
import { requestedPdfImageFormat, resolveOutputFormat } from '../utils/options.js'
import { compressAudio } from './audio.js'
import { compressImage, heicToPng } from './image.js'
import { compressPdf, pdfToImage } from './pdf.js'
import { convertVideo } from './video.js'

export function validateFileSize(file) {
  const isVideo = VIDEO_MIMES.has(file.mimetype)
  const maxMB = isVideo ? config.MAX_VIDEO_FILE_SIZE_MB : config.MAX_FILE_SIZE_MB
  if (file.buffer.length > maxMB * 1024 * 1024) {
    return `File too large (max ${maxMB} MB for this type)`
  }
  return null
}

export async function compressFile(file, options) {
  const { quality, width, format } = options
  const mime = file.mimetype

  if (PASSTHROUGH_MIMES.has(mime)) {
    return { buffer: file.buffer, mime, passthrough: true }
  }
  if (AUDIO_MIMES.has(mime)) return compressAudio(file.buffer, { quality })
  if (VIDEO_MIMES.has(mime)) return convertVideo(file.buffer, { quality })

  if (mime === 'application/pdf') {
    const imageFormat = requestedPdfImageFormat(format)
    return imageFormat
      ? pdfToImage(file.buffer, { format: imageFormat, quality, width })
      : compressPdf(file.buffer, { quality })
  }

  let imageBuffer = file.buffer
  let imageMime = mime
  if (HEIC_MIMES.has(mime)) {
    imageBuffer = await heicToPng(imageBuffer)
    imageMime = 'image/png'
  }

  const outputFormat = resolveOutputFormat(format, imageMime, 'webp')
  return compressImage(imageBuffer, { format: outputFormat, quality, width })
}

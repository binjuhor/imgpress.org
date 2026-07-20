import { IMAGE_OUTPUT_FORMATS, MIME_TO_FORMAT } from '../constants/media.js'

export function parseNumber(value, fallback) {
  const number = Number(value)
  return Number.isNaN(number) ? fallback : number
}

export function resolveOutputFormat(requestedFormat, inputMime, fallback = 'webp') {
  const format = String(requestedFormat || fallback).toLowerCase()
  if (format === 'auto') return MIME_TO_FORMAT[inputMime] ?? fallback
  return IMAGE_OUTPUT_FORMATS.has(format) ? format : fallback
}

export function requestedPdfImageFormat(requestedFormat) {
  if (!requestedFormat) return null
  const format = String(requestedFormat).toLowerCase()
  if (format === 'auto') return null
  return IMAGE_OUTPUT_FORMATS.has(format) ? format : null
}

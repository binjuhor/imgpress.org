import dotenv from 'dotenv'

dotenv.config({ quiet: true })

function integer(name, fallback) {
  return parseInt(process.env[name] || fallback)
}

function decimal(name, fallback) {
  return parseFloat(process.env[name] || fallback)
}

export const config = {
  PORT: integer('PORT', '3000'),
  SERVER_TIMEOUT_MS: integer('SERVER_TIMEOUT_MS', '300000'),
  KEEP_ALIVE_TIMEOUT_MS: integer('KEEP_ALIVE_TIMEOUT_MS', '360000'),
  HEADERS_TIMEOUT_MS: integer('HEADERS_TIMEOUT_MS', '361000'),
  MAX_IMAGE_SIDE_PX: integer('MAX_IMAGE_SIDE_PX', '20000'),
  MAX_IMAGE_MEGAPIXELS: integer('MAX_IMAGE_MEGAPIXELS', '200'),
  MAX_FILE_SIZE_MB: integer('MAX_FILE_SIZE_MB', '50'),
  MAX_VIDEO_FILE_SIZE_MB: integer('MAX_VIDEO_FILE_SIZE_MB', '500'),
  MAX_FILES: integer('MAX_FILES', '20'),
  COMPRESS_TIMEOUT_MS: integer('COMPRESS_TIMEOUT_MS', '300000'),
  DEFAULT_QUALITY: integer('DEFAULT_QUALITY', '80'),
  DEFAULT_WIDTH: integer('DEFAULT_WIDTH', '1600'),
  MAX_QUALITY_NO_ALPHA: integer('MAX_QUALITY_NO_ALPHA', '85'),
  MAX_QUALITY_WITH_ALPHA: integer('MAX_QUALITY_WITH_ALPHA', '90'),
  DITHER_MAX: decimal('DITHER_MAX', '0.7'),
  DITHER_MIN: decimal('DITHER_MIN', '0.3'),
  SHARP_CONCURRENCY: integer('SHARP_CONCURRENCY', '0'),
  JOB_TTL_MS: integer('JOB_TTL_MS', '3600000'),
  DB_HOST: process.env.DB_HOST || '',
  DB_PORT: integer('DB_PORT', '3306'),
  DB_USER: process.env.DB_USER || 'imgpress',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'imgpress',
  ADMIN_KEY: process.env.ADMIN_KEY || '',
}

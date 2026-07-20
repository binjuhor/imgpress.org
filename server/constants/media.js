export const MIME_TO_FORMAT = {
  'image/jpeg': 'jpeg', 'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/tiff': 'jpeg', 'image/bmp': 'jpeg',
  'image/heic': 'jpeg', 'image/heif': 'jpeg',
}

export const IMAGE_OUTPUT_FORMATS = new Set(['webp', 'avif', 'jpeg', 'jpg', 'png', 'gif'])
export const PASSTHROUGH_MIMES = new Set(['image/svg+xml'])
export const HEIC_MIMES = new Set(['image/heic', 'image/heif'])

export const AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/flac', 'audio/x-flac', 'audio/ogg', 'audio/aac',
  'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/opus',
  'audio/webm', 'audio/3gpp',
])

export const VIDEO_MIMES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi',
  'video/x-matroska', 'video/x-ms-wmv', 'video/wmv', 'video/x-flv',
  'video/webm', 'video/3gpp', 'video/mpeg', 'video/x-mpeg',
  'video/m4v', 'video/x-m4v',
])

export const MIME_TO_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/avif': 'avif', 'image/gif': 'gif',
  'audio/mp4': 'm4a', 'video/mp4': 'mp4', 'application/pdf': 'pdf',
}

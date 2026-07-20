import fs from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { config } from '../config/index.js'
import { removeTempFiles, writeTempFile } from '../utils/tempFiles.js'

const execFileAsync = promisify(execFile)

export async function compressAudio(buffer, options = {}) {
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
    ], { timeout: config.COMPRESS_TIMEOUT_MS })
    return { buffer: await fs.readFile(outputPath), mime: 'audio/mp4' }
  } finally {
    await removeTempFiles(inputPath, outputPath)
  }
}

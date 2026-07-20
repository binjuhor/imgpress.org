import fs from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { config } from '../config/index.js'
import { removeTempFiles, writeTempFile } from '../utils/tempFiles.js'

const execFileAsync = promisify(execFile)

export async function convertVideo(buffer, options = {}) {
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
    ], { timeout: config.COMPRESS_TIMEOUT_MS })
    return { buffer: await fs.readFile(outputPath), mime: 'video/mp4' }
  } finally {
    await removeTempFiles(inputPath, outputPath)
  }
}

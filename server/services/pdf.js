import fs from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { config } from '../config/index.js'
import { removeTempFiles, writeTempFile } from '../utils/tempFiles.js'
import { compressImage } from './image.js'

const execFileAsync = promisify(execFile)

function pdfPreset(quality) {
  if (quality >= 75) return 'printer'
  if (quality >= 40) return 'ebook'
  return 'screen'
}

export async function compressPdf(buffer, options = {}) {
  const { quality = config.DEFAULT_QUALITY } = options
  const inputPath = await writeTempFile(buffer, '.pdf')
  const outputPath = inputPath.replace('.pdf', '-out.pdf')

  try {
    await execFileAsync('gs', [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=/${pdfPreset(quality)}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ], { timeout: config.COMPRESS_TIMEOUT_MS })
    return { buffer: await fs.readFile(outputPath), mime: 'application/pdf' }
  } finally {
    await removeTempFiles(inputPath, outputPath)
  }
}

export async function pdfToImage(buffer, options = {}) {
  const {
    format = 'png',
    quality = config.DEFAULT_QUALITY,
    width = config.DEFAULT_WIDTH,
  } = options
  const inputPath = await writeTempFile(buffer, '.pdf')
  const renderPath = inputPath.replace('.pdf', '-page-1.png')

  try {
    await execFileAsync('gs', [
      '-sDEVICE=pngalpha',
      '-dFirstPage=1',
      '-dLastPage=1',
      '-r144',
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${renderPath}`,
      inputPath,
    ], { timeout: config.COMPRESS_TIMEOUT_MS })
    const rendered = await fs.readFile(renderPath)
    return compressImage(rendered, { format, quality, width })
  } finally {
    await removeTempFiles(inputPath, renderPath)
  }
}

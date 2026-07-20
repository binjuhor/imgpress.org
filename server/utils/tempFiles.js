import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export async function writeTempFile(buffer, ext = '') {
  const filePath = path.join(os.tmpdir(), `imgpress-${crypto.randomUUID()}${ext}`)
  await fs.writeFile(filePath, buffer)
  return filePath
}

export async function removeTempFiles(...paths) {
  await Promise.all(paths.map(filePath => fs.unlink(filePath).catch(() => {})))
}

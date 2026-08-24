import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { compressImage } from '../services/image.js'

test('PNG output preserves true-color pixels', async () => {
  const width = 32
  const height = 32
  const pixels = Buffer.alloc(width * height * 3)

  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 3] = index & 0xff
    pixels[index * 3 + 1] = (index >> 2) & 0xff
    pixels[index * 3 + 2] = (index >> 4) & 0xff
  }

  const input = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()
  const result = await compressImage(input, { format: 'png', quality: 80, width })
  const decoded = await sharp(result.buffer).raw().toBuffer()

  assert.equal(result.mime, 'image/png')
  assert.deepEqual(decoded, pixels)
})

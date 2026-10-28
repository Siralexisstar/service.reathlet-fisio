import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'

// Synthetic image only: no patient image or signature is used in tests.
export function signatureDataUrl(width = 960, height = 300, raw?: Buffer, metadata?: string) {
  function chunk(type: string, data: Buffer) {
    const bytes = Buffer.concat([Buffer.from(type), data])
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    const result = Buffer.alloc(data.length + 12)
    result.writeUInt32BE(data.length)
    bytes.copy(result, 4)
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4)
    return result
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const image = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    ...(metadata ? [chunk('tEXt', Buffer.from(metadata))] : []),
    chunk('IDAT', deflateSync(raw ?? Buffer.alloc((width * 4 + 1) * height))), chunk('IEND', Buffer.alloc(0)),
  ])
  return `data:image/png;base64,${image.toString('base64')}`
}

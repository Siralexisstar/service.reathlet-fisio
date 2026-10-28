import { Buffer } from 'node:buffer'
import { inflateSync } from 'node:zlib'
import { availabilityOptions, durationOptions, regionOptions } from '../src/lib/firstVisit.js'
import type { FullRequest } from '../src/lib/firstVisit.js'

export const maxFullBodyBytes = 256 * 1024
const maxPngBytes = 128 * 1024
const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function keys(value: unknown, required: string[], optional: string[] = []): value is Record<string, unknown> {
  return record(value) && required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => required.includes(key) || optional.includes(key))
}

function text(value: unknown, min: number, max: number, multiline = false): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max
    && !/\p{Cc}/u.test(multiline ? value.replace(/[\r\n]/g, '') : value)
}

// Check chunk integrity without a PNG dependency (Node 20 has no zlib.crc32).
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function signaturePng(value: string): string | null {
  const prefix = 'data:image/png;base64,'
  if (!value.startsWith(prefix) || value.length > prefix.length + 4 * Math.ceil(maxPngBytes / 3)) return null
  const encoded = value.slice(prefix.length)
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null
  const png = Buffer.from(encoded, 'base64')
  if (png.length > maxPngBytes || png.toString('base64') !== encoded || !png.subarray(0, 8).equals(pngHeader)) return null
  const chunks: Buffer[] = [pngHeader]
  const compressed: Buffer[] = []
  let offset = 8
  let header = false
  let ended = false
  let imageEnded = false
  try {
    while (offset < png.length) {
      if (offset + 12 > png.length) return null
      const length = png.readUInt32BE(offset)
      const end = offset + length + 12
      if (end > png.length) return null
      const kind = png.toString('latin1', offset + 4, offset + 8)
      if (!/^[A-Za-z]{4}$/.test(kind) || crc32(png.subarray(offset + 4, end - 4)) !== png.readUInt32BE(end - 4)) return null
      const data = png.subarray(offset + 8, end - 4)
      if (kind === 'IHDR') {
        if (header || offset !== 8 || length !== 13 || data.readUInt32BE(0) !== 960
          || data.readUInt32BE(4) !== 300 || !data.subarray(8).equals(Buffer.from([8, 6, 0, 0, 0]))) return null
        header = true
      } else if (!header) return null
      else if (kind === 'IDAT') {
        if (imageEnded) return null
        compressed.push(data)
      } else if (kind === 'IEND') {
        if (length !== 0 || compressed.length === 0 || end !== png.length) return null
        ended = true
      } else {
        // Reject unknown critical chunks; strip ancillary metadata/animation.
        if (kind[0] === kind[0].toUpperCase()) return null
        if (compressed.length) imageEnded = true
        offset = end
        continue
      }
      chunks.push(png.subarray(offset, end))
      offset = end
    }
    if (!ended) return null
    const rowBytes = 960 * 4 + 1
    const decoded = inflateSync(Buffer.concat(compressed), { maxOutputLength: rowBytes * 300 })
    if (decoded.length !== rowBytes * 300) return null
    for (let row = 0; row < 300; row++) if (decoded[row * rowBytes] > 4) return null
    return Buffer.concat(chunks).toString('base64')
  } catch {
    return null
  }
}

// Contact email validation remains in the endpoint, shared with the legacy path.
export function validateFullRequest(data: Record<string, unknown>): { data: FullRequest; attachment?: string } | null {
  if (!keys(data, ['version', 'tipoPaciente', 'nombre', 'email', 'administrativo', 'clinico', 'consentimientos', 'firma'], ['website'])
    || data.version !== 2 || data.tipoPaciente !== 'NUEVO' || !text(data.nombre, 2, 100)
    || !text(data.email, 1, 160)) return null
  const admin = data.administrativo
  const clinical = data.clinico
  const consent = data.consentimientos
  const signature = data.firma
  if (!keys(admin, ['telefono', 'preferenciaHoraria', 'canal']) || !text(admin.telefono, 0, 20)
    || (admin.telefono.trim() !== '' && !/^\+?[\d ()-]{7,20}$/.test(admin.telefono.trim()))
    || typeof admin.preferenciaHoraria !== 'string' || !availabilityOptions.includes(admin.preferenciaHoraria)
    || admin.canal !== 'EMAIL') return null
  if (!keys(clinical, ['zona', 'duracion', 'motivo', 'dolorActual', 'antecedentes', 'medicacionAlergias'])
    || typeof clinical.zona !== 'string' || !regionOptions.includes(clinical.zona)
    || typeof clinical.duracion !== 'string' || !durationOptions.includes(clinical.duracion)
    || !text(clinical.motivo, 10, 1000, true) || !text(clinical.antecedentes, 0, 1000, true)
    || !text(clinical.medicacionAlergias, 0, 300)
    || (clinical.dolorActual !== null && (typeof clinical.dolorActual !== 'number'
      || !Number.isInteger(clinical.dolorActual) || clinical.dolorActual < 0 || clinical.dolorActual > 10))) return null
  if (!keys(consent, ['privacidad', 'salud']) || consent.privacidad !== true || consent.salud !== true || !record(signature)) return null
  let attachment: string | undefined
  if (signature.tipo === 'ESCRITA') {
    if (!keys(signature, ['tipo', 'texto']) || !text(signature.texto, 3, 100)) return null
  } else if (signature.tipo === 'DIBUJADA') {
    if (!keys(signature, ['tipo', 'png']) || typeof signature.png !== 'string') return null
    attachment = signaturePng(signature.png) ?? undefined
    if (!attachment) return null
  } else return null
  // Every field has been checked; do not echo or log the returned object.
  return { data: data as FullRequest, ...(attachment && { attachment }) }
}

export function fullRequestText(data: FullRequest): string {
  const value = (text: string) => text.trim().replace(/\r\n?/g, '\n').replace(/\n/g, '\n  ') || 'No indicado'
  return [
    'FORMULARIO DE PRUEBA — DATOS FICTICIOS',
    '1. DATOS PERSONALES Y CONTACTO',
    `Tipo de paciente: ${data.tipoPaciente}`, `Nombre: ${value(data.nombre)}`,
    `Email: ${value(data.email)}`, `Teléfono: ${value(data.administrativo.telefono)}`,
    '', '2. INFORMACIÓN DE LA SOLICITUD',
    `Preferencia horaria: ${data.administrativo.preferenciaHoraria}`, 'Canal de contacto: EMAIL',
    '', '3. MOTIVO DE CONSULTA',
    `Zona: ${data.clinico.zona}`, `Duración: ${data.clinico.duracion}`,
    `Motivo y objetivo de recuperación: ${value(data.clinico.motivo)}`,
    `Intensidad del dolor: ${data.clinico.dolorActual === null ? 'No indicado' : `${data.clinico.dolorActual}/10`}`,
    '', '4. ANTECEDENTES Y SALUD',
    `Lesiones, cirugías o antecedentes: ${value(data.clinico.antecedentes)}`,
    `Medicación o alergias: ${value(data.clinico.medicacionAlergias)}`,
    '', '5. PRIVACIDAD Y CONSENTIMIENTOS',
    'Lectura de privacidad: Sí', 'Consentimiento para tratar información de salud: Sí',
    `Modalidad de firma: ${data.firma.tipo}`,
    '', '6. FIRMA DEL PACIENTE',
    data.firma.tipo === 'ESCRITA' ? `Firma escrita: ${value(data.firma.texto)}` : 'Firma dibujada: adjunto firma-paciente.png',
    '', 'Firma de demostración. No constituye un consentimiento legal registrado.',
    'Solicitud pendiente de revisión. No confirma una cita.',
  ].join('\n')
}

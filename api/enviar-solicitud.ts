import { Buffer } from 'node:buffer'
import { fullRequestText, maxFullBodyBytes, validateFullRequest } from '../server/first-visit.js'

type Solicitud = {
  tipoPaciente: 'NUEVO' | 'HABITUAL'
  nombre: string
  email: string
}

type FieldErrors = Partial<Record<keyof Solicitud, string>>

const emailPattern = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(status: number, body: object, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  })
}

function invalid(error: string, fields?: FieldErrors) {
  return json(400, { validated: false, sent: false, error, ...(fields && { fields }) })
}

async function readBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxFullBodyBytes) {
        await reader.cancel()
        throw new RangeError('Body limit')
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks).toString('utf8')
  } finally {
    reader.releaseLock()
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json(405, {
        validated: false, sent: false, error: 'Método no permitido. Utiliza POST.',
      }, { Allow: 'POST' })
    }

    const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (contentType !== 'application/json') {
      return json(415, {
        validated: false, sent: false, error: 'Content-Type debe ser application/json.',
      })
    }

    let body: unknown
    let bodyBytes: number
    try {
      const text = await readBody(request)
      bodyBytes = Buffer.byteLength(text, 'utf8')
      body = JSON.parse(text)
    } catch (error) {
      if (error instanceof RangeError) return json(413, {
        validated: false, sent: false, error: 'La solicitud supera el tamaño permitido.',
      })
      return invalid('El cuerpo debe contener JSON válido.')
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return invalid('El cuerpo debe ser un objeto JSON.')
    }

    const data = body as Record<string, unknown>
    const full = data.version === 2
    if (!full && bodyBytes > 4096) return json(413, {
      validated: false, sent: false, error: 'El cuerpo no puede superar 4096 bytes.',
    })
    const allowedFields = ['tipoPaciente', 'nombre', 'email', 'website']
    if (!full && Object.keys(body).some(key => !allowedFields.includes(key))) {
      return invalid('La solicitud contiene campos no admitidos. No incluyas información médica ni firmas.')
    }

    if ('website' in data && data.website !== '') {
      return invalid('No se ha podido procesar la solicitud.')
    }
    const fields: FieldErrors = {}
    if (data.tipoPaciente !== 'NUEVO' && data.tipoPaciente !== 'HABITUAL') {
      fields.tipoPaciente = 'Debe ser NUEVO o HABITUAL.'
    }
    if (typeof data.nombre !== 'string' || !data.nombre.trim() || data.nombre.length > 160
      || /\p{Cc}/u.test(data.nombre)) {
      fields.nombre = 'Debe ser un texto no vacío de hasta 160 caracteres, sin caracteres de control.'
    }
    if (typeof data.email !== 'string' || data.email.length > 254
      || !emailPattern.test(data.email.trim()) || data.email.trim().split('@')[0].length > 64
      || /\p{Cc}/u.test(data.email)) {
      fields.email = 'Debe ser un email válido de hasta 254 caracteres.'
    }
    if (Object.keys(fields).length) {
      return invalid('Revisa los campos obligatorios.', fields)
    }

    const fullRequest = full ? validateFullRequest(data) : null
    if (full && !fullRequest) return invalid('Revisa los campos del formulario y la firma.')

    const requestId = request.headers.get('Idempotency-Key')
    if (!requestId || !requestIdPattern.test(requestId)) {
      return invalid('El identificador de la solicitud no es válido.')
    }

    // Opt in explicitly in every environment; all other values fail closed.
    if (full && process.env.RESEND_FULL_FORM_ENABLED !== 'true') {
      return json(503, {
        validated: true, sent: false, code: 'FULL_FORM_DISABLED',
        error: 'El envío del formulario completo de prueba está desactivado.',
      })
    }

    const apiKey = process.env.RESEND_API_KEY?.trim()
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()
    const toEmail = process.env.RESEND_TO_EMAIL?.trim()
    if (!apiKey || !fromEmail || !toEmail) {
      return json(500, {
        validated: true, sent: false, error: 'El servicio de correo no está configurado.',
      })
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `reathlet-solicitud/${requestId.toLowerCase()}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          reply_to: (data.email as string).trim(),
          subject: `Reathlet - Nueva solicitud - ${data.tipoPaciente}`,
          text: fullRequest ? fullRequestText(fullRequest.data) : [
            `Tipo de paciente: ${data.tipoPaciente}`,
            `Nombre: ${(data.nombre as string).trim()}`,
            `Correo electrónico: ${(data.email as string).trim()}`,
          ].join('\n'),
          ...(fullRequest?.attachment && { attachments: [{
            filename: 'firma-paciente.png', content: fullRequest.attachment,
          }] }),
        }),
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      })
      if (response.status === 409) {
        return json(409, {
          validated: true,
          sent: false,
          error: 'No se ha podido completar el envío. Revisa la solicitud e inténtalo de nuevo.',
        })
      }
      // An HTTP success alone does not confirm acceptance: Resend must return an id.
      const result: unknown = response.ok ? await response.json() : null
      if (typeof result === 'object' && result !== null && 'id' in result
        && typeof result.id === 'string' && result.id.trim() && !('error' in result)) {
        return json(200, {
          validated: true,
          sent: true,
          message: 'Resend ha aceptado el envío. La entrega al buzón no está confirmada.',
        })
      }
    } catch {
      // Do not expose provider responses, request data or credentials in errors/logs.
    }

    return json(502, {
      validated: true,
      sent: false,
      error: 'No se ha podido confirmar la aceptación del envío por Resend.',
    })
  },
}

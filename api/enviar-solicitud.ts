import { Buffer } from 'node:buffer'

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
    try {
      const text = await request.text()
      if (Buffer.byteLength(text, 'utf8') > 4096) {
        return json(413, {
          validated: false, sent: false, error: 'El cuerpo no puede superar 4096 bytes.',
        })
      }
      body = JSON.parse(text)
    } catch {
      return invalid('El cuerpo debe contener JSON válido.')
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return invalid('El cuerpo debe ser un objeto JSON.')
    }

    const allowedFields = ['tipoPaciente', 'nombre', 'email', 'website']
    if (Object.keys(body).some(key => !allowedFields.includes(key))) {
      return invalid('La solicitud contiene campos no admitidos. No incluyas información médica ni firmas.')
    }

    const data = body as Record<string, unknown>
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

    const requestId = request.headers.get('Idempotency-Key')
    if (!requestId || !requestIdPattern.test(requestId)) {
      return invalid('El identificador de la solicitud no es válido.')
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
          text: [
            `Tipo de paciente: ${data.tipoPaciente}`,
            `Nombre: ${(data.nombre as string).trim()}`,
            `Correo electrónico: ${(data.email as string).trim()}`,
          ].join('\n'),
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

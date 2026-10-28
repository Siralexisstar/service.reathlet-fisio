import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test, { afterEach, beforeEach, mock } from 'node:test'
import endpoint from '../api/enviar-solicitud.js'
import { signatureDataUrl } from './png-fixture.js'

const valid = { tipoPaciente: 'NUEVO', nombre: 'Paciente ficticio', email: 'prueba@example.com' }
const fakeApiKey = 'test-resend-key-not-a-real-secret'
const fakeConfiguration = {
  RESEND_API_KEY: fakeApiKey,
  RESEND_FROM_EMAIL: 'sender@example.com',
  RESEND_TO_EMAIL: 'appointments@example.com',
  RESEND_FULL_FORM_ENABLED: 'false',
}
let previousEnvironment: Record<string, string | undefined> = {}

beforeEach(() => {
  previousEnvironment = {}
  for (const [name, value] of Object.entries(fakeConfiguration)) {
    previousEnvironment[name] = process.env[name]
    process.env[name] = value
  }
  for (const name of ['NODE_ENV', 'VERCEL_ENV']) previousEnvironment[name] = process.env[name]
  // Replace fetch before every test: no test can send a real email.
  mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
})

afterEach(() => {
  mock.restoreAll()
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

function post(body: unknown, requestId: string | null = randomUUID()) {
  return endpoint.fetch(new Request('http://localhost/api/enviar-solicitud', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(requestId !== null && { 'Idempotency-Key': requestId }) },
    body: JSON.stringify(body),
  }))
}

async function failure(response: Response, status: number, validated = false) {
  assert.equal(response.status, status)
  const body = await response.json()
  assert.ok(typeof body === 'object' && body !== null)
  assert.ok('validated' in body && body.validated === validated)
  assert.ok('sent' in body && body.sent === false)
  assert.ok('error' in body && typeof body.error === 'string')
  return body
}

test('uses server-configured from/to and the validated patient reply_to for both patient types', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  for (const tipoPaciente of ['NUEVO', 'HABITUAL']) {
    const response = await post({ ...valid, tipoPaciente })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(response.headers.get('content-type') ?? '', /application\/json/)
    assert.deepEqual(await response.json(), {
      validated: true,
      sent: true,
      message: 'Resend ha aceptado el envío. La entrega al buzón no está confirmada.',
    })
  }
  assert.equal(resend.mock.callCount(), 2)
  for (const [index, call] of resend.mock.calls.entries()) {
    const [url, options] = call.arguments as unknown as [string, RequestInit]
    const tipoPaciente = ['NUEVO', 'HABITUAL'][index]
    assert.equal(url, 'https://api.resend.com/emails')
    assert.equal(options.method, 'POST')
    const idempotencyKey = (options.headers as Record<string, string>)['Idempotency-Key']
    assert.match(idempotencyKey, /^reathlet-solicitud\/[0-9a-f-]{36}$/)
    assert.deepEqual(options.headers, {
      Authorization: `Bearer ${fakeApiKey}`, 'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    })
    assert.deepEqual(JSON.parse(options.body as string), {
      from: fakeConfiguration.RESEND_FROM_EMAIL,
      to: [fakeConfiguration.RESEND_TO_EMAIL],
      reply_to: valid.email,
      subject: `Reathlet - Nueva solicitud - ${tipoPaciente}`,
      text: `Tipo de paciente: ${tipoPaciente}\nNombre: ${valid.nombre}\nCorreo electrónico: ${valid.email}`,
    })
    assert.ok(options.signal instanceof AbortSignal)
    assert.equal(options.redirect, 'error')
  }
})

test('accepts an empty optional honeypot but rejects filled or invalid values without contacting Resend', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  assert.equal((await post({ ...valid, website: '' })).status, 200)
  assert.equal(resend.mock.callCount(), 1)
  const [, options] = resend.mock.calls[0].arguments as unknown as [string, RequestInit]
  assert.equal('website' in JSON.parse(options.body as string), false)
  for (const website of ['bot', ' ', 'x'.repeat(4096), null, false, 1, [], {}]) {
    const response = await post({ ...valid, website })
    await failure(response, website === 'x'.repeat(4096) ? 413 : 400)
  }
  const result = await (await post({ ...valid, website: 'bot' })).json()
  assert.deepEqual(result, { validated: false, sent: false, error: 'No se ha podido procesar la solicitud.' })
  assert.equal(resend.mock.callCount(), 1)
})

test('requires a UUID v4 idempotency header and rejects incorrect identifiers before contacting Resend', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call Resend') })
  for (const id of [null, '', 'not-a-uuid', valid.email, 'x'.repeat(257),
    '00000000-0000-0000-0000-000000000000', '12345678-1234-4123-0123-123456789abc',
    `${randomUUID()},${randomUUID()}`]) {
    await failure(await post(valid, id), 400)
  }
  assert.equal(resend.mock.callCount(), 0)
})

test('retries forward the same canonical key and email payload; a new request gets another key', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  const id = randomUUID()
  for (const key of [id, id, id.toUpperCase(), randomUUID()]) {
    assert.equal((await post(valid, key)).status, 200)
  }
  const calls = resend.mock.calls.map(call => (call.arguments as unknown as [string, RequestInit])[1])
  const keys = calls.map(call => (call.headers as Record<string, string>)['Idempotency-Key'])
  assert.deepEqual(keys.slice(0, 3), Array(3).fill(`reathlet-solicitud/${id}`))
  assert.notEqual(keys[0], keys[3])
  assert.ok(calls.every(call => call.body === calls[0].body))
  assert.equal(resend.mock.callCount(), 4) // Deduplication belongs to Resend, not local function state.
})

test('provider idempotency conflicts have controlled responses without internal details', async () => {
  for (const name of ['invalid_idempotent_request', 'concurrent_idempotent_requests']) {
    const resend = mock.method(globalThis, 'fetch', async () => Response.json({
      name, message: `Internal details: ${fakeApiKey} ${valid.email}`,
    }, { status: 409 }))
    const result = await failure(await post(valid), 409, true)
    assert.deepEqual(result, {
      validated: true, sent: false,
      error: 'No se ha podido completar el envío. Revisa la solicitud e inténtalo de nuevo.',
    })
    assert.equal(resend.mock.callCount(), 1)
  }
})

test('accepts boundary lengths and surrounding spaces in contact fields', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`
  assert.equal(email.length, 254)
  assert.equal((await post({ ...valid, nombre: 'a'.repeat(160), email })).status, 200)
  assert.equal((await post({ ...valid, nombre: ' Paciente ficticio ', email: ' prueba@example.com ' })).status, 200)
  const [, options] = resend.mock.calls[1].arguments as unknown as [string, RequestInit]
  assert.equal(JSON.parse(options.body as string).reply_to, valid.email)
  assert.equal(JSON.parse(options.body as string).text,
    `Tipo de paciente: NUEVO\nNombre: ${valid.nombre}\nCorreo electrónico: ${valid.email}`)
})

test('reads from/to at request time and trims the configured values', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  process.env.RESEND_FROM_EMAIL = ' Reathlet <sender@example.org> '
  process.env.RESEND_TO_EMAIL = ' test-inbox@example.org '
  assert.equal((await post(valid)).status, 200)
  const [, options] = resend.mock.calls[0].arguments as unknown as [string, RequestInit]
  const payload = JSON.parse(options.body as string)
  assert.equal(payload.from, 'Reathlet <sender@example.org>')
  assert.deepEqual(payload.to, ['test-inbox@example.org'])
  assert.equal(payload.reply_to, valid.email)
})

test('rejects invalid structure, missing fields, wrong types, empty values and excessive lengths', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call Resend') })
  const invalidBodies: unknown[] = [null, [], 'texto', 42, true, {},
    ...Object.keys(valid).map(key => Object.fromEntries(Object.entries(valid).filter(([field]) => field !== key))),
    ...['nuevo', '', ' ', 1, null, {}, []].map(tipoPaciente => ({ ...valid, tipoPaciente })),
    ...['', '  ', 1, null, {}, [], 'a'.repeat(161), 'Nombre\nApellido'].map(nombre => ({ ...valid, nombre })),
    ...['', '  ', 1, null, {}, [], 'sin-arroba', 'a@b', 'a@@example.com', 'a b@example.com',
      'a@example.com\r\n', 'a..b@example.com', '.a@example.com', 'a@example..com',
      '<a>@example.com', 'a@-example.com', 'a@example-.com', 'a@exam_ple.com',
      `${'a'.repeat(65)}@example.com`, `${'a'.repeat(243)}@example.com`].map(email => ({ ...valid, email })),
    { ...valid, historia: 'Información ficticia' }, { ...valid, firma: 'Firma ficticia' },
    { ...valid, to: 'another@example.com' }, { ...valid, destinatario: 'another@example.com' },
    { ...valid, from: 'another@example.com' }, { ...valid, reply_to: 'another@example.com' },
  ]
  for (const body of invalidBodies) {
    const response = await post(body)
    const result = await failure(response, 400)
    assert.equal(JSON.stringify(result).includes(valid.email), false)
  }
  assert.equal(resend.mock.callCount(), 0)
})

test('rejects malformed or empty JSON', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call Resend') })
  for (const body of ['', '{', '{"nombre":}']) {
    const response = await endpoint.fetch(new Request('http://localhost/api/enviar-solicitud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    }))
    await failure(response, 400)
  }
  assert.equal(resend.mock.callCount(), 0)
})

test('rejects unsupported content types and bodies above 4096 bytes', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call Resend') })
  for (const headers of [{}, { 'Content-Type': 'text/plain' }]) {
    const response = await endpoint.fetch(new Request('http://localhost/api/enviar-solicitud', {
      method: 'POST', headers, body: JSON.stringify(valid),
    }))
    await failure(response, 415)
  }
  const response = await post({ ...valid, nombre: 'á'.repeat(4096) })
  await failure(response, 413)
  assert.equal(resend.mock.callCount(), 0)
})

test('rejects methods other than POST and advertises the allowed method', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call Resend') })
  for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await endpoint.fetch(new Request('http://localhost/api/enviar-solicitud', { method }))
    assert.equal(response.headers.get('allow'), 'POST')
    await failure(response, 405)
  }
  assert.equal(resend.mock.callCount(), 0)
})

test('rejects missing or blank server configuration without contacting Resend', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call Resend') })
  for (const [name, configuredValue] of Object.entries(fakeConfiguration).filter(([name]) => name !== 'RESEND_FULL_FORM_ENABLED')) {
    for (const value of [undefined, '', '   ']) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
      const result = await failure(await post(valid), 500, true)
      assert.deepEqual(result, {
        validated: true, sent: false, error: 'El servicio de correo no está configurado.',
      })
      await failure(await post({}), 400)
      process.env[name] = configuredValue
    }
  }
  assert.equal(resend.mock.callCount(), 0)
})

test('handles provider rejection without leaking response details or claiming acceptance', async () => {
  for (const status of [400, 401, 403, 429, 500]) {
    const resend = mock.method(globalThis, 'fetch', async () => Response.json({
      message: `Sensitive provider details: ${fakeApiKey} ${valid.email}`,
    }, { status }))
    const result = await failure(await post(valid), 502, true)
    assert.ok('error' in result && result.error === 'No se ha podido confirmar la aceptación del envío por Resend.')
    assert.equal(resend.mock.callCount(), 1)
    assert.equal(JSON.stringify(result).includes(fakeApiKey), false)
    assert.equal(JSON.stringify(result).includes(valid.email), false)
  }
})

test('requires a successful response with a non-empty id from Resend', async () => {
  for (const result of [null, [], {}, { id: '' }, { id: ' ' }, { id: 42 }, { error: 'rejected' },
    { id: 'test-email-id', error: 'rejected' }]) {
    mock.method(globalThis, 'fetch', async () => Response.json(result))
    await failure(await post(valid), 502, true)
  }
  mock.method(globalThis, 'fetch', async () => new Response('not JSON', { status: 200 }))
  await failure(await post(valid), 502, true)
})

test('handles network errors and timeouts without retrying or leaking error details', async () => {
  for (const error of [new Error(`${fakeApiKey} ${valid.email}`), new DOMException('Timed out', 'TimeoutError')]) {
    const resend = mock.method(globalThis, 'fetch', async () => { throw error })
    const result = await failure(await post(valid), 502, true)
    assert.equal(resend.mock.callCount(), 1)
    assert.equal(JSON.stringify(result).includes(fakeApiKey), false)
    assert.equal(JSON.stringify(result).includes(valid.email), false)
  }
})

function fullValid() {
  return {
    version: 2, ...valid, website: '',
    administrativo: { telefono: '+34 600 000 000', preferenciaHoraria: 'Por la tarde', canal: 'EMAIL' },
    clinico: { zona: 'Valoración general', duracion: 'Menos de una semana', motivo: 'Consulta ficticia de prueba', dolorActual: null as number | null, antecedentes: 'Antecedente ficticio', medicacionAlergias: 'Medicación ficticia' },
    consentimientos: { privacidad: true, salud: true },
    firma: { tipo: 'ESCRITA', texto: 'Firma ficticia' } as { tipo: string; texto?: string; png?: string },
  }
}

test('full form is blocked without exact true in local and production environments', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  for (const environment of ['development', 'production']) {
    process.env.NODE_ENV = environment
    process.env.VERCEL_ENV = environment
    for (const flag of [undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true ']) {
      if (flag === undefined) delete process.env.RESEND_FULL_FORM_ENABLED
      else process.env.RESEND_FULL_FORM_ENABLED = flag
      const result = await failure(await post(fullValid()), 503, true)
      assert.ok('code' in result && result.code === 'FULL_FORM_DISABLED')
    }
  }
  assert.equal(resend.mock.callCount(), 0)
})

test('exact true allows full-form sending locally and with either or both production markers', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  process.env.RESEND_FULL_FORM_ENABLED = 'true'
  for (const [nodeEnv, vercelEnv] of [
    ['development', 'development'], ['production', 'development'],
    ['development', 'production'], ['production', 'production'],
  ]) {
    process.env.NODE_ENV = nodeEnv
    process.env.VERCEL_ENV = vercelEnv
    const response = await post(fullValid())
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      validated: true, sent: true,
      message: 'Resend ha aceptado el envío. La entrega al buzón no está confirmada.',
    })
  }
  assert.equal(resend.mock.callCount(), 4)
})

test('legacy requests remain independent of the full-form flag in production', async () => {
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  process.env.NODE_ENV = 'production'
  process.env.VERCEL_ENV = 'production'
  for (const flag of [undefined, 'false', 'true']) {
    if (flag === undefined) delete process.env.RESEND_FULL_FORM_ENABLED
    else process.env.RESEND_FULL_FORM_ENABLED = flag
    for (const tipoPaciente of ['NUEVO', 'HABITUAL']) {
      assert.equal((await post({ ...valid, tipoPaciente })).status, 200)
    }
  }
  assert.equal(resend.mock.callCount(), 6)
})

test('full form sends all six sections as plain text, keeping technical fields out of the email', async () => {
  process.env.RESEND_FULL_FORM_ENABLED = 'true'
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  const data = fullValid()
  const id = randomUUID()
  assert.equal((await post(data, id)).status, 200)
  const [, options] = resend.mock.calls[0].arguments as unknown as [string, RequestInit]
  const payload = JSON.parse(options.body as string)
  assert.equal(payload.from, fakeConfiguration.RESEND_FROM_EMAIL)
  assert.deepEqual(payload.to, [fakeConfiguration.RESEND_TO_EMAIL])
  assert.equal(payload.reply_to, valid.email)
  assert.equal(payload.subject, 'Reathlet - Nueva solicitud - NUEVO')
  assert.deepEqual(Object.keys(payload), ['from', 'to', 'reply_to', 'subject', 'text'])
  for (const value of [valid.nombre, valid.email, ...Object.values(data.administrativo), data.clinico.zona,
    data.clinico.duracion, data.clinico.motivo, data.clinico.antecedentes, data.clinico.medicacionAlergias, data.firma.texto]) {
    assert.ok(payload.text.includes(value))
  }
  for (const section of ['1. DATOS PERSONALES', '2. INFORMACIÓN', '3. MOTIVO', '4. ANTECEDENTES', '5. PRIVACIDAD', '6. FIRMA']) assert.ok(payload.text.includes(section))
  assert.match(payload.text, /Intensidad del dolor: No indicado/)
  assert.match(payload.text, /Lectura de privacidad: Sí/)
  assert.match(payload.text, /Consentimiento para tratar información de salud: Sí/)
  assert.doesNotMatch(payload.text, /website|Idempotency|data:image|<html>/)
  assert.equal(payload.text.includes(id), false)
})

test('optional empty fields display No indicado; pain zero is an explicit answer', async () => {
  process.env.RESEND_FULL_FORM_ENABLED = 'true'
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  const data = fullValid()
  data.administrativo.telefono = ''
  data.clinico.antecedentes = '  '
  data.clinico.medicacionAlergias = ''
  data.clinico.dolorActual = 0
  assert.equal((await post(data)).status, 200)
  const [, options] = resend.mock.calls[0].arguments as unknown as [string, RequestInit]
  const { text } = JSON.parse(options.body as string)
  assert.match(text, /Teléfono: No indicado/)
  assert.match(text, /antecedentes: No indicado/)
  assert.match(text, /alergias: No indicado/)
  assert.match(text, /dolor: 0\/10/)
})

test('drawn signature becomes exactly one official base64 PNG attachment and retries are stable', async () => {
  process.env.RESEND_FULL_FORM_ENABLED = 'true'
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  const data = fullValid()
  data.firma = { tipo: 'DIBUJADA', png: signatureDataUrl() }
  const id = randomUUID()
  for (const key of [id, id, randomUUID()]) assert.equal((await post(data, key)).status, 200)
  const calls = resend.mock.calls.map(call => (call.arguments as unknown as [string, RequestInit])[1])
  assert.ok(calls.every(call => call.body === calls[0].body))
  assert.deepEqual(calls[0].headers, calls[1].headers)
  assert.notDeepEqual(calls[0].headers, calls[2].headers)
  const payload = JSON.parse(calls[0].body as string)
  assert.deepEqual(payload.attachments, [{ filename: 'firma-paciente.png', content: data.firma.png!.split(',')[1] }])
  assert.match(payload.text, /Modalidad de firma: DIBUJADA/)
  assert.equal(payload.text.includes('Firma ficticia'), false)
  assert.equal(payload.text.includes('base64'), false)
})

test('full form validates required keys, enums, types, boundaries, consents and one signature only', async () => {
  process.env.RESEND_FULL_FORM_ENABLED = 'true'
  const resend = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call Resend') })
  const base = fullValid()
  const cases: unknown[] = [
    ...Object.keys(base).filter(key => key !== 'website').map(key => Object.fromEntries(Object.entries(base).filter(([name]) => name !== key))),
    ...[null, [], 'text', false].flatMap(value => ['administrativo', 'clinico', 'consentimientos', 'firma'].map(key => ({ ...base, [key]: value }))),
    { ...base, version: 1 }, { ...base, version: '2' }, { ...base, tipoPaciente: 'HABITUAL' },
    { ...base, to: 'untrusted@example.com' }, { ...base, website: 'bot' },
    { ...base, nombre: 'A' }, { ...base, nombre: 'x'.repeat(101) },
    { ...base, email: `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(40)}.com` },
  ]
  const mutations: Record<string, Record<string, unknown[]>> = {
    administrativo: { telefono: [null, 123, 'invalid', 'x'.repeat(21), '1234567\n'], preferenciaHoraria: ['', 'unknown', 1], canal: ['WHATSAPP', null], extra: ['unexpected'] },
    clinico: { zona: ['', 'unknown', 1], duracion: ['', 'unknown', 1], motivo: ['', 'short', 'x'.repeat(1001), '\u0000texto ficticio', 1], dolorActual: ['', '3', -1, 11, 3.5, false], antecedentes: [null, 1, 'x'.repeat(1001)], medicacionAlergias: [null, 1, 'x'.repeat(301), 'line\nbreak'], extra: ['unexpected'] },
    consentimientos: { privacidad: [false, 'true', 1], salud: [false, 'true', 1], extra: ['unexpected'] },
    firma: { tipo: ['other', null], texto: ['', 'AB', 'x'.repeat(101), 'Nombre\r\nBcc: evil@example.com'], png: [signatureDataUrl()] },
  }
  for (const [section, fields] of Object.entries(mutations)) {
    const original = base[section as keyof typeof base] as Record<string, unknown>
    for (const key of Object.keys(original)) cases.push({ ...base, [section]: Object.fromEntries(Object.entries(original).filter(([name]) => name !== key)) })
    for (const [field, values] of Object.entries(fields)) for (const value of values) cases.push({ ...base, [section]: { ...original, [field]: value } })
  }
  for (const body of cases) {
    const response = await failure(await post(body), 400)
    assert.equal(JSON.stringify(response).includes(base.clinico.motivo), false)
    assert.equal(JSON.stringify(response).includes(valid.email), false)
  }
  assert.equal(resend.mock.callCount(), 0)
})

test('PNG at the decoded size limit is accepted and ancillary metadata is removed', async () => {
  process.env.RESEND_FULL_FORM_ENABLED = 'true'
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  const clean = signatureDataUrl()
  const cleanSize = Buffer.from(clean.split(',')[1], 'base64').length
  const padded = signatureDataUrl(960, 300, undefined, 'x'.repeat(128 * 1024 - cleanSize - 12))
  assert.equal(Buffer.from(padded.split(',')[1], 'base64').length, 128 * 1024)
  assert.equal((await post({ ...fullValid(), firma: { tipo: 'DIBUJADA', png: padded } })).status, 200)
  const [, options] = resend.mock.calls[0].arguments as unknown as [string, RequestInit]
  assert.equal(JSON.parse(options.body as string).attachments[0].content, clean.split(',')[1])
})

test('drawn PNG validation rejects oversized, forged, truncated and incompatible images', async () => {
  process.env.RESEND_FULL_FORM_ENABLED = 'true'
  const resend = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call Resend') })
  const png = signatureDataUrl()
  const corrupt = Buffer.from(png.split(',')[1], 'base64')
  corrupt[corrupt.length - 1] ^= 1
  for (const image of ['', 'https://example.com/image.png', 'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,aGVsbG8=', png.slice(0, -8), png + 'x', signatureDataUrl(1, 1),
    `data:image/png;base64,${corrupt.toString('base64')}`, signatureDataUrl(960, 300, Buffer.alloc(1)),
    signatureDataUrl(960, 300, Buffer.alloc((960 * 4 + 1) * 300 + 1)),
    signatureDataUrl(960, 300, Buffer.alloc((960 * 4 + 1) * 300, 5)),
    `data:image/png;base64,${Buffer.alloc(128 * 1024 + 1).toString('base64')}`]) {
    await failure(await post({ ...fullValid(), firma: { tipo: 'DIBUJADA', png: image } }), 400)
  }
  await failure(await post({ ...fullValid(), firma: { tipo: 'DIBUJADA', png: `data:image/png;base64,${'A'.repeat(256 * 1024)}` } }), 413)
  assert.equal(resend.mock.callCount(), 0)
})

test('v2 allows multiline text beyond legacy body size but does not create HTML or email headers', async () => {
  process.env.RESEND_FULL_FORM_ENABLED = 'true'
  const resend = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-email-id' }))
  const data = fullValid()
  data.clinico.motivo = `${'á'.repeat(900)}\nBcc: ficticio@example.com\n<script>example</script>`
  data.clinico.antecedentes = 'á'.repeat(1000)
  data.clinico.medicacionAlergias = 'á'.repeat(300)
  assert.equal((await post(data)).status, 200)
  const [, options] = resend.mock.calls[0].arguments as unknown as [string, RequestInit]
  const payload = JSON.parse(options.body as string)
  assert.match(payload.text, /\n {2}Bcc: ficticio@example.com/)
  assert.equal('html' in payload || 'headers' in payload || 'bcc' in payload, false)
  assert.equal(payload.reply_to, valid.email)
})

test('v2 provider errors, missing configuration and idempotency conflicts do not expose sensitive data', async () => {
  process.env.RESEND_FULL_FORM_ENABLED = 'true'
  const data = fullValid()
  for (const status of [409, 429, 500]) {
    mock.method(globalThis, 'fetch', async () => Response.json({ message: `${fakeApiKey} ${data.clinico.motivo} ${data.firma.texto}` }, { status }))
    const result = await failure(await post(data), status === 409 ? 409 : 502, true)
    for (const sensitive of [fakeApiKey, valid.email, data.clinico.motivo, data.firma.texto!]) assert.equal(JSON.stringify(result).includes(sensitive), false)
  }
  delete process.env.RESEND_API_KEY
  await failure(await post(data), 500, true)
})

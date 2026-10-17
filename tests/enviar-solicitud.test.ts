import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, mock } from 'node:test'
import endpoint from '../api/enviar-solicitud.js'

const valid = { tipoPaciente: 'NUEVO', nombre: 'Paciente ficticio', email: 'prueba@example.com' }
const fakeApiKey = 'test-resend-key-not-a-real-secret'
const fakeConfiguration = {
  RESEND_API_KEY: fakeApiKey,
  RESEND_FROM_EMAIL: 'sender@example.com',
  RESEND_TO_EMAIL: 'appointments@example.com',
}
let previousEnvironment: Record<string, string | undefined> = {}

beforeEach(() => {
  previousEnvironment = {}
  for (const [name, value] of Object.entries(fakeConfiguration)) {
    previousEnvironment[name] = process.env[name]
    process.env[name] = value
  }
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

function post(body: unknown) {
  return endpoint.fetch(new Request('http://localhost/api/enviar-solicitud', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
    assert.deepEqual(options.headers, {
      Authorization: `Bearer ${fakeApiKey}`, 'Content-Type': 'application/json',
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
  for (const [name, configuredValue] of Object.entries(fakeConfiguration)) {
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

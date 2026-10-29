import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { after, afterEach, before, beforeEach, mock } from 'node:test'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { act, createElement } from 'react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'

let dom, server, BookingDialog, createRoot, root, container, i18n, onClose, signatureDataUrl

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.Image = dom.window.Image
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // jsdom has no native dialog or layout implementation.
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
  dom.window.HTMLElement.prototype.scrollTo = function () {}
  ;({ createRoot } = await import('react-dom/client'))
  server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
  ;({ BookingDialog } = await server.ssrLoadModule('/src/components/BookingDialog.tsx'))
  ;({ signatureDataUrl } = await server.ssrLoadModule('/tests/png-fixture.ts'))
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} })
  dom.window.HTMLCanvasElement.prototype.toDataURL = () => signatureDataUrl()
  dom.window.HTMLCanvasElement.prototype.setPointerCapture = () => {}
  i18n = createInstance()
  const resources = {}
  for (const locale of ['es-ES', 'ca-ES', 'en-GB']) resources[locale] = {
    translation: JSON.parse(await readFile(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')),
  }
  await i18n.init({ lng: 'es-ES', resources, interpolation: { escapeValue: false } })
})

beforeEach(async () => {
  await i18n.changeLanguage('es-ES')
  // The default mock blocks every outgoing HTTP call, including unexpected ones.
  mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected HTTP request') })
  mock.method(dom.window.Storage.prototype, 'setItem', () => { throw new Error('Patient data must not be persisted') })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  onClose = mock.fn()
})

afterEach(async () => {
  await act(async () => root.unmount())
  assert.equal(dom.window.Storage.prototype.setItem.mock.callCount(), 0)
  container.remove()
  mock.restoreAll()
})

after(async () => {
  await server?.close()
  dom?.window.close()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.Image
  delete globalThis.navigator
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
})

async function mount(intent = { patient: 'new', channel: 'email' }) {
  await act(async () => root.render(createElement(I18nextProvider, { i18n },
    createElement(BookingDialog, { intent, onClose }))))
}

function button(text) {
  const element = [...container.querySelectorAll('button')].find(item => item.textContent.trim() === text)
  assert.ok(element, `Missing button: ${text}`)
  return element
}

async function click(element) {
  await act(async () => element.click())
}

async function fill(id, value) {
  const element = container.querySelector(`#${id}`)
  assert.ok(element, `Missing field: ${id}`)
  const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype
    : element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}

async function drawSignature() {
  const canvas = container.querySelector('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 300 })
  await act(async () => {
    for (const type of ['pointerdown', 'pointerup']) {
      const event = new dom.window.Event(type, { bubbles: true })
      Object.assign(event, { clientX: 20, clientY: 20, pointerId: 1 })
      canvas.dispatchEvent(event)
    }
  })
}

async function preview({ optional = true, pain, drawn = false } = {}) {
  await fill('name', ' Paciente ficticio ')
  await fill('email', 'prueba@example.com')
  if (optional) await fill('phone', '+34 600 000 000')
  await click(button('Continuar'))
  await fill('region', 'Valoración general')
  await fill('duration', 'Menos de una semana')
  await fill('reason', 'Consulta clínica ficticia de prueba')
  if (optional) {
    await fill('history', 'Antecedente ficticio')
    await fill('medication', 'Medicación ficticia')
  }
  if (pain !== undefined) await fill('pain', String(pain))
  await click(button('Continuar'))
  assert.equal(container.querySelector('#privacy').checked, false)
  assert.equal(container.querySelector('#healthConsent').checked, false)
  await click(button('Firmar y continuar'))
  assert.ok(container.querySelector('#privacy-error'))
  assert.ok(container.querySelector('#healthConsent-error'))
  assert.ok(container.querySelector('#signature-error'))
  await click(container.querySelector('#privacy'))
  await click(container.querySelector('#healthConsent'))
  await fill('signature', 'Firma ficticia')
  if (drawn) {
    await click(button('Dibujar firma'))
    await drawSignature()
  }
  await click(button('Firmar y continuar'))
  await click(button('Ver mi solicitud'))
}

async function returningPreview() {
  await click(button(i18n.t('booking.next')))
  await fill('name', ' Paciente habitual ficticio ')
  await fill('email', 'habitual@example.com')
  await click(container.querySelector('#privacy'))
  await click(button(i18n.t('bookingContact.review')))
}

test('returning email validates contact and privacy, previews without sending and accepts only one explicit send', async () => {
  let accept
  const request = mock.method(globalThis, 'fetch', () => new Promise(resolve => { accept = resolve }))
  await mount({ patient: 'returning', channel: 'email' })
  await click(button('Continuar'))
  assert.equal(container.querySelector('#privacy').checked, false)
  assert.equal(container.querySelector('#name').maxLength, 160)
  assert.equal(container.querySelector('#email').maxLength, 254)
  assert.equal(container.querySelector('#privacy').required, true)
  await click(button('Ver mi solicitud'))
  for (const field of ['name', 'email', 'privacy']) assert.ok(container.querySelector(`#${field}-error`))
  await fill('name', ' ')
  await fill('email', 'invalid')
  await click(button('Ver mi solicitud'))
  assert.ok(container.querySelector('#name-error'))
  assert.ok(container.querySelector('#email-error'))
  await fill('name', ' Paciente habitual ficticio ')
  await fill('email', 'habitual@example.com')
  await click(button('Ver mi solicitud'))
  assert.ok(container.querySelector('#privacy-error'))
  assert.equal(request.mock.callCount(), 0)
  await click(container.querySelector('#privacy'))
  await click(button('Ver mi solicitud'))
  assert.equal(request.mock.callCount(), 0)
  assert.equal(container.querySelector('a[href^="mailto:"]'), null)
  assert.doesNotMatch(container.textContent, /DEMO|Se abrirá WhatsApp|Tu primer paso/)
  const send = button('Enviar solicitud')
  await act(async () => { send.click(); send.click() })
  assert.equal(request.mock.callCount(), 1)
  assert.equal(button('Enviando solicitud…').disabled, true)
  assert.equal(button('Atrás').disabled, true)
  assert.equal(container.querySelector('.dialog-close').disabled, true)
  const [url, options] = request.mock.calls[0].arguments
  assert.equal(url, '/api/enviar-solicitud')
  assert.equal(options.method, 'POST')
  assert.equal(options.headers['Content-Type'], 'application/json')
  assert.match(options.headers['Idempotency-Key'], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.deepEqual(JSON.parse(options.body), {
    tipoPaciente: 'HABITUAL', nombre: 'Paciente habitual ficticio', email: 'habitual@example.com', website: '',
  })
  await act(async () => accept(Response.json({ validated: true, sent: true })))
  assert.match(container.querySelector('[role="status"]').textContent, /aceptado.*entrega no está confirmada.*cita sigue pendiente/)
  assert.equal(button('Solicitud enviada').disabled, true)
  assert.equal(button('Atrás').disabled, true)
})

test('returning honeypot stays hidden and travels only in the request body', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 400 }))
  await mount({ patient: 'returning', channel: 'email' })
  await returningPreview()
  await click(button('Atrás'))
  const trap = container.querySelector('input[name="website"]')
  assert.ok(trap.closest('[hidden][aria-hidden="true"]'))
  assert.equal(trap.tabIndex, -1)
  assert.equal(trap.autocomplete, 'off')
  await fill('booking-website', 'bot-marker')
  await click(button('Ver mi solicitud'))
  assert.doesNotMatch(container.textContent, /bot-marker/)
  await click(button('Enviar solicitud'))
  assert.equal(JSON.parse(request.mock.calls[0].arguments[1].body).website, 'bot-marker')
  assert.doesNotMatch(container.querySelector('a[href^="https://wa.me/"]').href, /bot-marker/)
  assert.ok(container.querySelector('[role="alert"]'))
})

for (const field of ['name', 'email', 'privacy', 'booking-website']) {
  test(`returning ${field} edits invalidate the identifier even when restored`, async () => {
    const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
    await mount({ patient: 'returning', channel: 'email' })
    await returningPreview()
    await click(button('Enviar solicitud'))
    await click(button('Atrás'))
    assert.equal(container.querySelector('#email').value, 'habitual@example.com')
    if (field === 'privacy') {
      await click(container.querySelector('#privacy'))
      await click(container.querySelector('#privacy'))
    } else {
      const original = container.querySelector(`#${field}`).value
      await fill(field, field === 'email' ? 'changed@example.com' : 'changed')
      await fill(field, original)
    }
    await click(button('Ver mi solicitud'))
    await click(button('Reintentar envío'))
    assert.equal(request.mock.calls[0].arguments[1].body, request.mock.calls[1].arguments[1].body)
    assert.notEqual(request.mock.calls[0].arguments[1].headers['Idempotency-Key'], request.mock.calls[1].arguments[1].headers['Idempotency-Key'])
  })
}

test('returning channel changes and new requests renew identifiers without cross-channel sends', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
  await mount({ patient: 'returning', channel: 'email' })
  await returningPreview()
  await click(button('Enviar solicitud'))
  await click(button('Atrás'))
  await click(button('Atrás'))
  await click(button('WhatsAppUna conversación más cercana'))
  await click(button('Ver mi solicitud'))
  const link = container.querySelector('a[href^="https://wa.me/"]')
  assert.doesNotMatch(decodeURIComponent(link.href), /habitual@example.com|Paciente habitual ficticio/)
  assert.equal(request.mock.callCount(), 1)
  await click(button('Atrás'))
  await click(button('Correo electrónicoConsulta cuando te venga bien'))
  await click(button('Continuar'))
  assert.equal(container.querySelector('#email').value, 'habitual@example.com')
  await click(button('Ver mi solicitud'))
  await click(button('Reintentar envío'))
  const key = call => call.arguments[1].headers['Idempotency-Key']
  assert.notEqual(key(request.mock.calls[0]), key(request.mock.calls[1]))
  for (let step = 0; step < 3; step++) await click(button('Atrás'))
  await click(button('Ya soy pacienteContacta para pedir una nueva cita.'))
  await click(button('Continuar'))
  assert.equal(container.querySelector('#name').value, '')
  assert.equal(container.querySelector('#email').value, '')
  assert.equal(container.querySelector('#privacy').checked, false)
  await act(async () => root.render(null))
  await mount({ patient: 'returning', channel: 'email' })
  await returningPreview()
  await click(button('Enviar solicitud'))
  assert.notEqual(key(request.mock.calls[1]), key(request.mock.calls[2]))
})

for (const locale of ['es-ES', 'ca-ES', 'en-GB']) for (const patient of ['new', 'returning']) for (const channel of ['email', 'whatsapp']) {
  test(`${locale} / ${patient} / ${channel}: preview texts and actions match the channel`, async () => {
    const request = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not send on preview') })
    await mount({ patient, channel })
    if (patient === 'new') await preview()
    else if (channel === 'email') await returningPreview()
    else await click(button('Ver mi solicitud'))
    await act(async () => i18n.changeLanguage(locale))
    const expectedTitle = channel === 'whatsapp' ? 'bookingContact.whatsappPreviewTitle' : patient === 'new' ? 'bookingEmail.title' : 'bookingContact.title'
    const expectedDescription = channel === 'whatsapp' ? 'bookingContact.whatsappPreviewText' : patient === 'new' ? 'bookingEmail.previewText' : 'bookingContact.previewText'
    assert.equal(container.querySelector('#booking-title').textContent, i18n.t(expectedTitle))
    assert.equal(container.querySelector('[data-slot="dialog-description"]').textContent, i18n.t(expectedDescription))
    assert.equal(container.querySelector('a[href^="mailto:"]'), null)
    if (channel === 'email') assert.ok(button(i18n.t('bookingEmail.send')))
    else assert.equal(container.querySelector('a[href^="https://wa.me/"]').textContent, i18n.t('bookingContact.openWhatsapp'))
    assert.equal(request.mock.callCount(), 0)
  })
}

test('requires validation and consent before an explicit v2 send, previews all sections and blocks duplicate clicks', async () => {
  let accept
  const resend = mock.method(globalThis, 'fetch', () => new Promise(resolve => { accept = resolve }))
  await mount()
  await click(button('Continuar'))
  assert.ok(container.querySelector('#name-error'))
  assert.ok(container.querySelector('#email-error'))
  await preview()
  assert.equal(resend.mock.callCount(), 0)
  assert.equal(container.querySelector('a[href^="mailto:"]'), null)
  assert.match(container.textContent, /Si el envío está habilitado/)
  assert.doesNotMatch(container.textContent, /bloqueado en producción|solo para pruebas|exclusivamente una demostración/i)
  const send = button('Enviar solicitud')
  await act(async () => { send.click(); send.click() })
  assert.equal(resend.mock.callCount(), 1)
  assert.equal(button('Enviando solicitud…').disabled, true)
  assert.match(container.querySelector('[role="status"]').textContent, /Enviando/)
  assert.equal(button('Atrás').disabled, true)
  assert.equal(container.querySelector('.dialog-close').disabled, true)
  await act(async () => container.querySelector('dialog').dispatchEvent(new dom.window.Event('cancel', { cancelable: true })))
  assert.equal(onClose.mock.callCount(), 0)
  const [url, options] = resend.mock.calls[0].arguments
  assert.equal(url, '/api/enviar-solicitud')
  assert.equal(options.method, 'POST')
  assert.deepEqual(options.headers, { 'Content-Type': 'application/json', 'Idempotency-Key': options.headers['Idempotency-Key'] })
  assert.match(options.headers['Idempotency-Key'], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.deepEqual(JSON.parse(options.body), {
    version: 2, tipoPaciente: 'NUEVO', nombre: 'Paciente ficticio', email: 'prueba@example.com', website: '',
    administrativo: { telefono: '+34 600 000 000', preferenciaHoraria: 'Sin preferencia', canal: 'EMAIL' },
    clinico: { zona: 'Valoración general', duracion: 'Menos de una semana', motivo: 'Consulta clínica ficticia de prueba', dolorActual: null, antecedentes: 'Antecedente ficticio', medicacionAlergias: 'Medicación ficticia' },
    consentimientos: { privacidad: true, salud: true }, firma: { tipo: 'ESCRITA', texto: 'Firma ficticia' },
  })
  for (const text of ['Consulta clínica ficticia', 'Antecedente ficticio', 'Medicación ficticia', 'Firma ficticia', 'Privacidad y consentimientos']) assert.ok(container.textContent.includes(text))
  await act(async () => accept(Response.json({ validated: true, sent: true })))
  assert.match(container.querySelector('[role="status"]').textContent, /aceptado.*pendiente de confirmación/)
  assert.equal(button('Solicitud enviada').disabled, true)
  await click(button('Solicitud enviada'))
  assert.equal(button('Atrás').disabled, true)
  await click(button('Atrás'))
  assert.equal(button('Solicitud enviada').disabled, true)
  assert.equal(resend.mock.callCount(), 1)
  assert.ok(container.querySelector('a[href^="https://wa.me/"]'))
})

for (const patient of ['new', 'returning']) for (const [name, response] of [
  ['HTTP validation error', () => Response.json({ sent: false }, { status: 400 })],
  ['HTTP provider error', () => Response.json({ sent: false }, { status: 502 })],
  ['HTTP idempotency conflict', () => Response.json({ sent: false }, { status: 409 })],
  ['HTTP rate limit', () => new Response('Too many requests', { status: 429 })],
  ['HTTP failure even with sent true', () => Response.json({ sent: true }, { status: 500 })],
  ['unconfirmed send', () => Response.json({ validated: true, sent: false })],
  ['invalid JSON', () => new Response('<html>Not an API response</html>')],
  ['unexpected null', () => Response.json(null)],
  ['unexpected array', () => Response.json([])],
  ['wrong sent type', () => Response.json({ sent: 'true' })],
  ['network failure', () => { throw new TypeError('Network failure') }],
]) {
  test(`${patient} / ${name}: shows an error, keeps contact data and allows an explicit retry`, async () => {
    const request = mock.method(globalThis, 'fetch', async () => response())
    await mount({ patient, channel: 'email' })
    if (patient === 'new') await preview()
    else await returningPreview()
    await click(button('Enviar solicitud'))
    assert.match(container.querySelector('[role="alert"]').textContent, /No hemos podido confirmar/)
    assert.match(container.textContent, patient === 'new' ? /Paciente ficticio/ : /Paciente habitual ficticio/)
    assert.match(container.textContent, patient === 'new' ? /prueba@example.com/ : /habitual@example.com/)
    assert.equal(button('Reintentar envío').disabled, false)
    assert.ok(container.querySelector('a[href^="https://wa.me/"]'))
    request.mock.mockImplementation(async () => Response.json({ sent: true }))
    await click(button('Reintentar envío'))
    assert.equal(request.mock.callCount(), 2)
    assert.equal(request.mock.calls[0].arguments[1].body, request.mock.calls[1].arguments[1].body)
    assert.equal(request.mock.calls[0].arguments[1].headers['Idempotency-Key'], request.mock.calls[1].arguments[1].headers['Idempotency-Key'])
    assert.equal(button('Solicitud enviada').disabled, true)
  })
}

test('preserves contact values when going back after an error and clears them on reopening', async () => {
  await mount()
  await preview()
  await click(button('Enviar solicitud'))
  await click(button('Atrás'))
  await click(button('Revisar'))
  assert.equal(container.querySelector('#name').value, ' Paciente ficticio ')
  assert.equal(container.querySelector('#email').value, 'prueba@example.com')
  await act(async () => root.render(null))
  await mount()
  assert.equal(container.querySelector('#name').value, '')
  assert.equal(container.querySelector('#email').value, '')
})

test('honeypot is hidden from sight, keyboard and accessibility and is included only in the API request', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 400 }))
  await mount()
  const trap = container.querySelector('input[name="website"]')
  assert.ok(trap.closest('[hidden][aria-hidden="true"]'))
  assert.equal(trap.tabIndex, -1)
  assert.equal(trap.autocomplete, 'off')
  await fill('booking-website', 'bot')
  await preview()
  await click(button('Enviar solicitud'))
  assert.equal(JSON.parse(request.mock.calls[0].arguments[1].body).website, 'bot')
  assert.match(container.querySelector('[role="alert"]').textContent, /No hemos podido confirmar/)
})

test('editing contact changes the identifier, even if restored; reopening starts another request', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
  await mount()
  await preview()
  await click(button('Enviar solicitud'))
  const originalKey = request.mock.calls[0].arguments[1].headers['Idempotency-Key']
  await click(button('Atrás'))
  await click(button('Revisar'))
  await fill('email', 'changed@example.com')
  await fill('email', 'prueba@example.com')
  await click(button('Continuar'))
  await click(button('Continuar'))
  await click(button('Firmar y continuar'))
  await click(button('Ver mi solicitud'))
  await click(button('Reintentar envío'))
  const changedKey = request.mock.calls[1].arguments[1].headers['Idempotency-Key']
  assert.notEqual(changedKey, originalKey)
  assert.equal(request.mock.calls[0].arguments[1].body, request.mock.calls[1].arguments[1].body)
  await act(async () => root.render(null))
  await mount()
  await preview()
  await click(button('Enviar solicitud'))
  const newKey = request.mock.calls[2].arguments[1].headers['Idempotency-Key']
  assert.notEqual(newKey, changedKey)
  assert.notEqual(newKey, originalKey)
})

test('frontend source does not reference private server configuration or the provider API', async () => {
  const { readdir } = await import('node:fs/promises')
  async function checkSources(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
      if (entry.isDirectory()) await checkSources(file)
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        assert.doesNotMatch(await readFile(file, 'utf8'), /RESEND_(API_KEY|FROM_EMAIL|TO_EMAIL|FULL_FORM_ENABLED)|api\.resend\.com/)
      }
    }
  }
  await checkSources(new URL('../src/', import.meta.url))
})

test('starting a new first visit clears the form, signatures and consents and starts another identifier', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
  await mount()
  await preview()
  await click(button('Enviar solicitud'))
  for (let step = 0; step < 5; step++) await click(button('Atrás'))
  await click(button('Es mi primera visitaUn formulario breve para conocerte mejor.Datos, motivo de consulta y consentimiento.'))
  assert.equal(container.querySelector('#name').value, '')
  assert.equal(container.querySelector('#email').value, '')
  await preview()
  await click(button('Enviar solicitud'))
  assert.equal(request.mock.callCount(), 2)
  assert.equal(request.mock.calls[0].arguments[1].body, request.mock.calls[1].arguments[1].body)
  assert.notEqual(request.mock.calls[0].arguments[1].headers['Idempotency-Key'], request.mock.calls[1].arguments[1].headers['Idempotency-Key'])
})

test('disabled full-form sending has a clear error, preserves the form and does not display success', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ validated: true, sent: false, code: 'FULL_FORM_DISABLED' }, { status: 503 }))
  await mount()
  await preview()
  await click(button('Enviar solicitud'))
  assert.match(container.querySelector('[role="alert"]').textContent, /desactivado.*No se ha enviado ningún correo/)
  assert.equal(button('Reintentar envío').disabled, false)
  await click(button('Reintentar envío'))
  assert.equal(request.mock.calls[0].arguments[1].body, request.mock.calls[1].arguments[1].body)
  assert.equal(request.mock.calls[0].arguments[1].headers['Idempotency-Key'], request.mock.calls[1].arguments[1].headers['Idempotency-Key'])
})

test('optional blanks stay blank; unanswered pain is null, while zero is an explicit answer', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
  await mount()
  await preview({ optional: false, pain: 0 })
  await click(button('Enviar solicitud'))
  const payload = JSON.parse(request.mock.calls[0].arguments[1].body)
  assert.equal(payload.administrativo.telefono, '')
  assert.equal(payload.clinico.antecedentes, '')
  assert.equal(payload.clinico.medicacionAlergias, '')
  assert.equal(payload.clinico.dolorActual, 0)
})

test('drawn signature sends only PNG; switching back to written sends only the written alternative with a new key', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
  await mount()
  await preview({ drawn: true })
  await click(button('Enviar solicitud'))
  assert.deepEqual(JSON.parse(request.mock.calls[0].arguments[1].body).firma, { tipo: 'DIBUJADA', png: signatureDataUrl() })
  await click(button('Atrás'))
  await click(button('Atrás'))
  await click(button('Escribir firma'))
  await click(button('Firmar y continuar'))
  await click(button('Ver mi solicitud'))
  await click(button('Reintentar envío'))
  assert.deepEqual(JSON.parse(request.mock.calls[1].arguments[1].body).firma, { tipo: 'ESCRITA', texto: 'Firma ficticia' })
  assert.notEqual(request.mock.calls[0].arguments[1].headers['Idempotency-Key'], request.mock.calls[1].arguments[1].headers['Idempotency-Key'])
})

for (const [field, value, step] of [
  ['name', 'Otro paciente ficticio', 'data'], ['email', 'otro@example.com', 'data'],
  ['phone', '+34 600 000 001', 'data'], ['availability', 'Por la tarde', 'data'],
  ['region', 'Rodilla', 'reason'], ['duration', 'Más de 3 meses', 'reason'],
  ['reason', 'Otro motivo ficticio de prueba', 'reason'], ['pain', '7', 'reason'],
  ['history', 'Otro antecedente ficticio', 'reason'], ['medication', 'Otra medicación ficticia', 'reason'],
  ['signature', 'Otra firma ficticia', 'consent'], ['privacy', null, 'consent'], ['healthConsent', null, 'consent'],
]) {
  test(`editing ${field} invalidates the request identifier`, async () => {
    const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
    await mount()
    await preview()
    await click(button('Enviar solicitud'))
    await click(button('Atrás'))
    await click(button('Revisar'))
    if (step !== 'data') await click(button('Continuar'))
    if (step === 'consent') await click(button('Continuar'))
    if (value === null) {
      await click(container.querySelector(`#${field}`))
      await click(container.querySelector(`#${field}`))
    } else await fill(field, value)
    if (step === 'data') await click(button('Continuar'))
    if (step !== 'consent') await click(button('Continuar'))
    await click(button('Firmar y continuar'))
    await click(button('Ver mi solicitud'))
    await click(button('Reintentar envío'))
    assert.notEqual(request.mock.calls[0].arguments[1].headers['Idempotency-Key'], request.mock.calls[1].arguments[1].headers['Idempotency-Key'])
  })
}

test('clearing and redrawing a signature invalidates the identifier even when the drawing is restored', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
  await mount()
  await preview({ drawn: true })
  await click(button('Enviar solicitud'))
  await click(button('Atrás'))
  await click(button('Atrás'))
  await click(button('Borrar firma'))
  await click(button('Firmar y continuar'))
  assert.ok(container.querySelector('#signature-error'))
  await drawSignature()
  await click(button('Firmar y continuar'))
  await click(button('Ver mi solicitud'))
  await click(button('Reintentar envío'))
  assert.equal(request.mock.calls[0].arguments[1].body, request.mock.calls[1].arguments[1].body)
  assert.notEqual(request.mock.calls[0].arguments[1].headers['Idempotency-Key'], request.mock.calls[1].arguments[1].headers['Idempotency-Key'])
})

test('changing channel away and back renews the key without sending clinical information to WhatsApp', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
  await mount()
  await preview()
  await click(button('Enviar solicitud'))
  await click(button('Atrás'))
  await click(button('WhatsAppUna conversación más cercana'))
  await click(button('Ver mi solicitud'))
  const link = container.querySelector('a[href^="https://wa.me/"]')
  assert.doesNotMatch(decodeURIComponent(link.href), /Consulta clínica|Antecedente|Medicación|Firma ficticia/)
  assert.equal(request.mock.callCount(), 1)
  await click(button('Atrás'))
  await click(button('Correo electrónicoConsulta cuando te venga bien'))
  await click(button('Ver mi solicitud'))
  await click(button('Reintentar envío'))
  assert.equal(request.mock.calls[0].arguments[1].body, request.mock.calls[1].arguments[1].body)
  assert.notEqual(request.mock.calls[0].arguments[1].headers['Idempotency-Key'], request.mock.calls[1].arguments[1].headers['Idempotency-Key'])
})

test('existing patients choose WhatsApp without contact fields or any API call', async () => {
  const request = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call API') })
  await mount({ patient: 'returning', channel: 'whatsapp' })
  await click(button('Ver mi solicitud'))
  assert.equal(container.querySelector('input'), null)
  assert.equal(container.querySelector('a[href^="mailto:"]'), null)
  assert.match(container.querySelector('.message-body').textContent, /Ya soy paciente/)
  const message = new URL(container.querySelector('a[href^="https://wa.me/"]').href).searchParams.get('text')
  assert.equal(message, 'Hola, Reathlet. Ya soy paciente y me gustaría solicitar una nueva cita. ¿Podemos hablar de la disponibilidad? Gracias.')
  assert.match(container.querySelector('[data-slot="dialog-description"]').textContent, /abre WhatsApp/)
  assert.equal(request.mock.callCount(), 0)
})

test('first visits can still choose WhatsApp without calling the API', async () => {
  const request = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call API') })
  await mount({ patient: 'new', channel: 'whatsapp' })
  await preview()
  assert.ok(container.querySelector('a[href^="https://wa.me/"]'))
  assert.equal(container.querySelector('a[href^="mailto:"]'), null)
  assert.equal(request.mock.callCount(), 0)
})

test('switching from a completed first visit clears clinical state and requires fresh contact and privacy before a returning send', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: true }))
  await mount({})
  await click(button('Es mi primera visitaUn formulario breve para conocerte mejor.Datos, motivo de consulta y consentimiento.'))
  // Select the email channel after completing the form when no channel was preselected.
  await fill('name', 'Paciente ficticio')
  await fill('email', 'prueba@example.com')
  await click(button('Continuar'))
  await fill('region', 'Valoración general')
  await fill('duration', 'Menos de una semana')
  await fill('reason', 'Consulta ficticia de prueba')
  await click(button('Continuar'))
  await click(container.querySelector('#privacy'))
  await click(container.querySelector('#healthConsent'))
  await fill('signature', 'Firma ficticia')
  await click(button('Firmar y continuar'))
  for (let step = 0; step < 4; step++) await click(button('Atrás'))
  await click(button('Ya soy pacienteContacta para pedir una nueva cita.'))
  await click(button('Correo electrónicoConsulta cuando te venga bien'))
  await click(button('Continuar'))
  assert.equal(container.querySelector('#name').value, '')
  assert.equal(container.querySelector('#email').value, '')
  assert.equal(container.querySelector('#privacy').checked, false)
  assert.equal(container.querySelector('#healthConsent'), null)
  assert.equal(container.querySelector('#signature'), null)
  await fill('name', 'Paciente habitual ficticio')
  await fill('email', 'habitual@example.com')
  await click(container.querySelector('#privacy'))
  await click(button('Ver mi solicitud'))
  assert.equal(request.mock.callCount(), 0)
  assert.doesNotMatch(container.querySelector('.message-body').textContent, /Firma ficticia|Consulta ficticia/)
  await click(button('Enviar solicitud'))
  assert.deepEqual(JSON.parse(request.mock.calls[0].arguments[1].body), {
    tipoPaciente: 'HABITUAL', nombre: 'Paciente habitual ficticio', email: 'habitual@example.com', website: '',
  })
})

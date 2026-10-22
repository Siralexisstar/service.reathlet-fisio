import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { after, afterEach, before, beforeEach, mock } from 'node:test'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { act, createElement } from 'react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'

let dom, server, BookingDialog, createRoot, root, container, i18n, onClose

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // jsdom has no native dialog or layout implementation.
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
  dom.window.HTMLElement.prototype.scrollTo = function () {}
  ;({ createRoot } = await import('react-dom/client'))
  server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
  ;({ BookingDialog } = await server.ssrLoadModule('/src/components/BookingDialog.tsx'))
  i18n = createInstance()
  const translation = JSON.parse(await readFile(new URL('../src/i18n/locales/es-ES.json', import.meta.url), 'utf8'))
  await i18n.init({ lng: 'es-ES', resources: { 'es-ES': { translation } }, interpolation: { escapeValue: false } })
})

beforeEach(() => {
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

async function preview() {
  await fill('name', ' Paciente ficticio ')
  await fill('email', 'prueba@example.com')
  await fill('phone', '+34 600 000 000')
  await click(button('Continuar'))
  await fill('region', 'Valoración general')
  await fill('duration', 'Menos de una semana')
  await fill('reason', 'Motivo clínico ficticio que no debe enviarse')
  await fill('history', 'Antecedente ficticio que no debe enviarse')
  await fill('medication', 'Medicación ficticia que no debe enviarse')
  await click(button('Continuar'))
  assert.equal(container.querySelector('#privacy').checked, false)
  assert.equal(container.querySelector('#healthConsent').checked, false)
  await click(button('Firmar y continuar'))
  assert.ok(container.querySelector('#privacy-error'))
  assert.ok(container.querySelector('#healthConsent-error'))
  assert.ok(container.querySelector('#signature-error'))
  await click(container.querySelector('#privacy'))
  await click(container.querySelector('#healthConsent'))
  await fill('signature', 'Firma ficticia que no debe enviarse')
  await click(button('Firmar y continuar'))
  await click(button('Ver mi solicitud'))
}

test('requires contact validation and consent before an explicit send, sends only contact fields and blocks duplicate clicks', async () => {
  let accept
  const resend = mock.method(globalThis, 'fetch', () => new Promise(resolve => { accept = resolve }))
  await mount()
  await click(button('Continuar'))
  assert.ok(container.querySelector('#name-error'))
  assert.ok(container.querySelector('#email-error'))
  await preview()
  assert.equal(resend.mock.callCount(), 0)
  assert.equal(container.querySelector('a[href^="mailto:"]'), null)
  assert.match(container.textContent, /buzón de pruebas/)
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
    tipoPaciente: 'NUEVO', nombre: 'Paciente ficticio', email: 'prueba@example.com', website: '',
  })
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

for (const [name, response] of [
  ['HTTP validation error', () => Response.json({ sent: false }, { status: 400 })],
  ['HTTP provider error', () => Response.json({ sent: false }, { status: 502 })],
  ['HTTP idempotency conflict', () => Response.json({ sent: false }, { status: 409 })],
  ['HTTP failure even with sent true', () => Response.json({ sent: true }, { status: 500 })],
  ['unconfirmed send', () => Response.json({ validated: true, sent: false })],
  ['invalid JSON', () => new Response('<html>Not an API response</html>')],
  ['network failure', () => { throw new TypeError('Network failure') }],
]) {
  test(`${name}: shows an error, keeps contact data and allows an explicit retry`, async () => {
    const request = mock.method(globalThis, 'fetch', async () => response())
    await mount()
    await preview()
    await click(button('Enviar solicitud'))
    assert.match(container.querySelector('[role="alert"]').textContent, /No hemos podido confirmar/)
    assert.match(container.textContent, /Paciente ficticio/)
    assert.match(container.textContent, /prueba@example.com/)
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
        assert.doesNotMatch(await readFile(file, 'utf8'), /RESEND_(API_KEY|FROM_EMAIL|TO_EMAIL)|api\.resend\.com/)
      }
    }
  }
  await checkSources(new URL('../src/', import.meta.url))
})

test('choosing a new first visit in the same dialog starts a new identifier without contact edits', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ sent: false }, { status: 502 }))
  await mount()
  await preview()
  await click(button('Enviar solicitud'))
  for (let step = 0; step < 5; step++) await click(button('Atrás'))
  await click(button('Es mi primera visitaUn formulario breve para conocerte mejor.Datos, motivo de consulta y consentimiento.'))
  await click(button('Continuar'))
  await click(button('Continuar'))
  await click(button('Firmar y continuar'))
  await click(button('Ver mi solicitud'))
  await click(button('Enviar solicitud'))
  assert.equal(request.mock.callCount(), 2)
  assert.equal(request.mock.calls[0].arguments[1].body, request.mock.calls[1].arguments[1].body)
  assert.notEqual(request.mock.calls[0].arguments[1].headers['Idempotency-Key'], request.mock.calls[1].arguments[1].headers['Idempotency-Key'])
})

test('existing patients keep the mail draft and WhatsApp paths without calling the API', async () => {
  const request = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call API') })
  await mount({ patient: 'returning', channel: 'email' })
  await click(button('Ver mi solicitud'))
  assert.ok(container.querySelector('a[href^="mailto:"]'))
  assert.match(container.querySelector('.message-body').textContent, /Ya soy paciente/)
  await click(button('Atrás'))
  await click(button('WhatsAppUna conversación más cercana'))
  await click(button('Ver mi solicitud'))
  assert.ok(container.querySelector('a[href^="https://wa.me/"]'))
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

test('switching from a completed first visit to an existing patient never enables automatic sending', async () => {
  const request = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call API') })
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
  await click(button('Ver mi solicitud'))
  assert.ok(container.querySelector('a[href^="mailto:"]'))
  assert.match(container.querySelector('.message-body').textContent, /Ya soy paciente/)
  assert.equal(request.mock.callCount(), 0)
})

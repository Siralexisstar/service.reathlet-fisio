import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { get } from 'node:http'
import test, { after, afterEach, before, beforeEach, mock } from 'node:test'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { act, createElement } from 'react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'

let dom, server, App, createRoot, root, container, i18n, localUrl
const resources = {}

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/hyrox' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
  dom.window.HTMLElement.prototype.scrollTo = function () {}
  ;({ createRoot } = await import('react-dom/client'))
  server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null } })
  await server.listen()
  ;({ default: App } = await server.ssrLoadModule('/src/App.tsx'))
  localUrl = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const locale of ['es-ES', 'ca-ES', 'en-GB']) resources[locale] = {
    translation: JSON.parse(await readFile(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')),
  }
  i18n = createInstance()
  await i18n.init({ lng: 'es-ES', resources, interpolation: { escapeValue: false } })
})

beforeEach(async () => {
  await i18n.changeLanguage('es-ES')
  dom.window.history.replaceState({}, '', '/hyrox')
  mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected HTTP request') })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  mock.restoreAll()
})

after(async () => {
  await server?.close()
  dom?.window.close()
  for (const key of ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT', 'ResizeObserver']) delete globalThis[key]
})

async function mount(path = '/hyrox') {
  dom.window.history.replaceState({}, '', path)
  await act(async () => root.render(createElement(I18nextProvider, { i18n }, createElement(App))))
}

async function click(element) {
  assert.ok(element)
  await act(async () => element.click())
}

function readLocalPage(path) {
  return new Promise((resolve, reject) => {
    get(`${localUrl}${path}`, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, body }))
    }).on('error', reject)
  })
}

test('Vercel rewrites direct HYROX and legal page requests to the application entry point', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  for (const source of ['/hyrox', '/hyrox/', '/legal/:path*']) {
    const rule = config.rewrites.find(item => item.source === source)
    assert.ok(rule, `Missing SPA rewrite: ${source}`)
    assert.equal(rule.destination, '/index.html')
    assert.equal(rule.has, undefined, 'Direct access must not depend on headers, query parameters or cookies')
    assert.equal(rule.missing, undefined)
  }
})

test('Vercel SPA rewrites stay scoped to page routes, preserving API and static-file routing', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  const pageSources = new Set(['/hyrox', '/hyrox/', '/legal/:path*'])
  // A broad fallback could send API requests or missing assets to HTML instead.
  for (const rule of config.rewrites) {
    assert.ok(pageSources.has(rule.source), `Rewrite must remain limited to app pages: ${rule.source}`)
  }
  assert.equal(config.routes, undefined, 'Do not mix legacy routing with these page rewrites')
})

for (const [locale, comingSoon] of [['es-ES', 'PRÓXIMAMENTE'], ['ca-ES', 'PROPERAMENT'], ['en-GB', 'COMING SOON']]) {
  test(`${locale}: HYROX renders translated copy, actions and a single coming-soon message`, async () => {
    await i18n.changeLanguage(locale)
    await mount()
    assert.equal(container.querySelector('main h1').textContent, 'HYROX')
    assert.equal(container.querySelector('.hyrox-coming').textContent, comingSoon)
    const catalog = resources[locale].translation
    assert.deepEqual(Object.keys(catalog.hyrox).sort(), Object.keys(resources['en-GB'].translation.hyrox).sort())
    for (const key of Object.keys(catalog.hyrox)) {
      assert.ok(i18n.exists(`hyrox.${key}`, { lng: locale, fallbackLng: false }))
      assert.ok(container.querySelector('.hyrox-page').textContent.includes(catalog.hyrox[key]))
    }
    assert.equal(catalog.nav.hyrox, 'HYROX')
    assert.equal(container.querySelector('.hyrox-page').textContent.split(comingSoon).length - 1, 1)
    assert.equal(container.querySelector('.hyrox-track').getAttribute('aria-hidden'), 'true')
    assert.equal(container.querySelector('.hyrox-actions a').getAttribute('href'), '/#tratamientos')
  })
}

test('desktop and mobile menus link to HYROX in order and mark it active only on HYROX', async () => {
  await mount()
  const hrefs = ['/#clinica', '/#tratamientos', '/hyrox', '/#metodo', '/#contacto']
  assert.deepEqual([...container.querySelectorAll('.desktop-nav a')].map(a => a.getAttribute('href')), hrefs)
  assert.equal(container.querySelector('.desktop-nav [aria-current=page]').textContent, 'HYROX')
  const toggle = container.querySelector('.mobile-menu')
  await click(toggle)
  assert.equal(toggle.getAttribute('aria-expanded'), 'true')
  assert.deepEqual([...container.querySelectorAll('.mobile-nav a')].map(a => a.getAttribute('href')), hrefs)
  assert.equal(container.querySelector('.mobile-nav [aria-current=page]').textContent, 'HYROX')
  // Prevent jsdom's unsupported full-document navigation while testing menu closure.
  const link = container.querySelector('.mobile-nav a[href="/hyrox"]')
  link.addEventListener('click', event => event.preventDefault())
  await click(link)
  assert.equal(container.querySelector('.mobile-nav'), null)
  await click(toggle)
  await act(async () => window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' })))
  assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  await mount('/')
  assert.equal(container.querySelector('.desktop-nav a[href="/hyrox"]').textContent, 'HYROX')
  assert.equal(container.querySelector('.desktop-nav [aria-current=page]'), null)
  await click(container.querySelector('.mobile-menu'))
  assert.ok(container.querySelector('.mobile-nav a[href="/hyrox"]'))
})

test('return, brand, section and legal links resolve from HYROX to existing content', async () => {
  await mount()
  assert.equal(container.querySelector('.hyrox-back').getAttribute('href'), '/')
  assert.equal(container.querySelector('.header .brand').getAttribute('href'), '/')
  const links = [...container.querySelectorAll('.desktop-nav a[href^="/#"]')].map(a => a.getAttribute('href'))
  const legalLinks = [...container.querySelectorAll('.footer-bottom a')].map(a => a.getAttribute('href'))
  for (const href of links) {
    await mount(href)
    assert.ok(container.querySelector(new URL(href, 'http://localhost').hash))
    assert.ok(container.querySelector('.hero h1'))
  }
  for (const href of legalLinks) {
    await mount(href)
    assert.ok(container.querySelector('.legal-main h1'))
    assert.ok(container.querySelector('a[href="/"]'))
  }
})

test('direct local requests and reloads serve the SPA and render HYROX, including a trailing slash', async () => {
  for (const path of ['/hyrox', '/hyrox', '/hyrox/']) {
    const response = await readLocalPage(path)
    assert.equal(response.status, 200)
    assert.match(response.body, /src="\/src\/main.tsx"/)
    await mount(path)
    assert.equal(container.querySelector('#hyrox-title').textContent, 'HYROX')
  }
})

test('both HYROX appointment buttons open the existing booking dialog without sending', async () => {
  await mount()
  for (const selector of ['.header-actions .button', '.hyrox-actions button']) {
    await click(container.querySelector(selector))
    assert.ok(container.querySelector('dialog[open]'))
    assert.match(container.querySelector('dialog').textContent, /Es mi primera visita/)
    await click(container.querySelector('.dialog-close'))
    assert.equal(container.querySelector('dialog'), null)
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0)
})

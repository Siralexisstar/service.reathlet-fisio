# Reathlet

First version of Reathlet's physiotherapy website, built with React 19,
TypeScript and Vite, based on the [reference proposal](https://reathlet-fisioterapia.alexgarciavillar96.chatgpt.site/).

## Development

```sh
npm install
npm run dev
```

Vite prints the local address in the terminal. To check the project:

```sh
npm run lint
npm test
npm run check
npm run build
npm run preview
```

## Content

- Home page with a three-photo carousel and controlled playback.
- Eight treatments with a horizontal carousel and information cards.
- Four recovery stages with keyboard navigation.
- Clinic gallery, frequently asked questions and contact section.
- First-visit form with validation, consent, typed/drawn signature and full email preview; a separate contact-only email form for existing patients.
- Legal notice, privacy, cookies and accessibility pages under `/legal/*`.
- Browser-language detection with Spanish (`es-ES`) as the default fallback, plus English and Catalan catalogs.
- Instagram and TikTok links in the main header.

The logo, photographs, copy and visual foundation were migrated from the reference.
Images are served from `public/images` and do not depend on a session in the original site.

## Structure

- `src/App.tsx`: page sections and navigation.
- `src/data.ts`: treatments, photographs, recovery steps, questions and contact data.
- `src/i18n/`: i18next configuration and locale catalogs.
- `src/components/BookingDialog.tsx`: appointment request flow.
- `src/components/Modal.tsx`: native dialogs with focus management.
- `src/components/LegalPage.tsx`: informational and legal pages.
- `src/App.css`: styles and mobile adaptations.
- `.husky/`: pre-commit and pre-push validation hooks.
- `api/enviar-solicitud.ts`: Vercel Function for contact-data validation and Resend email sending.
- `tests/enviar-solicitud.test.ts`: API contract tests using Node's built-in test runner.
- `tests/booking-dialog.test.mjs`: React email/WhatsApp flow tests for both patient types, using jsdom and the existing Vite/Node tools.

## Appointment request API (local email testing)

`POST /api/enviar-solicitud` keeps the legacy contact-only contract when `version`
is omitted. It accepts an `application/json` object with:

- `tipoPaciente`: exactly `NUEVO` or `HABITUAL`.
- `nombre`: a non-empty string, at most 160 characters.
- `email`: a valid email string, at most 254 characters.
- `website`: optional honeypot; if present, it must be exactly an empty string.

The request must also include `Idempotency-Key: <UUID v4>`. Missing or invalid
identifiers return 400 without contacting Resend. This header is the intentional
contract extension for duplicate prevention; older manual callers must add it.
The original three contact fields and response JSON shape are unchanged.

Name and email are checked after trimming surrounding spaces; length limits apply
to the original strings. Control characters, extra fields (including medical data
or signatures), and bodies larger than 4096 UTF-8 bytes are rejected. A filled
or incorrectly typed honeypot returns a generic 400 without sending. Use fictional
contact data. After validation, the handler sends the contact fields to Resend's
official `POST https://api.resend.com/emails` API using Node's built-in `fetch`.
It sends plain text from the server's `RESEND_FROM_EMAIL` to its
`RESEND_TO_EMAIL`, with subject `Reathlet - Nueva solicitud - NUEVO` or
`Reathlet - Nueva solicitud - HABITUAL`. The client cannot set the sender or recipient.
`Reply-To` (`reply_to` in Resend's HTTP API) is the validated, trimmed patient
email, so replying to the notification addresses the patient. The message still
contains the patient type, name and email; no clinical data is included.
The handler does not persist or log personal data, and responses do not echo it.
Email validation checks format, not ownership.

Valid input returns HTTP 200 only when Resend returns a successful response with
a non-empty email identifier:

```json
{
  "validated": true,
  "sent": true,
  "message": "Resend ha aceptado el envío. La entrega al buzón no está confirmada."
}
```

Input errors return `validated: false`, `sent: false` and an `error` message;
invalid contact fields also return a `fields` object. Status codes are 400 for invalid
JSON or fields, 405 for other methods (`Allow: POST`), 413 for an oversized body,
and 415 for a missing or unsupported Content-Type. Once input is valid, missing
server configuration returns 500; provider idempotency conflicts return a generic
409 with `validated: true` and `sent: false`. Other provider rejection, invalid provider responses,
network errors or a 10-second timeout return 502. Those errors return
`validated: true`, `sent: false` and a generic `error`, without secrets or provider
response details. `sent: false` means acceptance was not confirmed; a network
failure can leave the outcome unknown. The handler does not retry automatically.
Responses use `Cache-Control: no-store`. Acceptance never confirms inbox delivery
or an appointment. Duplicate protection and its limits are described below.

### Full first-visit form: version 2

The React first-visit email flow now submits the complete form using `version: 2`.
**Full-form sending is disabled by default.** The private server variable
`RESEND_FULL_FORM_ENABLED` must be exactly `true` to allow a provider call in any
environment, including production. `NODE_ENV` and `VERCEL_ENV` do not affect this
decision. Missing, empty, `false`, uppercase or whitespace-padded values keep it
disabled; the flag is not trimmed. Enabling it is a technical opt-in, not confirmation
that the pending safeguards for real health data are complete. No environment file
is changed by the application, and the flag is never exposed through `VITE_*` or browser code.
Legacy contact-only requests remain supported independently of this flag.

| Environment | `RESEND_FULL_FORM_ENABLED` | Valid v2 request |
| --- | --- | --- |
| Production | absent | 503, no provider call |
| Production | `false` | 503, no provider call |
| Production | exact `true` | Provider sending allowed |
| Local | exact `true` | Provider sending allowed |

Normal validation and server credential/address checks still run. `sent: true`
requires confirmed provider acceptance, never just the enabled flag.

Definitive v2 JSON, using fictional data:

```json
{
  "version": 2,
  "tipoPaciente": "NUEVO",
  "nombre": "Persona de prueba",
  "email": "prueba@example.com",
  "website": "",
  "administrativo": {
    "telefono": "",
    "preferenciaHoraria": "Sin preferencia",
    "canal": "EMAIL"
  },
  "clinico": {
    "zona": "Valoración general",
    "duracion": "No tengo molestias actualmente",
    "motivo": "Solicitud ficticia de valoración inicial.",
    "dolorActual": null,
    "antecedentes": "",
    "medicacionAlergias": ""
  },
  "consentimientos": { "privacidad": true, "salud": true },
  "firma": { "tipo": "ESCRITA", "texto": "Persona de prueba" }
}
```

All displayed properties are required except `website`, which remains optional
and must be empty when provided. Empty optional phone/history/medication fields
are represented by strings, not `null`. Unanswered pain is `null`; an explicit
answer must be an integer from 0 to 10. The untouched slider's initial visual
position is not submitted as a conscious 3/10 answer. A pointer/keyboard response
records the answer, and **Dejar sin indicar** clears it.

The backend checks a closed property list at every level, required/optional
values, both true consent flags, existing contact email validation and these
v2 limits: name 2–100, email up to 160, phone up to 20 with the form's permitted
phone syntax, reason 10–1000, history up to 1000, medication/allergies up to 300,
typed signature 3–100 characters. Length limits apply before trimming; text
minimums use trimmed values. Controls are rejected, except line breaks in reason
and history. `tipoPaciente` must be `NUEVO` and `canal` must be `EMAIL`.

Select values are the exact current Spanish form options, shared in
`src/lib/firstVisit.ts` rather than duplicated between React and the server:

- Preference: Sin preferencia; Por la mañana; Al mediodía; Por la tarde.
- Area: Cuello / cervicales; Hombro / brazo; Espalda / zona lumbar; Cadera;
  Rodilla; Tobillo / pie; Varias zonas; Valoración general.
- Duration: Menos de una semana; Entre 1 y 4 semanas; Entre 1 y 3 meses;
  Más de 3 meses; No tengo molestias actualmente.

Exactly one signature alternative is accepted. A drawn signature replaces the
entire `firma` object with
`{"tipo":"DIBUJADA","png":"data:image/png;base64,..."}`; `texto` and `png`
cannot coexist. The server accepts only canonical Base64 PNG, at most 128 KiB
decoded, 960 × 300 pixels, 8-bit RGBA and non-interlaced, matching the form canvas.
It checks PNG chunk CRCs, structure, bounded decompression and row filters, and
strips ancillary metadata before attaching it. SVG, remote URLs, malformed files,
wrong dimensions and excessive sizes are rejected. These format checks do not
authenticate the signer or certify the signature.
The whole v2 JSON body is limited to 256 KiB while the legacy 4096-byte limit is
preserved. Request reading and PNG decompression are bounded in memory.

Resend receives only the server-configured sender/recipient, validated `reply_to`,
fixed subject, plain `text`, and, for the drawn alternative, one attachment:
`{"filename":"firma-paciente.png","content":"<validated PNG Base64>"}`.
Neither honeypot nor idempotency key is included in the message. The filename is
fixed; client-controlled paths, HTML, headers and recipients are not supported.
Multiline text is indented as content. There is no persistent application storage
or logging of request bodies, clinical data, signatures or secrets.
See the official [Resend attachments API](https://resend.com/docs/dashboard/emails/attachments):
the provider's 40 MB encoded-message limit is well above our own stricter limits.

Example full email for the JSON above (all data fictional):

```text
Subject: Reathlet - Nueva solicitud - NUEVO

FORMULARIO DE PRUEBA — DATOS FICTICIOS
1. DATOS PERSONALES Y CONTACTO
Tipo de paciente: NUEVO
Nombre: Persona de prueba
Email: prueba@example.com
Teléfono: No indicado

2. INFORMACIÓN DE LA SOLICITUD
Preferencia horaria: Sin preferencia
Canal de contacto: EMAIL

3. MOTIVO DE CONSULTA
Zona: Valoración general
Duración: No tengo molestias actualmente
Motivo y objetivo de recuperación: Solicitud ficticia de valoración inicial.
Intensidad del dolor: No indicado

4. ANTECEDENTES Y SALUD
Lesiones, cirugías o antecedentes: No indicado
Medicación o alergias: No indicado

5. PRIVACIDAD Y CONSENTIMIENTOS
Lectura de privacidad: Sí
Consentimiento para tratar información de salud: Sí
Modalidad de firma: ESCRITA

6. FIRMA DEL PACIENTE
Firma escrita: Persona de prueba

Firma de demostración. No constituye un consentimiento legal registrado.
Solicitud pendiente de revisión. No confirma una cita.
```

For the drawn alternative, the last section names `firma-paciente.png` instead of
including the written signature. The inactive signature is never submitted.

A valid v2 request with sending disabled returns HTTP 503:
`{"validated":true,"sent":false,"code":"FULL_FORM_DISABLED","error":"El envío del formulario completo de prueba está desactivado."}`.
It never falls back to sending only contact details. Other status codes, Reply-To,
provider acceptance checks and retry handling remain as documented above.

Before any real-data use, review the actual legal holder, purposes and legal bases,
privacy/consent texts, necessity of each clinical field and the signature, email
content encryption and access controls, recipient mailbox, retention/deletion,
hosting and Resend contracts/subprocessors and international transfers. Resend's
public [DPA](https://resend.com/legal/dpa) currently marks sensitive-data transfers
as not applicable; do not assume it covers health data. Its
[security documentation](https://resend.com/security) states that stored data is
in the US, including when an EU sending region is selected. HTTPS/TLS and encryption
at rest do not provide end-to-end message-content encryption. The
[AEPD guidance](https://www.aepd.es/preguntas-frecuentes/16-salud/2-profesionales-sanitarios/FAQ-1638-puedo-enviarle-a-un-paciente-sus-informes-medicos-por-correo-electronico)
advises avoiding health information in email unless encrypted. The sending capability
does not provide a clinical-record/consent system or establish regulatory compliance.
The flag can now enable sending in production, but the safeguards above must be
reviewed before real health data is used. Test examples and automated tests remain
strictly fictional; the existing email structure and its current test notices are unchanged.

### Local API development

`npm run dev` starts Vite and does **not** run the Vercel Function. To test the
actual HTTP route, configure the three **server-only** credential/address variables
in the ignored root `.env.local` file, and keep the optional full-form gate false:

| Variable | Purpose | Example (not a real configuration) |
| --- | --- | --- |
| `RESEND_API_KEY` | Private Resend API credential | `replace_with_your_resend_api_key` |
| `RESEND_FROM_EMAIL` | Sender permitted by Resend | `onboarding@resend.dev` |
| `RESEND_TO_EMAIL` | Single notification recipient, controlled by the server | `test-inbox@example.com` |
| `RESEND_FULL_FORM_ENABLED` | Private v2 sending gate in all environments; only exact `true` enables it | `false` |

[`.env.example`](.env.example) contains placeholders only. Add the two address
variables to an existing `.env.local`, preserving its private key; do not overwrite
that file with the example. If no `.env.local` exists, copy the example and replace
the placeholders privately. None of the example addresses is a working test inbox.
The handler reads these values exclusively through `process.env`, trimming outer
whitespace from credentials/addresses only; the sending flag requires exact `true`.
If any credential/address variable is missing, empty or whitespace-only, enabled valid requests
return the existing 500 JSON error with `validated: true` and `sent: false`, without
contacting Resend or exposing configuration values. Invalid input still returns
the normal validation error first. Never use `VITE_*` variables for these values.
Restart the server after changing `.env.local`.

Keep a **test inbox** as the recipient during fictional testing. Before real health
data is used, complete the safeguards above and verify the intended clinic mailbox.
The UI does not infer the recipient or enabled state from the deployment environment.
The sender must be allowed by Resend; the trial sender
`onboarding@resend.dev` has provider restrictions. Use your authorised test sender
and recipient, or a verified sending domain. Invalid provider configuration is
handled by the existing generic 502 response, without exposing provider details.

In this environment, plain `npx vercel dev --listen 3000` did **not** make the key
available in the function runtime. Starting the CLI through Node with
`--env-file=.env.local` did. This was checked with a temporary local function that
returned only a `configured` boolean; that diagnostic route has been removed.
No live email request was made during implementation.

From the repository root, this PowerShell command explicitly loads `.env.local`
and passes the environment to `vercel dev` without printing the key (Node 20.19+
is sufficient):

```powershell
node --env-file=.env.local -e "const child = require('node:child_process').spawnSync('npx vercel dev --listen 3000', { stdio: 'inherit', shell: true }); process.exit(child.status ?? 1)"
```

The Vercel CLI may require login and linking this directory to a Vercel project;
select the Vite preset if prompted. This starts local development, not a deployment.
See the official
[Vite integration](https://vercel.com/docs/frameworks/frontend/vite) and
[vercel dev documentation](https://vercel.com/docs/cli/dev), and
[Resend send-email API](https://resend.com/docs/api-reference/emails/send-email).

Only after reviewing the implementation, run this in another PowerShell terminal
to **send a real test email** to the server-configured recipient:

```powershell
$requestId = [guid]::NewGuid().ToString()
'{"tipoPaciente":"NUEVO","nombre":"Paciente ficticio","email":"prueba@example.com"}' |
  curl.exe --include --silent --show-error --request POST 'http://localhost:3000/api/enviar-solicitud' --header 'Content-Type: application/json' --header "Idempotency-Key: $requestId" --data-binary '@-'
```

For a retry of that same request, repeat only the JSON/curl pipeline and retain
`$requestId`. Generate another UUID only for a new request or changed contact data.

Expect `validated: true` and `sent: true` only if Resend accepts the email. An
empty name, invalid email or extra field returns 400 without contacting Resend.
GET returns 405 without contacting Resend. If 500 occurs, check that all three
variables are set and the server was restarted with the command above. For 502, review the
Resend dashboard privately; this can include an invalid key, provider limits or
test-sender restrictions. Verify the notification's sender and recipient, then use
**Reply** in your mail client to check that `Reply-To` selects the fictional patient
address; inspecting the reply draft does not require sending it. Confirm the
patient name and type remain in the message. Do not print the key or paste it into diagnostics.
`npm test` checks the handler and both React patient flows without Vercel authentication.
It uses the installed TypeScript compiler and Node test runner, emitting temporary
JavaScript under `node_modules/.tmp/api-tests`; no test dependencies are added.
API tests replace `fetch` and use a fictional key. UI tests use jsdom (a development
dependency), Vite's existing TypeScript/JSX loader and Node's test runner. They
replace every outgoing HTTP request; no test can send real mail.

### Existing-patient email flow (PL-0005)

**Ya soy paciente → Correo electrónico** now requests name, email and acceptance
of the privacy information, then shows a preview. Only an explicit **Enviar
solicitud** click calls the same API. No email app or `mailto:` draft is opened.
The request uses the original contract, without a `version` property:

```json
{
  "tipoPaciente": "HABITUAL",
  "nombre": "Paciente de prueba",
  "email": "prueba@example.com",
  "website": ""
}
```

The UUID v4 `Idempotency-Key`, hidden honeypot, synchronous click guard, timeout,
explicit retry and acceptance checks are shared with first-visit email. Contact
state is separate from the clinical form. Switching patient type starts a fresh
request and clears contact, clinical fields, signatures and consents. Errors and
back navigation within a request preserve entered contact details. Unchanged
retries reuse the key; edits, channel changes or another request invalidate it.
Closing the dialog discards local state without browser storage.

The privacy checkbox is required by the UI and starts unchecked. It is not sent
or recorded by the original API: no extra fields are added to that contract, and
this is not a server-side consent record or identity verification. Before using
real contact data, validate the legal holder, purpose, privacy notice, intended
recipient, mailbox access, retention and provider arrangements. The additional
health-data safeguards described for v2 remain pending and unchanged.

Only `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `RESEND_TO_EMAIL` are needed for
this contact-only send. **RESEND_FULL_FORM_ENABLED is not a global email switch:**
an absent/false value blocks v2 only, not HABITUAL or other original-contract
requests. No new variable is introduced. Reply-To remains the validated patient
email; the client cannot choose the sender or recipient.

HTTP 409, 429, 500, 502, malformed responses and unconfirmed sends show an error
with retained data and an explicit retry. A WAF 429 can arrive before the function
and need not contain JSON. Provider 429 responses retain the existing generic
502 mapping; provider 409 remains 409. No automatic retry is attempted. Success
means provider acceptance, not inbox delivery or an appointment.

| Patient / channel | Submission |
| --- | --- |
| First visit / email | Full v2 form; exact `RESEND_FULL_FORM_ENABLED=true` required |
| First visit / WhatsApp | Existing brief message with name and optional availability; no clinical information or signature |
| Existing patient / email | Original contact-only contract; no full-form flag requirement |
| Existing patient / WhatsApp | Existing generic message; no name/email form required |

For a **no-email** browser check, run `npm run dev` and block
`*/api/enviar-solicitud` in browser DevTools Network request blocking **before**
clicking Send. Complete the existing-patient email form with fictional data;
verify validation, preview without a request, one explicit blocked POST, retained
contact details and an unchanged UUID on retry. Change contact details and check
that the UUID changes. Choose WhatsApp and verify it asks for no contact fields
and makes no API request. Keeping the full-form flag false alone does **not**
make the existing-patient email check safe from sending.

For a manual live test, after reviewing this change, start `vercel dev` with the
existing environment-loading command above, using an authorised test inbox and
fictional details only. Open the same existing-patient email flow and press Send
once. Inspect the HABITUAL payload, recipient, Reply-To and acceptance message.
The test-sender/domain restrictions described above still apply. These manual
live steps are not run by the automated tests or by the implementation workflow.

### First-visit browser flow and safe local checks

The first-visit email flow submits version 2 after the contact, consultation and
consent steps and an explicit final **Enviar solicitud** click. The preview shows
all six email sections and only the selected signature. Unanswered pain is null.
A private server gate blocks provider sending by default; no contact-only fallback
is attempted. **Even while sending is blocked, clicking sends the fictional full
form to the local function for validation**. Use fictional data for these checks.

Loading/error/acceptance, the synchronous click guard and 20-second client timeout
are preserved. Navigation and closing are disabled during sending; HTTP success
plus sent:true is required for acceptance. Errors retain the form and key for an
explicit retry; the disabled-gate response has its own clear message. Acceptance
is neither guaranteed delivery nor an appointment. After acceptance, sending and
back navigation stay locked. Closing or starting a new first visit clears the
form, consents and both signatures. There is no browser persistence or automatic retry.

WhatsApp still contains only the general request, name and optional preference.
Existing-patient WhatsApp remains independent; existing-patient email uses the
separate contact-only flow described above.
The three locale catalogs, footer and draft legal notices describe the full-form
submission, its conditional sending and the outstanding privacy review. No server credentials or recipient configuration
are included in React.

To verify safely without sending a real email:

1. Run **npm test**. Every API/provider and UI HTTP request is simulated with
   fictional data; this covers successful written/drawn signatures, retries,
   provider conflicts, the default-off flag in local/production, exact-true sending
   in both environments, validation and v1 compatibility.
2. For a local browser check, keep RESEND_FULL_FORM_ENABLED absent or false.
   Force false for the current PowerShell process before starting the existing
   Node environment-loading command above:

   ```powershell
   $env:RESEND_FULL_FORM_ENABLED = 'false'
   node --env-file=.env.local -e "const child = require('node:child_process').spawnSync('npx vercel dev --listen 3000', { stdio: 'inherit', shell: true }); process.exit(child.status ?? 1)"
   ```

3. Open http://localhost:3000, choose a first visit and enter fictional data only.
   Leave pain untouched and verify **No indicado**; then answer/reset it. Complete
   both consent boxes and choose one signature method. Review all six sections.
4. Press **Enviar solicitud**. In Network, expect one v2 POST with an anonymous
   Idempotency-Key header and only the active signature. The default-off server
   must return **503 / FULL_FORM_DISABLED / sent:false**, with no Resend call.
5. Retry unchanged: body and UUID must match. Go back and edit contact, clinical
   data, either consent or the signature: the next send must have a different UUID.
   Switch signature modes and verify the inactive alternative is absent.
6. Close/reopen or restart the first visit: data and signatures must be cleared.
   Verify WhatsApp paths still avoid the API and exclude clinical data/signatures.
   Do not send a habitual-patient email in this flag-only blocked check: it is not
   covered by the v2 flag. Restore the shell variable when finished; do not set
   it true for this manual blocked-path check.

Do not run the legacy live-send curl example when following these no-email steps.
Successful provider acceptance and the exact PNG attachment are exercised by the
mocked tests. There is no automatic mock mode in the application and no live email
or Vercel project change is needed for those tests.

### Spam and duplicate protections (iteration 4)

Both email forms have a `website` text input inside a native `hidden` container,
also marked `aria-hidden`, with `tabIndex=-1` and autocomplete disabled. It is absent
from normal visual, keyboard and assistive-technology interaction. Its value travels
only to this endpoint. It is never forwarded to Resend, logged or persisted. A
non-empty value (including whitespace) or wrong type is rejected generically;
the response never pretends that a message was sent. Direct HTTP clients can omit
the field or send it empty, so this is only a lightweight bot signal.

React generates a UUID v4 with `crypto.randomUUID()` at the first send and retains
it only for the open dialog. Retries with unchanged form data reuse the key.
Editing any submitted contact, administrative or clinical field, pain, either
consent, signature or its mode, channel or honeypot invalidates the key, even if
the value is restored before sending. A new first visit or closing/reopening
starts another identifier. The UUID is never derived from personal data. The server
validates the UUID, normalizes its case and forwards it to Resend as
`Idempotency-Key: reathlet-solicitud/<uuid>`; it never forwards the honeypot.

[Resend's idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
replays the original accepted response for the same key and email payload within
24 hours. Concurrent use or a different payload under the same key can return 409;
our endpoint returns a generic controlled conflict without provider details and
never retries automatically or silently changes the key. Wait before retrying an
in-flight request. For a payload conflict, first resolve the previous outcome;
changing server sender/recipient settings can also change the provider payload.
Do not force a new key simply to work around an uncertain result.

There is no database, persistent browser storage, server counter, lock or local
cache guaranteeing idempotency across function instances. That guarantee belongs
to Resend and expires after 24 hours. Reopening, reloading, another tab/device,
form edits, or a client that deliberately changes keys can still send another
email. The UUID is not authentication, proof of consent, or an anti-spam quota.

### Production rate limiting (future manual configuration)

No Vercel project was accessed and no rate-limiting rule is configured by this code.
Later, in Alex's production project's **Firewall → Configure → New Rule**:

1. Require both **Request Path equals `/api/enviar-solicitud`** and **Method equals
   `POST`**. Limit the rule's scope to the intended production host/environment.
2. Choose **Rate Limit**, **Fixed Window**, **60 seconds**, initially **5 requests**,
   with **IP** as the counting key and **Default (429)** as the action.
3. Review applicable plan quotas/pricing, save, review and publish manually. Monitor
   legitimate failures and adjust the suggested threshold to real traffic.

This initial threshold is a project recommendation. Shared NATs can block several
legitimate visitors together, while rotating/distributed IPs bypass per-IP quotas.
Vercel counts per region, so the rule is not an exact global cap. Fixed-window
boundaries also allow bursts. The WAF runs before the function, can return a
non-JSON 429 and is not reproduced by `vercel dev`; React already treats that as
an unconfirmed send. No Redis, local counter, SDK or additional service is needed.
See [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

### Manual local security checks without sending mail

Run `npm test` for mocked provider acceptance, repeat-key forwarding, conflicts,
honeypot rejection and UI retry/identifier lifecycle checks. No test contacts Resend.
For local HTTP checks, start `vercel dev` with the existing environment-loading
command above and use fictional data. This filled-honeypot request must return 400
with `validated: false`, `sent: false`, without calling Resend:

```powershell
$requestId = [guid]::NewGuid().ToString()
'{"tipoPaciente":"NUEVO","nombre":"Paciente ficticio","email":"prueba@example.com","website":"bot"}' |
  curl.exe --include --silent --show-error --request POST 'http://localhost:3000/api/enviar-solicitud' --header 'Content-Type: application/json' --header "Idempotency-Key: $requestId" --data-binary '@-'
```

Keeping the honeypot filled, malformed identifiers can also be checked safely.
To isolate identifier validation, send an empty `website` but omit the header or
set it to `not-a-uuid`; this must also return 400 without contacting Resend.
Do not send an empty honeypot with a valid UUID unless intentionally authorising
a real email: that is a valid sending request.

In the browser, block `/api/enviar-solicitud` in DevTools **before** pressing Send.
Inspect the blocked v2 request: all form sections and only the active signature
should appear, plus `website`; `Idempotency-Key` should be an anonymous UUID. Keep blocking active:
retry and confirm the key is identical; go back, edit contact and retry to see a
new key; close/reopen to check another new key. The honeypot should not appear or
receive focus with Tab. These blocked checks cannot prove real provider replay;
the tests verify key propagation and controlled conflicts using mocks, while
deduplication itself depends on the official provider contract.
The future WAF 429 rule cannot be tested locally.

### Next steps

Keep the full-form gate disabled and use fictional data only. Review the privacy,
content-encryption and provider contractual requirements in the v2 section before
considering real patient data. Production sending can be enabled with exact
`RESEND_FULL_FORM_ENABLED=true`; the environment no longer imposes an extra block.
Confirm the clinic recipient and sender domain, complete the legal/professional
information, and review the future WAF rule separately. Resend idempotency lasts
24 hours and is not identity verification or a clinical consent record.

## Current status

There is no booking system, clinical database or private portal. First-visit email
submission uses the full-form v2 contract, with sending disabled by default and
enabled only by exact `RESEND_FULL_FORM_ENABLED=true`, including production.
Privacy/security safeguards for real health data remain pending. Legacy contact-only API clients
remain supported. The interface reports provider acceptance, not delivery or a
reservation. Existing-patient email now uses the original contact-only API
contract; both WhatsApp paths retain their brief external-message behaviour.
Closing the dialog removes local form state; it cannot delete an email previously
accepted by an external provider.

Confirmed hours are Monday–Friday 09:00–14:00 and 16:00–20:00, Saturday 10:00–14:00,
and Sunday closed. Professional registration and legal holder details still need
validation before real use.

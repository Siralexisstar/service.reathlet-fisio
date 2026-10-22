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
- Forms for new and existing patients, including validation, typed or drawn signatures and contact preview.
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
- `tests/booking-dialog.test.mjs`: React first-visit flow tests using jsdom and the existing Vite/Node tools.

## Appointment request API (local email testing)

`POST /api/enviar-solicitud` accepts only an `application/json` object with:

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

### Local API development

`npm run dev` starts Vite and does **not** run the Vercel Function. To test the
actual HTTP route, configure these three **server-only** variables in the ignored
root `.env.local` file:

| Variable | Purpose | Example (not a real configuration) |
| --- | --- | --- |
| `RESEND_API_KEY` | Private Resend API credential | `replace_with_your_resend_api_key` |
| `RESEND_FROM_EMAIL` | Sender permitted by Resend | `onboarding@resend.dev` |
| `RESEND_TO_EMAIL` | Single notification recipient, controlled by the server | `test-inbox@example.com` |

[`.env.example`](.env.example) contains placeholders only. Add the two address
variables to an existing `.env.local`, preserving its private key; do not overwrite
that file with the example. If no `.env.local` exists, copy the example and replace
the placeholders privately. None of the example addresses is a working test inbox.
The handler reads these values exclusively through `process.env`, trimming outer
whitespace. If any variable is missing, empty or whitespace-only, valid requests
return the existing 500 JSON error with `validated: true` and `sent: false`, without
contacting Resend or exposing configuration values. Invalid input still returns
the normal validation error first. Never use `VITE_*` variables for these values.
Restart the server after changing `.env.local`.

Keep a **test inbox** as the recipient while the current UI and privacy notices
describe test sending. The sender must be allowed by Resend; the trial sender
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
`npm test` checks the handler and React first-visit flow without Vercel authentication.
It uses the installed TypeScript compiler and Node test runner, emitting temporary
JavaScript under `node_modules/.tmp/api-tests`; no test dependencies are added.
API tests replace `fetch` and use a fictional key. UI tests use jsdom (a development
dependency), Vite's existing TypeScript/JSX loader and Node's test runner. They
replace every outgoing HTTP request; no test can send real mail.

### First-visit browser flow

The first-visit flow now calls the API after the visitor completes the contact,
demonstration consultation and consent steps, selects email and explicitly presses
**Enviar solicitud** on the final preview. The POST contains only
`tipoPaciente: "NUEVO"`, the trimmed name/email and an empty `website` honeypot.
An anonymous UUID v4 is sent in `Idempotency-Key`. Clinical fields, signature,
phone, time preferences and consents are never included in that request.

The button shows a sending state; a synchronous guard blocks repeated clicks.
Navigation and closing are disabled while awaiting the response, for up to 20
seconds. HTTP errors, invalid JSON, `sent: false` and network errors show a clear
message with an explicit retry, preserving contact data in memory. Only a successful
HTTP response with `sent: true` displays acceptance, never a confirmed appointment
or guaranteed inbox delivery. After acceptance, sending and back navigation remain
locked until closing so the confirmation stays tied to the sent contact details.
Closing/reopening starts a fresh form;
there is no browser persistence or automatic retry.

WhatsApp remains an alternative. Existing patients retain their previous WhatsApp
and email-draft flow; they do not call this API. Notices in the flow, footer and
linked privacy pages describe the real email to a **test inbox**, while clinical
fields and signatures remain a local demonstration. Nothing in React contains
the provider key or the server's sender/recipient configuration. The recipient is
selected exclusively through server configuration.

For a complete manual browser test:

1. Start `vercel dev` with the explicit `.env.local` loading command above, and open
   `http://localhost:3000`.
2. Choose the first-visit option. Enter fictional contact details, complete the
   demonstration consultation, check both consent boxes and type a fictional signature.
3. Select email, open the preview and verify the contact-only payload in the Network
   panel. No request should occur before pressing **Enviar solicitud**.
4. Press it once to send a real test email. Check the loading state, the single POST
   and the acceptance message, then verify the test inbox separately.
5. To exercise errors without sending, block `/api/enviar-solicitud` in browser
   developer tools before clicking, or temporarily use Offline mode. Check the
   error, retained contact details and enabled retry. Restore connectivity only
   when ready to perform another real send; there is no automatic retry.
6. Close/reopen to verify the form is cleared. Check that existing patients still
   use an email draft, and first visits can still choose WhatsApp.

The API's real local sending was manually confirmed in iteration 2. This iteration's
automated checks mock HTTP; the complete real browser sending check remains manual.

### Spam and duplicate protections (iteration 4)

The first-visit form has a `website` text input inside a native `hidden` container,
also marked `aria-hidden`, with `tabIndex=-1` and autocomplete disabled. It is absent
from normal visual, keyboard and assistive-technology interaction. Its value travels
only to this endpoint. It is never forwarded to Resend, logged or persisted. A
non-empty value (including whitespace) or wrong type is rejected generically;
the response never pretends that a message was sent. Direct HTTP clients can omit
the field or send it empty, so this is only a lightweight bot signal.

React generates a UUID v4 with `crypto.randomUUID()` at the first send and retains
it only for the open dialog. Retries with unchanged contact data reuse the key.
Editing name/email or the honeypot, choosing a new first visit, or closing/reopening
starts another identifier. Clinical fields never determine the key. The server
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
contact edits, or a client that deliberately changes keys can still send another
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
Inspect the blocked request: only the three contact fields plus `website` should
appear, and `Idempotency-Key` should be an anonymous UUID. Keep blocking active:
retry and confirm the key is identical; go back, edit contact and retry to see a
new key; close/reopen to check another new key. The honeypot should not appear or
receive focus with Tab. These blocked checks cannot prove real provider replay;
the tests verify key propagation and controlled conflicts using mocks, while
deduplication itself depends on the official provider contract.
The future WAF 429 rule cannot be tested locally.

### Next steps

Manually verify the browser sending path using fictional data. Before production
use, confirm the clinic recipient, verify its sending domain/address and configure
the production WAF rule. Separate dialog sessions, changed identifiers or retries
beyond Resend's 24-hour window can still send duplicates. Notifications must contain
administrative data only; medical data and signatures remain outside this API's contract.

## Current status

Requests are still a demonstration, as in the original proposal. Use fictional data.
The form and signature remain in memory and are discarded when the dialog closes;
the email API is connected only to first visits and uses a server-configured test recipient.
There is no real booking system. The UI reports email acceptance, not delivery
or an appointment reservation.

The WhatsApp preview lets users copy the message; the real contact integration still
needs to be verified. Email can open a draft in the visitor's email client. The
message contains only the name and time preference, without health information or signature.

Confirmed opening hours are Monday to Friday, 09:00–14:00 and 16:00–20:00;
Saturday, 10:00–14:00; and Sunday, closed. The professional registration number
and legal information still contain data that must be validated. Future work includes
validating the professional details, verifying WhatsApp configuration and integrating real requests.

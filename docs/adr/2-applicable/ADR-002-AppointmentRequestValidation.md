---
type: architecture_decision_record
title: Appointment Request Validation Function
description: Placement and scope of the first serverless appointment-request endpoint.
status: accepted
date: 2026-10-15
tags: [architecture, backend, contact]
---

# ADR-002: Appointment Request Validation Function

## Context

ADR-001 keeps React + Vite as the frontend and requires documenting the placement
of a later backend. The first contact-integration iteration needs server-side
validation without email delivery, persistence or changes to the React flow.

## Decision (iteration 1)

Place a single TypeScript Vercel Function at `api/enviar-solicitud.ts` in the
existing repository. Use the Node.js runtime and the standard Request/Response
handler supported by Vercel. Keep the frontend architecture and Vite build.
No framework, provider SDK, secrets or additional dependencies are needed.

Accept POST JSON containing only `tipoPaciente` (`NUEVO` or `HABITUAL`), `nombre`
and `email`. Reject unknown fields, invalid types/values, malformed JSON and
unsupported methods/content types. Bound contact-field lengths and body size.
Return HTTP 200 with `validated: true` and `sent: false` for valid contact data.
The function does not store data, log personal data, send notifications or book
appointments. Medical data and signatures are outside this endpoint's contract.

Include the API and its Node test-runner contract tests in TypeScript checks.
Compile test artifacts into `node_modules/.tmp`, outside the frontend bundle.
Use `vercel dev` for local route testing; Vite alone does not execute functions.

## Extension: Resend sending (iteration 2)

Keep the endpoint, existing input validations and frontend unchanged. After valid
input, use Node's built-in `fetch` against Resend's official `/emails` API without
adding a provider SDK. Read the key exclusively from `process.env.RESEND_API_KEY`.
The server fixes the test sender to `onboarding@resend.dev` and recipient to
`alexis12895@hotmail.com`. Send only the three validated contact fields as plain
text, with the patient type in the subject. Do not log personal data or secrets.

Return `sent: true` only after an HTTP success with a non-empty Resend email id;
the message explicitly describes acceptance, not inbox delivery or a booking.
Missing configuration returns 500. Provider/network failures, invalid responses
and a 10-second timeout return 502 with generic errors. Validated inputs retain
`validated: true` on these failures; invalid inputs never contact Resend.
Do not retry automatically: an unknown network outcome may still have sent mail.
Tests mock all outgoing fetch calls and use a fictional key, never the local key.

Local diagnosis confirmed `.env.local` was not automatically injected by plain
`vercel dev` here. Loading it with Node's `--env-file=.env.local` before starting
the CLI made the key available in the function runtime. Only a boolean was
returned by a temporary diagnostic function, which was removed afterwards.
No real email requests were executed during implementation.

## Extension: First-visit React integration (iteration 3)

Track the selected patient type explicitly in BookingDialog, separately from form
completion. Only completed first visits that choose email can call the existing
API, after an explicit final action. Construct a three-field allowlist payload;
clinical information, signature, phone and preferences remain excluded.

Keep local sending/error/accepted state, a synchronous click guard and a bounded
20-second client wait. Disable closing/navigation while sending and further sends
after acceptance for the dialog session, including back navigation to prevent
editing already-sent contact details under a stale confirmation. Errors preserve contact data for an
explicit retry. Success requires HTTP success plus `sent: true`, and is described
as provider acceptance rather than inbox delivery or appointment confirmation.
Do not add persistence, automatic retries or server changes. Keep WhatsApp and
the existing-patient email-draft flow. Align demo/privacy notices with actual
contact-only email sending to the test inbox.

Use jsdom as a development-only dependency with the existing Vite loader and Node
test runner to exercise the actual component. Mock outgoing HTTP in every test.

## Extension: Honeypot and provider idempotency (iteration 4)

Keep the existing validations, private environment configuration, Reply-To,
contact-only provider payload, timeouts and per-dialog click guard. Add an optional
`website` body field which must be exactly empty when supplied. Render its text
input in a hidden, aria-hidden container with no keyboard tab stop. Reject filled
or incorrectly typed values with a generic 400 and never forward them to Resend.
This signal does not stop direct HTTP callers that omit it or leave it empty.

Require an anonymous UUID v4 in the `Idempotency-Key` request header. This is an
explicit contract extension for manual/legacy clients; preserve the existing
contact fields and response structure. Generate the identifier in React at the
first explicit send and retain it in a ref only for that dialog. Reuse it on
retries; invalidate it on contact/honeypot edits or a new first visit, and discard
it on closing. Do not derive identifiers from clinical or contact data.

Forward a validated, canonical key as `reathlet-solicitud/<uuid>` in Resend's
official `Idempotency-Key` header. Resend handles repeated identical payloads
across separate function invocations for 24 hours. Map provider conflicts to
controlled HTTP 409 JSON without exposing provider messages. Never work around
a conflict by silently changing the identifier or automatically retrying.

Do not introduce a database, Redis, server-local counters, caches or locks.
Document a future per-IP Vercel WAF rule for POST on this path: initially five
requests per 60 seconds with a 429 response, subject to production observation
and plan review. No Vercel project is accessed or configured in this iteration.

## Extension: Complete first-visit email (fictional testing only)

The owners explicitly request an experimental full-form email instead of adding
a database or private portal. This is an exception to the earlier contact-only
scope for fictional tests, not approval to use real health data in notifications.
Keep the existing React → Vercel Function → Resend architecture, native fetch,
private environment variables, Reply-To, honeypot and provider idempotency.

Accept `version: 2` only for `NUEVO`, retaining the versionless legacy contract
unchanged. Share public form options and wire types in `src/lib/firstVisit.ts`;
place server-only validation, PNG checks and plain-text formatting in
`server/first-visit.ts`, outside Vercel's routable `api` directory and the browser
entry graph. Validate closed nested objects, exact current select values, limits,
both consent booleans and exactly one written/drawn signature. Unanswered pain
is null, not the slider's initial visual 3. Optional phone/history/medication
remain empty strings and are rendered as “No indicado”.

Bound request reading to 256 KiB for v2 and preserve 4096 bytes for legacy.
Accept only canonical PNG Base64 up to 128 KiB decoded, 960 × 300, 8-bit RGBA,
non-interlaced. Validate CRCs, structure and bounded decompression, strip ancillary
metadata, and use Resend's official Base64 attachment format with the fixed name
`firma-paciente.png`. Never accept a remote path or caller-controlled filename.
Plain text contains six sections; no client-controlled HTML, headers or recipients.
Technical honeypot/UUID values are excluded from the message. Do not add logs,
persistent storage, clinical records, legal-signature claims or automatic retries.

**Fail closed:** full-form provider calls require private server configuration
`RESEND_FULL_FORM_ENABLED` to be exactly `true`. An absent/other value returns
503 with `validated: true`, `sent: false`, `code: FULL_FORM_DISABLED` after valid
input. This initial iteration also blocked `NODE_ENV=production` and
`VERCEL_ENV=production`; the production configuration decision below supersedes
that environment restriction. The versionless contact-only contract is unaffected.
The browser must clearly describe what reaches the server even with sending
disabled; no silent contact-only fallback is permitted. Use fictional data for
tests and complete the pending safeguards before using real clinical information.

Invalidate the per-dialog random UUID on any submitted-field change, including
clinical fields, pain answer/reset, consents, signature mode/drawing and channel.
Unchanged retries preserve the UUID and deterministic provider payload; omit
dynamic timestamps. Reset all fields, both signatures and consents when starting
a new first visit. Preserve the existing-patient and general WhatsApp flows.

Before considering real-data sending, review the legal holder and legal bases,
privacy texts, minimization, consent evidence, email-content encryption,
recipient access, retention, hosting/Resend contractual coverage and international
transfers. Resend's public DPA currently marks sensitive-data transfers as not
applicable; provider transport/at-rest encryption is not end-to-end content
encryption. Technical enablement alone does not complete these safeguards.
Tests simulate every provider call and use synthetic PNGs; no real emails are sent.

## Extension: Production sending controlled by the private flag

The owners report successful local full-form delivery and request removing only
the automatic environment restriction. Full-form provider calls now depend solely
on `process.env.RESEND_FULL_FORM_ENABLED === 'true'`, in local and production
environments alike. An absent, false, uppercase or whitespace-padded value remains
disabled; do not trim or coerce it. Neither `NODE_ENV` nor `VERCEL_ENV` controls
this decision. Keep `.env.example` disabled and do not change `.env.local`.

Preserve the v1/v2 contracts, validation, sender/recipient configuration, Reply-To,
honeypot, idempotency, error responses and tested email content/attachments. UI
notices describe conditional sending, not an unconditional production block or
simulated delivery, and retain the outstanding privacy review. Do not expose the
private flag to React. Enabling it does not establish regulatory compliance or
provide authenticated clinical records or legal consent evidence.

Verify production with absent/false values without a provider call, production
and local with exact true using a simulated provider, both environment markers
independently, and legacy requests independently of the flag. All automated tests
use fictional data and mocked HTTP; no real emails, deployments or project changes
are part of this task. The privacy, encryption, contractual, recipient-access and
retention requirements above remain pending before real health data is used.

## Consequences

The API and UI can be tested without sending real email. The local API was manually
verified in iteration 2; complete real browser sending still requires a manual
check. Vercel provides function routing separately from Vite's frontend assets;
unit tests and `vite build` alone do not verify that integration.

The current iteration uses local test sending configuration. Manual browser sending,
production recipient/sender verification and production WAF configuration remain
future work. Neither validation nor provider acceptance confirms inbox delivery
or a booking. Resend's guarantee is limited to the same key/payload for 24 hours;
new dialogs, devices, form changes or changed keys can send another email.
Honeypot and idempotency do not authenticate callers or enforce a send quota.

## References

- [ADR-001](ADR-001-Foundation.md)
- [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Resend attachments](https://resend.com/docs/dashboard/emails/attachments)
- [Resend DPA](https://resend.com/legal/dpa)
- [AEPD health email guidance](https://www.aepd.es/preguntas-frecuentes/16-salud/2-profesionales-sanitarios/FAQ-1638-puedo-enviarle-a-un-paciente-sus-informes-medicos-por-correo-electronico)
- [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)

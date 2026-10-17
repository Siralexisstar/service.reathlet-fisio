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

## Consequences

The API and UI can be tested without sending real email. The local API was manually
verified in iteration 2; complete real browser sending still requires a manual
check. Vercel provides function routing separately from Vite's frontend assets;
unit tests and `vite build` alone do not verify that integration.

The current iteration uses local test sending configuration. Manual browser sending,
production recipient/sender verification and server-side duplicate-request handling
remain future work. Neither validation nor provider acceptance confirms inbox
delivery or a booking. A new dialog session or retry after an uncertain network
outcome can still send a duplicate; the click guard is local to the dialog.

## References

- [ADR-001](ADR-001-Foundation.md)
- [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)

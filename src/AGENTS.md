# AGENTS.md — Reathlet Frontend Portal

## 1. Context and purpose

Reathlet is a physiotherapy website based in Cornellà de Llobregat.
Its purpose is to explain the services clearly and make it easy to request
an initial appointment through a simple, welcoming and professional experience.

The project is developed in versions: first the MVP design and flows;
then the real contact and request-management integrations.
Do not describe simulated functionality as implemented.

The interface and user-facing explanations are internationalized according to
the visitor's browser language.

## Internationalization

The UI detects the user's preferred browser language. It supports `ca-ES`, `fr-CH`,
`fr-FR`, `fr-LU`, `es-ES`, `it-IT`, `nl-NL`, `nl-BE`, `de-DE`, `fr-BE`, `de-CH`,
`en-GB`, `hu-HU`, `it-CH`, `pl-PL`, `de-AT`, and `tr-TR`. Unsupported languages
fall back to `en-GB`. Language detection runs when the application starts; there is
currently no manual language selector and the detected language is not persisted.

Translation catalogs live in `src/i18n/locales`. Keep all locale files structurally
aligned with `en-GB.json` when adding or changing user-facing text.

## 2. Environment and commands

Project stack: React + Vite + TypeScript.
Before working, read `package.json`, the README and the affected files.
The repository configuration and existing scripts are the source of truth.

For a project created with the `react-ts` template and npm:

```bash
npm install
npm run dev
npm run build
npm run lint
```

Run only scripts that exist in `package.json`.
If a test script exists, run the relevant tests for the change.
Use the package manager defined by the project and keep its lockfile.
Do not add another package manager or update unrelated dependencies.

## 3. Organization and coding style

Suggested structure; reuse the existing organization before creating new layers:

- `src/components/`: reusable visual components.
- `src/features/booking/`: form, consent and request flow.
- `src/data/`: clinic data, treatments and copy.
- `src/services/`: communication with the backend and external services.
- `src/lib/`: React-independent validators and utilities.
- `src/styles/`: global styles and design variables.
- `src/types/`: shared types used across multiple parts of the application.

Use functional components, hooks and explicit types in contracts.
Avoid `any`, duplicated data and components that contain the entire page.
Keep form validation separate from its presentation.
Keep state local; introduce global state only when there is a clear need.
Follow ESLint and the repository's formatting conventions.
Add dependencies only when they provide a concrete benefit, and explain why.
Do not introduce frameworks, layers or abstractions for hypothetical needs.
Do not manually edit `node_modules/`, `dist/` or other generated files.

## 4. Content and design

The home page must include:

- Clinic introduction, logo and a clear CTA: “Book an appointment”.
- Professional information and registration number.
- Treatments with understandable descriptions and access to more information.
- Clinic and service photographs in an accessible carousel.
- Process: assessment, study, treatment and follow-up.
- Address, email and WhatsApp contact.
- Access to the legal notice, privacy, cookies and accessibility statement.

Visual identity: Reathlet navy and orange, with readable typography,
generous spacing and clear hierarchy. Reuse approved colors and styles;
avoid global redesigns to solve local changes.

Prioritize mobile. Avoid horizontal overflow, small buttons and dialogs
that hide essential information.
Animations should help users understand the journey and remain brief.
Respect `prefers-reduced-motion`.
Show the logo without imposing a splash screen or delaying access.

Use the provided photographs and logo.
Do not invent reviews, accreditations, clinical outcomes or promises of recovery.
Keep the treatment descriptions supplied by the owner.
Clearly identify fictional prototype data.

Keep colors and design consistent throughout the application. Do not invent designs.
Components and images must be integrated professionally, without crude workarounds.

## 5. Clinic data

Centralize configuration to prevent differences between sections:

- Name: Reathlet.
- Address: Pg. dels Ferrocarrils Catalans, 167,
  08940 Cornellà de Llobregat, Barcelona.
- Provided email: informaciónreathlet@gmail.com.
  Confirm its spelling before enabling real sending.
- WhatsApp number: +34 611 53 79 27.
- Legal holder, professional registration number and opening hours: pending confirmation.
- Additional social networks:
  - https://www.instagram.com/reathlet_fisio/
  - https://www.tiktok.com/@reathlet_fisio?_r=1&_t=ZS-95M7tDlfvSK

Do not replace pending data with fictional information in production.
Represent unknown data explicitly, for example with `null`.

Treatments: ultrasound-guided percutaneous electrolysis, percutaneous
neuromodulation, shockwave therapy, hands-on therapy, dry needling,
therapeutic massage, diathermy and musculoskeletal ultrasound.

This information may grow as development continues; update this documentation
when the product, commands or workflows change.

## 6. Forms, consent and contact

To request an initial appointment, complete the form and consent before enabling
the final contact step.
The flow must allow users to go back while preserving what they entered during
the form session.

Request only information useful for preparing the consultation.
Clearly distinguish required contact details, optional fields and consents.
Show errors next to the relevant field and explain how to fix them.
Consent checkboxes start unchecked.
Allow a drawn signature and an accessible alternative using a typed name;
do not present the signature as a certified digital signature.

The “Existing patient” choice adapts the flow but does not authenticate the user
or authorize access to records.

During the demonstration and TEST phase:

- Use fictional data and state that the form is a demonstration.
- Keep history, medication and signature only in temporary memory.
- Do not store them in `localStorage`, `sessionStorage`, URLs or logs.
- Clear that information when the form closes or restarts.
- Do not simulate confirmations that could make the clinic appear to have received the request.

In a real integration:

- Validate the request and consents on the server as well.
- Store the record in a private area with authenticated access.
- Record the date and accepted-text version alongside the consent.
- Send administrative notifications containing a request reference.
- Keep history and signature out of WhatsApp messages and notification emails.
- Manage sending states, errors and retries without duplicating requests.

The `wa.me` WhatsApp link opens a prepared message; the patient must press “Send”.
Opening that link does not prove that the message was sent.
A `mailto:` link opens the email client and does not confirm sending either.

For automated email, the planned option is a backend or serverless function
using a provider such as Resend; verify its configuration before connecting it.
Automated WhatsApp reminders are a later phase.

## 7. Security and legal copy

`VITE_*` variables are public: their values are included in browser code.
Never put private keys, WhatsApp tokens, email credentials or database secrets
in them. Keep private credentials exclusively on the server.

Do not commit credentials or real patient data.
Do not print clinical information or signatures to the console, analytics or errors.
Use fictional examples in tests and documentation.

Legal copy must match the services actually used.
Mark drafts as pending review.
Do not claim that the website complies with all regulations merely because it
contains a legal notice or consent checkbox.
Avoid adding analytics, embedded maps or other third-party services without
assessing their privacy implications and updating the required flow.

The website must include a Legal Notice page aligned with current applicable
Spanish regulations.

## 8. Accessibility and quality

Use semantic HTML, one clear main heading and labels for form fields.
Use buttons for actions and links for navigation.
Ensure keyboard navigation, visible focus, alternative text and sufficient contrast.
Dialogs must manage focus and provide a way to close them.
Carousels must have accessible controls and a pause option when they advance automatically.
Form errors must also be communicated to screen readers.

After code changes, run build and lint when those scripts exist.
For visual changes, check desktop and mobile layouts, the CTA and navigation.
For form changes, verify required fields, going back to the previous step,
errors, consent and sending behavior.

Prioritize automated tests for validation, consent and real sending.
Use the existing test infrastructure; do not create tests that only repeat
styles or implementation details.
If a check could not be performed, state that explicitly.

## 9. Working and delivery process

Review existing changes before editing and preserve other work.
Resolve routine decisions using the available context.
Ask when missing information would change the required behavior.
Keep changes focused and avoid unrelated refactoring.
Update documentation when commands or real workflows change.

At the end, briefly explain:

- What changed and what behavior it now has.
- What was checked and the result.
- Which data or integrations are still pending.

Do not claim a feature is ready if it depends on simulations, missing credentials
or checks that were not performed.

At the end of every change, run all mandatory commands configured in the project;
do not skip them. If a check fails, resolve it rather than ignoring it.
Do not push a branch without the required validations passing.

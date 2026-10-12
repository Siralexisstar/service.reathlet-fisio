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

## Current status

Requests are still a demonstration, as in the original proposal. Use fictional data.
The form and signature remain in memory and are discarded when the dialog closes;
there is no backend and no real booking system.

The WhatsApp preview lets users copy the message; the real contact integration still
needs to be verified. Email can open a draft in the visitor's email client. The
message contains only the name and time preference, without health information or signature.

Confirmed opening hours are Monday to Friday, 09:00–14:00 and 16:00–20:00;
Saturday, 10:00–14:00; and Sunday, closed. The professional registration number
and legal information still contain data that must be validated. Future work includes
validating the professional details, verifying WhatsApp configuration and integrating real requests.

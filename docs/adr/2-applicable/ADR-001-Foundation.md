---
type: architecture_decision_record
title: Repository and Frontend Development Environment
description: Foundational decisions for the Reathlet frontend repository and development workflow.
status: accepted
date: 2026-10-11
tags: [architecture, development, repository, frontend]
---

# ADR-001: Repository and Frontend Development Environment

## Context and problem statement

Reathlet is currently a frontend-only physiotherapy website. The project needs
a lightweight and reproducible development baseline that supports fast delivery,
maintainable code and reliable validation.

The initial project constraints are:

- The project is developed by a small team.
- The current scope is the user interface; no backend is required yet.
- The architecture should remain easy to extend if backend services are added later.
- The workflow should support development with AI coding agents.
- Code quality checks should run automatically before changes are shared.

## Decision drivers

- Keep the initial architecture simple.
- Use a familiar and well-supported frontend stack.
- Make local development and production builds reproducible.
- Detect linting and type errors early.
- Avoid adding infrastructure that is not currently needed.

## Considered options

### A full-stack framework

Pros:

- Routing and server functionality are available out of the box.
- More conventions are provided by the framework.

Cons:

- It adds complexity that is not currently required.
- Backend functionality is not part of the current scope.

### A frontend-only application with React and Vite

Pros:

- Simple project structure.
- Fast development server and feedback loop.
- Suitable for the current frontend-only scope.
- Backend integrations can be added later without committing to them now.

Cons:

- Backend services and server-side concerns must be designed separately when needed.
- Some conventions must be maintained by the project team.

## Decisions

### Repository structure

Use a single frontend repository. This is not a monorepo because the project
currently contains one application and no separate backend or package workspace.
If a backend is added later, its repository or placement will be documented in
a separate ADR.

### Frontend stack

Use React for the user interface, Vite as the development and build tool, and
TypeScript for static type checking.

Use npm as the package manager and keep `package-lock.json` committed to the
repository.

### Internationalization

Use `i18next`, `react-i18next` and `i18next-browser-languagedetector` for the
internationalized interface. The browser language is detected at application
startup. If no supported browser language is detected, the website defaults to
`es-ES`; language preference is not persisted by the application.

Translation catalogs live in `src/i18n/locales` and are maintained as part of
the frontend source code. The supported languages and catalog strategy should
be maintained in a dedicated internationalization ADR if the rules become more
complex.

### Validation workflow

Use ESLint and TypeScript checks during development:

- `npm run lint` runs ESLint for the project.
- `npm run typecheck` runs `tsc -b`.
- `npm run check` runs linting followed by type checking.
- `npm run build` runs the TypeScript build and the Vite production build.

Use Husky hooks:

- `pre-commit` runs `npm run lint`.
- `pre-push` validates the branch naming convention and runs `npm run check`.

The hooks currently run checks for the whole project. `lint-staged` and
path-aware validation are not part of the current implementation; they may be
considered in a future ADR if repository size makes full checks too slow.

## Consequences

Positive consequences:

- The frontend remains lightweight and quick to develop locally.
- Builds and validation commands are explicit and reproducible.
- Type and lint errors are detected before commits or pushes are shared.
- The project has a clear path for adding backend services later.
- Internationalized copy is separated from component implementation.

Negative consequences:

- Backend functionality will require a later architectural decision.
- Full-project checks may become slower as the codebase grows.
- The team must keep locale catalogs and development scripts aligned.
- AI-generated changes still require human review and passing repository checks.

## Validation

The repository should pass:

```bash
npm run lint
npm run typecheck
npm run check
npm run build
```

## Related decisions

- A future ADR may define the backend and contact-request integration.
- A future ADR may define a more detailed internationalization and translation workflow.
- A future ADR may define path-aware checks if full-project validation becomes too slow.

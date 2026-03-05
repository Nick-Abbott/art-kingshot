# AGENTS

These instructions are for agents working in this repository.

## Expectations

- Read existing docs and code before making changes.
- Keep changes focused and avoid unrelated refactors.
- Update or add tests when server logic changes.
- Localize new or changed UI text across all locale files.
- Shared API types live in `shared/types.ts`; update these when changing request/response shapes.
- Use the shared UI layer for new UI. Prefer `ui-*` utility classes and UI primitives under `client/src/components/ui`.
- When refactoring shared client logic, run `npm run typecheck --workspace client` before broad adoption; migrate one call site at a time to keep the app booting.
- For client-side schema validation, prefer `zod/mini`-compatible APIs only; avoid full `zod` helpers that are not available in the mini build.
- Treat test changes as a last resort: only adjust tests after confirming the app builds and boots without runtime errors, and never to mask product regressions.
- Use TanStack Query for server state; avoid manual fetch + local state unless explicitly approved.
- Refer to `docs/architecture.md` for current data flow and hook conventions.

## Required Verification

- UI logic changes (behavior, state, permissions, data flow):
  - Run Playwright UI flows only.
    - Command: `npm run test:e2e`
- Visual/UI styling changes:
  - Run Playwright snapshots and review outputs in `snapshots/playwright/`.
    - Command: `npm run test:visual`
    - One-shot local runner (starts server + client, uses a separate DB and seeded session token) on alternate ports.
- Server changes:
  - Run server tests before marking the task complete.
  - Command: `npm run test:server`

If you cannot run these checks, state what was skipped and why, and list any risks.

## Common Commands

- Dev (both): `npm run dev`
- Dev (server only): `npm run dev:server`
- Dev (client only): `npm run dev:client`
- Build: `npm run build`
- Typecheck (client): `npm run typecheck`
- Tests (all): `npm run test`
- Tests (server): `npm run test:server`
- Tests (client): `npm run test:client`
- Playwright (all): `npm run test:playwright`
- Playwright (flows): `npm run test:e2e`
- Playwright (snapshots): `npm run test:visual`
- i18n key check: `npm run test:i18n`
- Smoke checks:
  - `node scripts/check-auth-flow.js`
  - `SESSION_TOKEN=your_token node scripts/check-alliance-switch.js`

## UI Layer Usage

- Base styles live in `client/src/styles.css` under `@layer components` with `ui-*` classes.
- Prefer `ui-card`, `ui-card-muted`, `ui-card-compact` for layout containers.
- Prefer `ui-input`, `ui-select`, `ui-field`, `ui-field-hint`, `ui-field-error` for forms.
- Prefer `ui-button`, `ui-button-ghost`, `ui-button-run`, `ui-button-sm`, `ui-icon-button` for actions.
- Use `ui-section-header`, `ui-section-title`, `ui-section-subtitle` for section headers.
- Use `ui-empty-state`, `ui-error`, `ui-success` for status messaging.
- Use `ui-search` and `ui-search-hint*` for typeahead inputs.
- Use `ui-tab`, `ui-pill`, `ui-codeblock`, `ui-badge` for recurring UI patterns.
 - For comprehensive UI screenshots, use the Playwright suite in `playwright/ui-snapshots.spec.ts`.

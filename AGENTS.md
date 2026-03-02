# AGENTS

These instructions are for agents working in this repository.

## Expectations

- Read existing docs and code before making changes.
- Keep changes focused and avoid unrelated refactors.
- Update or add tests when server logic changes.
- Localize new or changed UI text across all locale files.
- Shared API types live in `shared/types.ts`; update these when changing request/response shapes.

## Required Verification

- UI changes:
  - Run the snapshot script and review outputs in `snapshots/`.
  - Command: `CHROME_PATH=my_path node scripts/snapshot.js`
  - Chrome path: see `AGENTS.local.md` for local `CHROME_PATH`. If `AGENTS.local.md` does not exist, instruct the user to create one and provide the path to their chrome install.
  - If auth is enabled, pass a dev bypass token (see `AGENTS.local.md`).
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
- i18n key check: `npm run test:i18n`
- Smoke checks:
  - `node scripts/check-auth-flow.js`
  - `DEV_BYPASS_TOKEN=your_token node scripts/check-alliance-switch.js`

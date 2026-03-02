# ART Alliance Tools for Kingshot

This repository powers the primary website for the ART alliance in Kingshot. The current focus is on building internal tools to assist alliance operations (event signup, assignments, and rally organization) with Discord login required for access.

## Features

- Viking Vengeance event signup, roster, and assignment runner.
- Bear Rally group management with rally order generator.
- Player name lookup via Kingshot API proxy.
- SQLite-backed persistence for quick local setup.

## Tech Stack

- Client: React + Vite + i18next + TypeScript
- Server: Express + better-sqlite3 + TypeScript
- Database: SQLite (local file)
- Shared types: `shared/types.ts`

## Local Development

1. Ensure Node.js 20.19+ or 22.12+ is installed.
2. Install dependencies from the repo root:
   ```bash
   npm install
   ```
3. Run both client + server:
   ```bash
   npm run dev
   ```
   Or run them separately:
   ```bash
   npm run dev:client
   npm run dev:server
   ```

Client default: http://localhost:5173  
Server default: http://localhost:3001

## Discord Auth Setup

Create a Discord application and configure:
- Redirect URL: `https://art-kingshot.com/api/auth/discord/callback` (production)
- Local redirect URL: `http://localhost:3001/api/auth/discord/callback`
- Scopes: `identify`

Set the server environment variables listed below before starting the server.

## Environment Variables

Server:
- `PORT`: Server port (default `3001`)
- `DB_PATH`: SQLite file path (default `server/data/viking.sqlite`)
- `APP_BASE_URL`: URL to redirect to after auth (default `http://localhost:5173`)
- `DISCORD_CLIENT_ID`: Discord application client ID (required for login)
- `DISCORD_CLIENT_SECRET`: Discord application client secret (required for login)
- `DISCORD_REDIRECT_URI`: Discord OAuth callback URL (required for login)
- `SESSION_TTL_DAYS`: Session length in days (default `14`)
- `DEFAULT_ALLIANCE_ID`: Default alliance slug/id (default `art`)
- `DEFAULT_ALLIANCE_NAME`: Default alliance name (default `ART Alliance`)
- `DEV_BYPASS_TOKEN`: Local-only bypass token for scripts (optional, non-production)
 - `NODE_ENV`: `production` enables secure cookies (optional)

Scripts:
- `VIKING_APP_URL`: Base URL for seed script (default `http://localhost:3001`)
- `ALLIANCE_ID`: Alliance slug/id for seed script (default `art`)
- `DEV_BYPASS_TOKEN`: Passed via `x-dev-bypass` header for local seeding
- `SNAPSHOT_URL`: Base URL for snapshot script (default `http://localhost:5173`)
- `CHROME_PATH` / `GOOGLE_CHROME_BIN`: Chrome executable for Puppeteer

## Scripts

Root:
- `npm run dev` — Start client + server together
- `npm run dev:client` — Start the Vite client
- `npm run dev:server` — Start the Express server
- `npm run build` — Build server + client
- `npm run typecheck` — Typecheck client
- `npm run test` — Run server tests + i18n check + client tests
- `npm run test:server` — Run server tests
- `npm run test:client` — Run client tests
- `npm run test:i18n` — Verify i18n keys
- `npm run seed:test` — Seed test scenario data
- `node scripts/check-auth-flow.js` — Basic auth/session check (server required)
- `DEV_BYPASS_TOKEN=your_token node scripts/check-alliance-switch.js` — Smoke check for alliance selection (server required)

Snapshots:
```bash
node scripts/snapshot.js
```
This captures desktop/mobile screenshots in light/dark mode to `snapshots/` for UI review.
If auth is enabled locally, set `DEV_BYPASS_TOKEN` on the server and in the snapshot command.

## Notes

- Seed script (`npm run seed:test`) requires a running server and a `DEV_BYPASS_TOKEN` if auth is enabled.
- API conventions live in `docs/api-contract.md`.

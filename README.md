# ART Alliance Tools for Kingshot

This repository powers the primary website for the ART alliance in Kingshot. The current focus is on building internal tools to assist alliance operations (event signup, assignments, and rally organization) with Discord login required for access.

## Features

- Viking Vengeance event signup, roster, and assignment runner.
- Bear Rally group management with rally order generator.
- Player name lookup via Kingshot API proxy.
- SQLite-backed persistence for quick local setup.

## Tech Stack

- Client: React + Vite + i18next
- Server: Express + better-sqlite3
- Database: SQLite (local file)

## Local Development

1. Ensure Node.js 20.19+ or 22.12+ is installed.
2. Install dependencies:
   ```bash
   cd client
   npm install
   cd ../server
   npm install
   cd ..
   ```
3. Run the client:
   ```bash
   npm run dev:client
   ```
4. Run the server (in a separate terminal):
   ```bash
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

Scripts:
- `VIKING_APP_URL`: Base URL for seed script (default `http://localhost:3001`)
- `ALLIANCE_ID`: Alliance slug/id for seed script (default `art`)
- `DEV_BYPASS_TOKEN`: Passed via `x-dev-bypass` header for local seeding
- `SNAPSHOT_URL`: Base URL for snapshot script (default `http://localhost:5173`)
- `CHROME_PATH` / `GOOGLE_CHROME_BIN`: Chrome executable for Puppeteer

## Scripts

Root:
- `npm run dev:client` — Start the Vite client
- `npm run dev:server` — Start the Express server
- `npm run test:server` — Run server tests
- `npm run seed:test` — Seed test scenario data

Snapshots:
```bash
node scripts/snapshot.js
```
This captures desktop/mobile screenshots in light/dark mode to `snapshots/` for UI review.
If auth is enabled locally, set `DEV_BYPASS_TOKEN` on the server and in the snapshot command.

## Notes

- Seed script (`npm run seed:test`) requires a running server and a `DEV_BYPASS_TOKEN` if auth is enabled.

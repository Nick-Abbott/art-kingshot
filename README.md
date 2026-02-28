# ART Alliance Tools for Kingshot

This repository powers the primary website for the ART alliance in Kingshot. The current focus is on building internal tools to assist alliance operations (event signup, assignments, and rally organization).

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

## Environment Variables

Server:
- `PORT`: Server port (default `3001`)
- `DB_PATH`: SQLite file path (default `server/data/viking.sqlite`)
- `RUN_CODE`: Required for protected endpoints (run/reset/delete)

Scripts:
- `VIKING_APP_URL`: Base URL for seed script (default `http://localhost:3001`)
- `RUN_CODE`: Passed via `x-run-code` header when required
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

## Notes

- Protected endpoints require `RUN_CODE` to be set on the server and provided in requests.
- Seed script (`npm run seed:test`) requires a running server.

# ART Alliance Tools for Kingshot

This repository powers the primary website for the ART alliance in Kingshot. The current focus is on building internal tools to assist alliance operations (event signup, assignments, and rally organization) with Discord login required for access.

## Features

- Viking Vengeance event signup, roster, and assignment runner.
- Bear Rally group management with rally order generator.
- Player name lookup via Kingshot API proxy.
- SQLite-backed persistence for quick local setup.

## Tech Stack

- Client: React + Vite + Tailwind + i18next + TypeScript
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

## Discord Bot Usage

Members can use these slash commands inside the linked guild:
- `/link player_id` — link a Kingshot profile to your Discord account (also opts you into assignment DMs).
- `/guild associate alliance_id kingdom_id` — admins only; associate this guild to an alliance.
- `/bear register|edit|remove|view` — manage Bear Rally signup.
  - `group` is required; `rally_size` is optional if a default exists for the selected profile.
  - `profile` is optional; when omitted, the bot uses your first linked profile.
- `/vikings register|edit|remove` — manage Viking Vengeance signup.
  - `march_count` is required; `troop_count`/`power` are optional if defaults exist for the selected profile.
  - `profile` is optional; when omitted, the bot uses your first linked profile.
- `/vikings assignments` — receive Viking assignments (DM by default; `output=channel` posts to the current channel).

## Discord Guild Association (Admin)

Preferred: run `/guild associate alliance_id kingdom_id` inside the target Discord server.

Manual fallback:
- Determine the guild ID in Discord (enable Developer Mode and copy the server ID).
- Update the DB:
  ```sql
  UPDATE alliances SET guildId = 'YOUR_GUILD_ID' WHERE id = 'your-alliance-id';
  ```
- Restart the bot so it registers commands to the correct guild.

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
 - `NODE_ENV`: `production` enables secure cookies (optional)

Scripts:
- `VIKING_APP_URL`: Base URL for seed script (default `http://localhost:3001`)
- `ALLIANCE_ID`: Alliance slug/id for seed script (default `art`)
- `SESSION_TOKEN`: Session token used by local scripts (passed via `Cookie: ak_session=...`)
- `SNAPSHOT_URL`: Base URL for snapshot script (default `http://localhost:5173`)
- `PLAYWRIGHT_DB_PATH`: DB path used by Playwright to seed sessions (default set by snapshot runner)
- `CHROME_PATH` / `GOOGLE_CHROME_BIN`: Chrome executable for Puppeteer

Bot (server/bot):
- `DISCORD_APP_ID`: Discord application ID (required)
- `DISCORD_BOT_TOKEN`: Discord bot token (required)
- `DISCORD_BOT_SECRET`: Shared secret for bot-authenticated API calls (required)
- `SERVER_URL`: Base server URL for bot API calls (required, e.g. `http://localhost:3001`)
- `DISCORD_GUILD_ID`: Register commands in a single guild (optional; omit for global commands)
- `DISCORD_GUILD_ID` is not required for assignment polling; polling reads all pending notifications.
- `DISCORD_REGISTER_COMMANDS`: Set `true` to register commands on bot start (optional)
- `DISCORD_ASSIGNMENTS_POLL_MS`: Poll interval for assignment notifications (default `30000`)

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
- `npm run test:playwright` — Run all Playwright tests
- `npm run test:e2e` — Run Playwright UI flows only (desktop + mobile, light mode)
- `npm run test:visual` — Run Playwright snapshots only (all viewports + color schemes)
- `npm run lint` — Run ESLint (custom Airbnb-like ruleset)
- `npm run seed:test` — Seed test scenario data
- `node scripts/check-auth-flow.js` — Basic auth/session check (server required)
- `SESSION_TOKEN=your_token node scripts/check-alliance-switch.js` — Smoke check for alliance selection (server required)
- `node scripts/seedSession.js --db server/data/viking.sqlite` — Create a DB session token for local scripts

Playwright UI snapshots (full UI states):
```bash
npm run test:visual
```
Outputs are saved under `snapshots/playwright/`.

Playwright diagnostics on failure:
- Artifacts (screenshots, traces, videos) are stored under `test-results/`.
- Each failed test gets its own folder with the captured files.

Playwright runs with per-worker servers and per-worker SQLite DBs (see `playwright/fixtures.ts`).
Local runs boot dedicated server/client instances on available ports and reset the worker DB before each test.

CI coverage:
- PRs run `npm run test:e2e` (flows only) with artifacts uploaded on failure.
- Nightly runs `npm run test:visual` (snapshots) with artifacts uploaded on failure.

## Notes

- Seed script (`npm run seed:test`) requires a running server and a `SESSION_TOKEN`.
- API conventions live in `docs/api-contract.md`.
- Architecture reference: `docs/architecture.md`.

## UI Layer

This project uses a small UI layer built on Tailwind utilities and shared `ui-*` classes.

Where it lives:
- `client/src/styles.css` (`@layer components`) defines `ui-*` classes.
- `client/src/components/ui` contains shared React primitives (Radix wrappers, buttons, etc).

How to use it:
- Containers: `ui-card`, `ui-card-muted`, `ui-card-compact`
- Buttons: `ui-button`, `ui-button-ghost`, `ui-button-run`, `ui-button-sm`, `ui-icon-button`
- Forms: `ui-field`, `ui-input`, `ui-select`, `ui-field-hint`, `ui-field-error`
- Sections: `ui-section-header`, `ui-section-title`, `ui-section-subtitle`
- Status: `ui-empty-state`, `ui-error`, `ui-success`
- Search: `ui-search`, `ui-search-hint`, `ui-search-hint-typed`, `ui-search-hint-tail`
- Misc: `ui-badge`, `ui-pill`, `ui-tab`, `ui-codeblock`

Guidance:
- Prefer these shared classes before writing custom CSS.
- If a new pattern appears in 2+ places, add a new `ui-*` class.

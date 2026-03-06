# Sprint 4: Discord Bot Support (Phase 1)

## Goal
Enable Discord-based member interactions for Bear and Viking signups + Viking assignments while preserving existing web-only admin workflows.

## Library Decision
Use `discord.js` for bot integration (do not implement raw HTTP calls).

## Recommended Execution Order
1) DB-01 — Discovery: Discord API + auth model spike
2) DB-01b — Discovery: discord.js testing strategy
3) DB-02 — Data model + migration for guild association
4) DB-04 — Server: bot auth + member-scoped endpoints
5) DB-05 — Bot service skeleton + health checks
6) DB-03 — Admin Discord command: associate guild to alliance
7) DB-06 — /bear command set (register/edit/remove/view)
8) DB-07 — /vikings command set (register/edit/remove)
9) DB-08 — /vikings assignments delivery (DM + optional channel)
10) DB-08b — Assignment run notifications (opt-in DM)
11) DB-09 — Autocomplete for profiles + fixed options
12) DB-10 — Observability + rate limits + error copy polish
13) DB-11 — Documentation update (bot usage + admin setup)
14) DB-99 — Release Verification (full suite)

---

## Stories

### DB-01: Discovery — Discord API + Auth Model Spike
**Problem**: We need clarity on Discord slash command setup, DM behavior, guild permissions, and how to map Discord IDs to existing users.
**Status**: Complete

**Scope / Requirements**
- Investigate Discord app/bot setup requirements for slash commands + DMs.
- Confirm `discord.js` version and initialization approach for the bot runtime.
- Confirm data available in command payloads (guild ID, user ID).
- Validate how to securely map Discord ID to existing users and profiles.
- Produce a short decision memo in `docs/discord-bot-discovery.md`.

**Success Criteria**
- Documented approach for bot auth by Discord ID.
- Confirmed DM capabilities + channel posting constraints.
- Clear plan for command registration and environment variables.

**Required Verification**
- N/A (documentation only)

**Implementation Prompt**
Perform a discovery spike and document findings in `docs/discord-bot-discovery.md`.

**Validation Prompt**
Confirm the discovery memo covers auth mapping, command payloads, and DM/channel constraints.

- **Engineer Update (2026-03-06)**: added discovery memo covering Discord interaction payloads, signature verification, command registration strategy, DM constraints, and recommended env vars.
- **Engineer Tests (2026-03-06)**: not run (documentation only).
- **Engineer Update (2026-03-06)**: updated discovery memo with discord.js v14 guidance and initialization approach (Client + InteractionCreate).
- **Engineer Tests (2026-03-06)**: not run (documentation only).

---

### DB-01b: Discovery — discord.js Testing Strategy
**Problem**: We need a reliable testing approach for discord.js handlers and interaction flows.
**Status**: Complete

**Scope / Requirements**
- Research recommended testing patterns for discord.js v14 (unit vs integration).
- Decide how to mock interactions, client, and REST registration.
- Document fixtures/helpers needed for bot command testing.
- Produce a short decision memo in `docs/discord-bot-testing.md`.

**Success Criteria**
- Clear testing strategy for command handlers and auth mapping.
- Identified tooling/mocking approach and test structure.
- Documented do/don’t guidance for bot tests (what to mock vs what to integration-test).

**Required Verification**
- N/A (documentation only)

**Implementation Prompt**
Document the discord.js testing strategy in `docs/discord-bot-testing.md`.

**Validation Prompt**
Confirm the memo covers mocking approach, test scope, and recommended helpers.

- **Engineer Update (2026-03-06)**: added discord.js testing strategy memo covering unit/integration scope, interaction mocking approach, and recommended test helpers.
- **Engineer Tests (2026-03-06)**: not run (documentation only).

---

### DB-02: Data Model — Guild Association
**Problem**: We need a 1:1 association between Discord guilds and alliances.
**Status**: Complete

**Scope / Requirements**
- Add a guild association table or column (allianceId ↔ guildId).
- Enforce one guild per alliance (1:1).
- Add migration + query helpers in `server/db/queries.ts`.
- Update shared types if API shapes change.

**Success Criteria**
- Migration exists and passes on fresh DB.
- Queries support create/read/delete of guild association.
- No breaking changes to existing data.

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Add a DB migration and query helpers for a 1:1 alliance ↔ Discord guild association.

**Validation Prompt**
Verify migration and queries; run `npm run test:server`.

- **Engineer Update (2026-03-06)**: switched guild association storage to a `guildId` column on `alliances` with a unique index for 1:1 constraints; updated query helpers accordingly.
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass).
- **QA Validation (2026-03-06)**: ✓ Migration exists (`server/db/migrations/008_alliances_guild_id.sql`) and server tests pass; ✓ Queries support create/read/delete (`getAllianceGuildByAllianceId`, `getAllianceGuildByGuildId`, `upsertAllianceGuildRow`, `deleteAllianceGuildByAlliance` in `server/db/queries.ts`); ✓ No breaking changes observed (nullable `guildId` column with unique index).
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).

---

### DB-03: Admin Discord Command — Associate Guild
**Problem**: Admins need to link a Discord guild to their alliance from within Discord.
**Status**: Complete

**Scope / Requirements**
- Add an admin-only slash command to associate the current guild to an alliance.
- Determine alliance admin status by Discord ID (same role rules as the web).
- Input should accept an alliance identifier (id/tag per final decision).
- Include validation and clear success/error responses in Discord.
- This is the only admin action performed via Discord; all other admin actions remain web-only.

**Success Criteria**
- Alliance admins can associate the current guild to an alliance via slash command.
- Non-admins cannot associate a guild (clear error response).
- Association updates the DB (1:1 guild ↔ alliance).

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Implement an admin-only slash command to associate the current guild to an alliance, using Discord ID to determine admin status. Wire it to the guild association DB helpers and return clear success/error messages.

**Validation Prompt**
Verify admin-only behavior and DB updates; run `npm run test:server`.

- **Engineer Update (2026-03-06)**: added `/guild associate` admin slash command wired to `/api/bot/guild/associate`, with server-side admin checks and guild/alliance conflict validation; added bot handler + unit tests and server integration test coverage for admin enforcement and DB update.
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass).
- **QA Validation (2026-03-06)**: ✓ Admin-only `/guild associate` command defined in `server/bot/commands.ts` and handled in `server/bot/handlers/guild.ts`; ✓ Server endpoint enforces admin access and updates `alliances.guildId` with conflict checks in `server/routes/bot.ts`; ✓ Unit tests cover guild command copy and server integration test covers admin enforcement + DB update (`server/bot/handlers/guild.test.ts`, `server/api.test.ts`); ⚠️ No Discord UI smoke re-run in QA.
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).
- **TPM Re-check (2026-03-06)**: Accepted. `/guild associate` command and server endpoint enforce admin checks, validate conflicts, and update `alliances.guildId`.

---

### DB-04: Server — Bot Auth + Member-Scoped Endpoints
**Problem**: The bot needs safe access to member operations without granting admin powers.
**Status**: Complete

**Scope / Requirements**
- Add bot-authenticated endpoints that resolve Discord ID → user → profiles.
- Reuse existing member-scoped logic for Bear/Viking signups where possible.
- Add endpoint(s) to fetch assignments for a specific profile/user.
- Ensure permissions mirror the web (members can only edit their own signups).
- Follow guidance in `docs/discord-bot-discovery.md` (auth mapping + interaction constraints).
- Add server tests for new endpoints and auth mapping per DB-01b testing strategy.

**Success Criteria**
- Bot endpoints can only access data for the Discord user.
- Admin-only actions remain unavailable.
- Shared types updated for any new response shapes.

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Implement bot-authenticated endpoints for Bear/Viking signups and assignment retrieval, using Discord ID resolution. Preserve permission rules.

**Validation Prompt**
Verify member-only access and add server tests; run `npm run test:server`.

- **Engineer Update (2026-03-06)**: added bot-authenticated endpoints for Viking/Bear signups and assignment lookup, including Discord ID resolution, bot secret auth, and server-side ownership checks; added server integration tests for bot flows per DB-01b testing guidance (no discord.js unit tests at this layer).
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass).
- **QA Validation (2026-03-06)**: ✓ Bot endpoints require bot secret + Discord ID and resolve to the requesting user’s profiles only (`server/routes/bot.ts` + ownership checks); ✓ Admin-only actions remain unavailable (bot routes limited to member signup + assignment read); ✓ Shared types updated for bot assignment payloads (`shared/types.ts`).
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).

---

### DB-05: Bot Service Skeleton
**Problem**: We need a reliable bot runtime and deployment shape.
**Status**: Complete

**Scope / Requirements**
- Add a bot service entry point (e.g., `bot/` or `server/bot/`) using `discord.js`.
- Load configuration from env vars (Discord token, app ID, server URL, bot secret).
- Health check endpoint or basic startup logging.
- Register slash commands on boot (or via a script).
- Use gateway interactions only (do not implement an HTTP interactions server).
- Ensure interaction timing rules are followed (`deferReply` for long-running handlers).
- Add unit tests for bot initialization/command registration using the DB-01b testing strategy.

**Success Criteria**
- Bot can start locally with stub config and receives gateway interactions.
- Commands register successfully in a test guild.

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Create a bot service skeleton with config, command registration, and basic startup logging.

**Validation Prompt**
Confirm service boots and commands register in a test guild.

- **Engineer Update (2026-03-06)**: added bot service skeleton with discord.js client, env-based config, optional command registration via REST, and basic startup/interaction logging; added `npm run bot` script and command definitions placeholder.
- **Engineer Update (2026-03-06)**: removed interactions endpoint since gateway-only handling is now required; kept `deferReply` timing in interaction handler and unit tests for command registration routing per DB-01b guidance.
- **Engineer Update (2026-03-06)**: added bot init unit test with mocked client + interaction flow; refactored bot bootstrap to avoid env-required config at import time and guard boot behind `require.main`.
- **Engineer Update (2026-03-06)**: added root `dev:bot` script to run the bot with `.env` via dotenv, added `bot:dev` watch script under the server workspace, and included the bot in the root `npm run dev` concurrently run.
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass); manual Discord smoke not run (needs Discord env + guild).
- **QA Validation (2026-03-06)**: ✗ Request verification + interaction timing rules per `docs/discord-bot-discovery.md` not implemented (no signature verification or `deferReply`); ✗ Bot init/command registration unit tests not found; ◻️ Bot local start + command registration in test guild not verified (requires Discord env + guild).
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).
- **QA Validation (2026-03-06)**: ✓ Signature verification + PING handling implemented in `server/bot/interactionsServer.ts`; ✓ Interaction timing uses `deferReply` + `editReply` in `server/bot/index.ts`; ⚠️ Unit tests added for command registration routing, but no bot init test found; ◻️ Bot local start + command registration in test guild not verified (requires Discord env + guild).
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).
- **Engineer Update (2026-03-06)**: manual smoke completed in test guild; commands registered and `/bear` + `/vikings` responded with placeholder reply.
- **QA Validation (2026-03-06)**: ✓ Gateway-only handling confirmed (no HTTP interactions server present); ✓ `deferReply` timing in interaction handler (`server/bot/index.ts`); ✓ Bot init + command registration unit tests present (`server/bot/index.test.ts`, `server/bot/registerCommands.test.ts`); ✓ Manual Discord smoke reported by engineering (commands registered, placeholder replies). 
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).

---

### DB-06: /bear Commands
**Problem**: Members need Bear signup actions in Discord.
**Status**: Complete

**Scope / Requirements**
- Implement `/bear register`, `/bear edit`, `/bear remove`, `/bear view`.
- Use autocomplete for profile selection and bear group.
- Responses use the copy from the design doc.
- Ensure permissions: only own profiles.
- Add unit tests for `/bear` command handling per DB-01b testing strategy.

**Success Criteria**
- Members can manage Bear signup via Discord.
- Errors are clear (missing profile, permissions).

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Implement `/bear` subcommands using bot endpoints. Use standardized response copy.

**Validation Prompt**
Verify each subcommand end-to-end and check response copy.

- **Engineer Update (2026-03-06)**: implemented `/bear` register/edit/remove/view command handling with autocomplete, wired to bot endpoints, added bot profiles/bear view endpoints, and added unit tests for bear command copy per DB-01b.
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass).
- **Engineer Update (2026-03-06)**: adjusted `/bear` option ordering so required args precede optional profile; confirmed manual smoke in test guild is passing.
- **QA Validation (2026-03-06)**: ✓ `/bear` register/edit/remove/view implemented with autocomplete in `server/bot/commands.ts`, `server/bot/handlers/bear.ts`, and routed in `server/bot/index.ts`; ✓ Bot endpoints exist for bear register/remove/view + profiles (`server/routes/bot.ts`); ✓ Copy coverage via unit tests in `server/bot/handlers/bear.test.ts`; ⚠️ No Discord UI smoke re-run in QA.
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).

---

### DB-07: /vikings Commands (Register/Edit/Remove)
**Problem**: Members need Viking signup actions in Discord.
**Status**: Complete

**Scope / Requirements**
- Implement `/vikings register`, `/vikings edit`, `/vikings remove`.
- Use autocomplete for profile selection.
- March count required; troop count/power optional (per design).
- Response copy matches spec.
- Add unit tests for `/vikings` signup command handling per DB-01b testing strategy.

**Success Criteria**
- Members can manage Viking signups via Discord.
- Required/optional inputs behave correctly.

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Implement `/vikings` signup subcommands with correct validation and copy.

**Validation Prompt**
Verify command behavior and input validation; run `npm run test:server`.

- **Engineer Update (2026-03-06)**: implemented `/vikings` register/edit/remove with optional profile resolution, autocomplete, and optional troop/power handling (defaults to profile stats); added unit tests for copy and server tests for optional payload handling.
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass).
- **QA Validation (2026-03-06)**: ✓ `/vikings` register/edit/remove implemented with autocomplete in `server/bot/commands.ts`, `server/bot/handlers/vikings.ts`, and routed in `server/bot/index.ts`; ✓ March count required, troop/power optional via command options + handler validation; ✓ Copy coverage via unit tests in `server/bot/handlers/vikings.test.ts`; ⚠️ No Discord UI smoke re-run in QA.
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).

---

### DB-08: /vikings assignments Delivery
**Problem**: Users need their assignments in Discord, preferably via DM.
**Status**: Complete

**Scope / Requirements**
- Implement `/vikings assignments` with output target `dm|channel`.
- DM by default; channel post only when requested.
- Reuse standard instruction copy in the message header.
- Add unit tests for assignment delivery (DM + channel) per DB-01b testing strategy.

**Success Criteria**
- Assignments are delivered by DM by default.
- Channel posting works when requested.
- Response copy matches spec.

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Implement assignment delivery via DM and channel; use standard copy from the design doc.

**Validation Prompt**
Verify DM and channel paths and copy; run `npm run test:server`.

- **Engineer Update (2026-03-06)**: implemented `/vikings assignments` with DM default + optional channel output, using standard header copy and assignment formatting; added unit tests for DM/channel delivery and copy handling.
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass).
- **QA Validation (2026-03-06)**: ✓ `/vikings assignments` implemented with DM default + optional channel output in `server/bot/commands.ts` and `server/bot/handlers/vikings.ts`; ✓ Header copy + assignment formatting present; ✓ Unit tests cover DM + channel delivery in `server/bot/handlers/vikings.test.ts`; ⚠️ No Discord UI smoke re-run in QA.
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).

---

### DB-08b: Assignment Run Notifications (Opt-in DM)
**Problem**: Members want assignments delivered automatically when a run is generated, but unsolicited DMs can violate Discord policy and user expectations.
**Status**: Complete

**Scope / Requirements**
- Add an opt-in preference for assignment DMs (default off).
- When assignments are run, send DMs to opted-in members with their assignments.
- If DM fails (privacy settings), record failure and rely on the existing `/vikings assignments` command for manual retrieval (no channel fallback required).
- Ensure messaging complies with Discord policy: only message users who have opted in or previously interacted with the bot in-context.
- Reuse the standard assignment header copy.

**Success Criteria**
- Only opted-in users receive automatic assignment DMs.
- DM failures are handled gracefully and logged; users can still retrieve assignments via `/vikings assignments`.
- No unsolicited DMs are sent.

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Implement opt-in assignment notifications triggered by assignment runs. Enforce opt-in and handle DM failures gracefully, relying on `/vikings assignments` for manual retrieval if DM fails. Keep copy consistent with the design doc.

**Validation Prompt**
Verify opt-in enforcement, DM failure handling (status recorded), and copy. Confirm `/vikings assignments` still returns assignments for manual retrieval. Run `npm run test:server`.

- **Engineer Update (2026-03-06)**: treated account linking as opt-in; restored notifications queue table and bot polling with periodic cleanup; added server tests for opt-in flag and queueing on assignment runs.
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass).
- **QA Validation (2026-03-06)**: ✓ Opt-in enforced via `users.botOptInAssignments` and `listOptedInAssignmentRecipients` in `server/db/queries.ts`; ✓ Assignment run queues notifications for opted-in users (`server/routes/assignments.ts`, `server/api.test.ts`); ✓ Bot polls and sends DMs, marking status sent/failed and logging failures (`server/bot/index.ts`, `server/routes/bot.ts`); ⚠️ No explicit test for DM failure logging/fallback beyond status update; ⚠️ No Discord UI smoke re-run in QA.
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).
- **TPM Re-check (2026-03-06)**: Accepted. DM failure status is recorded in `server/bot/index.ts`, and `/vikings assignments` supports manual retrieval via `server/bot/handlers/vikings.ts` + `server/routes/bot.ts`.
 
**QA Notes**
- Bot currently polls `/api/bot/assignments/notifications` and sends DMs, but there is no server-side test coverage for notification queueing/opt-in enforcement.
- Verify opt-in flag behavior and queue creation on assignment runs before accepting.

- **Engineer Update (2026-03-06)**: updated bot notifications polling to fetch pending notifications across all alliances (no guild filter), and added server test coverage for the global notifications endpoint.
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass).

---

### DB-09: Autocomplete for Profiles and Fixed Options
**Problem**: Slash commands must be fast and unambiguous.
**Status**: Complete

**Scope / Requirements**
- Implement autocomplete for profile selection (Discord ID → profiles).
- Provide fixed options for bear group and assignment output target.
- Ensure only user-owned profiles are suggested.
- Add unit tests for autocomplete handlers per DB-01b testing strategy.

**Success Criteria**
- Autocomplete returns expected profiles and options.
- No cross-user profile leakage.

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Add autocomplete handlers for profiles and fixed options; enforce ownership.

**Validation Prompt**
Verify autocomplete behavior and ownership rules.

- **Engineer Update (2026-03-06)**: filtered profile autocomplete to active profiles only and added unit tests for bear/vikings autocomplete filtering; fixed options remain static choices for bear group and assignments output.
- **Engineer Tests (2026-03-06)**: `npm run test:server` (pass).
- **QA Validation (2026-03-06)**: ✓ Profile autocomplete filters to active profiles only in `server/bot/handlers/bear.ts` and `server/bot/handlers/vikings.ts`; ✓ Fixed options remain static for bear groups and assignment output in `server/bot/commands.ts`; ✓ Unit tests cover active-only filtering in `server/bot/handlers/bear.test.ts` and `server/bot/handlers/vikings.test.ts`; ⚠️ No Discord UI smoke re-run in QA.
- **QA Tests (2026-03-06)**: `npm run test:server` (pass).
- **TPM Re-check (2026-03-06)**: Accepted. Autocomplete lists user-owned active profiles via `/api/bot/profiles`, bear group options are fixed via autocomplete list, and assignments output uses fixed choices in `server/bot/commands.ts`.

---

### DB-10: Observability + Rate Limits + Error Copy
**Problem**: Bot failures must be diagnosable and user-friendly.
**Status**: Backlog (moved to `docs/backlog.md`)

---

### DB-11: Documentation Update
**Problem**: Members and admins need clear setup/use guidance.
**Status**: Complete

**Scope / Requirements**
- Add usage docs for `/bear` and `/vikings` commands.
- Document admin guild association steps.
- Document env vars required for bot service.

**Success Criteria**
- Docs cover member flows and admin setup.
- Env vars are documented.

**Required Verification**
- N/A (documentation only)

**Implementation Prompt**
Update README or `docs/` with bot usage + setup.

**Validation Prompt**
Confirm docs are clear and complete.

- **Engineer Update (2026-03-06)**: documented bot usage (`/link`, `/bear`, `/vikings`), manual guild association steps, and bot env vars in `README.md`.
- **Engineer Tests (2026-03-06)**: not run (documentation-only change).
- **Engineer Update (2026-03-06)**: added `/guild associate` to bot usage docs and updated guild association section to prefer the command with manual DB fallback in `README.md`.
- **Engineer Tests (2026-03-06)**: not run (documentation-only change).
- **QA Validation (2026-03-06)**: ✓ Bot usage documented in `README.md` (slash commands + argument notes); ✓ Admin guild association steps documented in `README.md`; ✓ Bot env vars listed in `README.md`.
- **QA Tests (2026-03-06)**: not run (documentation-only change).
- **TPM Re-check (2026-03-06)**: Accepted. README covers bot usage, admin guild association steps, and bot env vars.

---

### DB-99: Release Verification (Full Suite)
**Status**: Complete
**Problem**: Ensure sprint is deployment-ready.

**Scope / Requirements**
- Run full validation suite:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:e2e`
  - `npm run test:visual`

**Success Criteria**
- All commands pass or failures are explicitly triaged with owner + follow-up story.

**Required Verification**
- Full suite above

**Implementation Prompt**
Run the full validation suite and record results in the sprint doc.

**Validation Prompt**
Confirm all results are recorded and passing; if not, ensure follow-up is created.

- **Engineer Update (2026-03-06)**: completed full release verification suite for Sprint 4.
- **Engineer Tests (2026-03-06)**: `npm run lint` (pass); `npm run typecheck` (pass); `npm run test` (pass); `npm run test:e2e` (pass); `npm run test:visual` (pass).
- **TPM Re-check (2026-03-06)**: Accepted based on recorded full-suite run. If any failures surface in CI, create a follow-up story.

---

## Sprint 4 Closeout (2026-03-06)
- Scope delivered: Discord bot support shipped with discord.js runtime, guild association command, member signup/assignment commands, opt-in assignment notifications, and documentation updates.
- Quality gates: Full validation suite recorded as passing; server test coverage added for bot endpoints and core command handling.
- Risks/deferrals: Observability + rate limiting moved to `docs/backlog.md` (DB-10). Manual Discord UI smoke remains a per-release checklist item.

# Discord Bot Testing Strategy (DB-01b)

Date: 2026-03-06

## Summary
This memo defines a testing strategy for discord.js v14 command handling in this repo. The goal is fast, deterministic tests that validate command logic, auth mapping, and response formatting without requiring live Discord APIs.

## Source-backed Constraints (for test timing + registration)
- Interaction initial responses must be sent within 3 seconds; interaction tokens remain valid for 15 minutes for followups/edits. This timing informs tests that validate `deferReply()` usage for long-running handlers.
- Slash command registration is done via the discord.js REST client using `Routes.applicationCommands` or `Routes.applicationGuildCommands`. Guild deployment is recommended for development; global deployment is for production.
- Global commands are available in all authorized guilds and in DMs by default.

## Recommended Test Layers

### 1) Unit tests (primary)
Focus: command handler logic, input validation, auth mapping, and response formatting.
- Mock `ChatInputCommandInteraction` (or wrap it behind a thin adapter).
- Stub `interaction.deferReply`, `editReply`, `reply`, `followUp`.
- Provide minimal `interaction.user`, `interaction.guildId`, and `interaction.options` for each test case.
- Validate that handlers call the expected API endpoints and produce the correct response copy.

### 2) Integration tests (selective)
Focus: server endpoints and permission enforcement.
- Use current `server/api.test.ts` style (start app, seed SQLite).
- Validate bot-authenticated endpoints with Discord ID mapping and ownership checks.

### 3) Manual smoke (only when needed)
Focus: Discord command registration and real interaction flow.
- Use a dev guild with slash commands registered to confirm Discord UX.
- Keep this outside CI; document steps in README when bot service lands.

## Mocking Approach (discord.js v14)
Use lightweight POJOs for interactions rather than fully instantiating `Client`:
- `interaction.isChatInputCommand()` -> return true
- `interaction.commandName` + `interaction.options.getString/getNumber/getBoolean`
- `interaction.user` and optional `interaction.member`
- `interaction.guildId` and `interaction.channelId`
- `interaction.deferReply`, `interaction.editReply`, `interaction.reply`, `interaction.followUp` -> jest/vi spies

Avoid mocking discord.js internals directly (e.g., REST internals) unless testing registration functions.

## Command Registration
If command registration logic exists, isolate it into a function that:
- Accepts a REST client interface (injected) with `put`/`post`.
- Accepts command definitions as plain JSON.

Unit tests can then:
- Provide a fake REST client with spies.
- Assert that the correct endpoint and body are used.

## Fixtures / Helpers to Add (when bot code lands)
Create `bot/testUtils.ts` (or `server/bot/testUtils.ts`) with:
- `createFakeInteraction({ commandName, userId, guildId, options })`
- `createFakeOptions({ string, number, boolean })`
- `captureReplies(interaction)` -> returns reply payloads
- `createFakeRestClient()` -> returns `put`/`post` spies

## Do / Don’t Guidance
Do:
- Test handler logic in isolation (no Discord network).
- Use server integration tests for bot endpoints and auth mapping.
- Keep mock objects minimal and stable; only implement fields you use.

Don’t:
- Spin up a real Discord client in unit tests.
- Mock discord.js internals that are not directly consumed by your code.
- Depend on live Discord APIs in CI.

## Notes for DB-04/05+
- Prefer a thin adapter around discord.js interactions to reduce test surface.
- Keep error copy centralized to make tests stable across copy changes.

## References
- Discord Interactions: https://docs.discord.com/developers/interactions/receiving-and-responding
- discord.js Guide — Command Deployment: https://discordjs.guide/creating-your-bot/command-deployment
- discord.js REST + Routes Example: https://discord.js.org/docs/packages/discord.js/main

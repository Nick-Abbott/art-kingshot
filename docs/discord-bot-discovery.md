# Discord Bot Discovery Memo (DB-01)

Date: 2026-03-06

## Summary
This memo records Discord API findings for Phase 1 bot support. It focuses on interaction payloads, command registration, DM behavior, and request verification so we can scope bot auth and endpoints with confidence.

## Interaction Payloads & Identity Mapping
- Interaction payloads include `guild_id`, `channel_id`, and `member` when invoked in a guild, and `user` when invoked in a DM. `member` is only present for guild interactions. This gives us a reliable Discord user ID for mapping to existing app users/profiles. 
- Interaction types include `PING` and `APPLICATION_COMMAND` (slash commands), and the initial response must be sent within 3 seconds; interaction tokens remain valid for 15 minutes for followups.

Implication for auth:
- Use Discord `user.id` from the interaction payload as the canonical ID for bot auth.
- Resolve Discord ID -> user -> profiles; if no match, respond with the “Please link a Kingshot profile on the website first” copy from the design doc.

## discord.js Version & Initialization Approach
- Use discord.js v14.x (current stable major). Avoid v13-era APIs (`Intents.FLAGS`, `message`/`interaction` events).
- Initialize a single `Client` with only required intents for slash commands (typically `GatewayIntentBits.Guilds`).
- Handle slash commands through `InteractionCreate`, with `deferReply()` for any operation that might exceed Discord's 3-second response window.
- Use discord.js REST helpers for command registration (no raw HTTP calls).

Reference init shape (server-side):
```js
const { Client, Events, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply({ ephemeral: true });
  // handle command
});
```

## Interaction Endpoint Verification
- Discord requires request signature verification using the app’s public key. The official `discord-interactions` helper uses the `X-Signature-Ed25519` and `X-Signature-Timestamp` headers to validate the raw request body.
- The interaction endpoint must respond to `PING` requests during verification.

Implication for implementation:
- Bot service should verify every request with the public key, reject invalid signatures, and handle `PING` as a fast path.

## Command Registration & Scopes
- Application commands are registered via HTTP endpoints and require the `applications.commands` scope (included with `bot`).
- Guild commands update instantly and are recommended for development/testing; global commands are for production/public use.
- Global commands are available in DMs if the app’s bot shares a mutual guild with the user.
- Command `contexts` define where commands can be used: `GUILD`, `BOT_DM`, and `PRIVATE_CHANNEL` (the latter only for user-installed apps).

Implication for our rollout:
- Use guild-scoped commands for local/test guilds to iterate quickly.
- Ship global commands when stable; keep contexts to `GUILD` and `BOT_DM` only (no user-install flow).

## DM Behavior (Phase 1)
- DM interactions are possible through `BOT_DM` context; for guild-installed apps this requires global commands and a mutual guild.
- Assignment delivery can be DM by default, with a channel option as fallback when requested.

Open risk to validate in QA:
- User DM privacy settings can block DMs; ensure we handle errors gracefully and fall back to channel responses when requested.

## Recommended Env Vars
- `DISCORD_APP_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_SECRET` (if OAuth linking is needed)
- `DISCORD_GUILD_ID` (optional, for dev-only guild command registration)

## References
- Discord Interactions (payload fields, types, timing): https://docs.discord.com/developers/interactions/receiving-and-responding
- Discord Getting Started (verification + PING): https://docs.discord.com/developers/docs/getting-started
- Discord Application Commands (registration, scopes, contexts, DM availability): https://docs.discord.com/developers/interactions/application-commands
- discord-interactions-js (signature headers/verification): https://github.com/discord/discord-interactions-js

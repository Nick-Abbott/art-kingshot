# Discord Bot Support Design

## Problem
Members want to interact with alliance tools without leaving Discord. Today, all actions require the website, which slows adoption and reduces participation during events.

## Goals
- Allow members to register/manage Bear and Viking signups via Discord slash commands.
- Allow members to receive Viking assignments in Discord (DM by default).
- Allow alliance admins to associate a Discord guild with their alliance.
- Keep permissions identical to the website (admin actions remain web-only).
- Preserve existing Discord-based authentication and multi-profile support.

## Non-Goals
- Admin actions (approvals, role changes, resets) via Discord.
- Replacing the website for power/admin workflows.
- Supporting multiple guilds per alliance (out of scope unless requested later).

## Key Decisions (Confirmed)
- Web login via Discord remains required; Discord ID is the canonical identity.
- A Discord user can link multiple Kingshot profiles.
- Alliance admin status is determined by existing app roles in SQLite (same as web).
- Single command per event with sub-actions and autocomplete.
- Viking assignments are sent via DM by default; users can request a channel post.
- Admin actions happen only on the website, not via the bot.

## UX Overview

### Guild Association (Admin-only, Web)
- Admins associate a Discord guild with their alliance from the website.
- This enables the bot in that guild and unlocks slash commands for members.

### Member Flows (Discord)
- /bear ...
  - register, edit, remove, view
- /vikings ...
  - register, edit, remove, assignments

Each command uses autocomplete for profile selection and any needed fields.

### Assignment Delivery (Discord)
- /vikings assignments
  - Default: DM the user with their assignment.
  - Optional: user can request a channel post via a command flag.

## Command Design

### /bear
Sub-actions:
- register
- edit
- remove
- view

Inputs (autocomplete where applicable):
- profile (user’s linked Kingshot profiles)
- rally size
- bear group (e.g., Bear 1, Bear 2)

### /vikings
Sub-actions:
- register
- edit
- remove
- assignments

Inputs (autocomplete where applicable):
- profile (user’s linked Kingshot profiles)
- march count
- power (optional; see data notes)
- troop count (optional; see data notes)
- assignments: output target (dm|channel)

## Data & Permissions

### Identity
- Discord ID is the canonical identity for auth.
- Link multiple Kingshot profiles to a single Discord ID.
- The bot resolves the Discord ID to an existing account or requires web login to create/link.

### Permissions
- Members can only modify their own signups.
- Admin-only actions remain website-only:
  - Approvals
  - Role changes
  - Event reset
  - Manual roster edits

## Data Model Considerations
- Store Discord guild association per alliance (1:1).
- Ensure Discord ID is stored on profiles/users as it is today for role determination.
- Bot uses existing API endpoints where possible; avoid new admin endpoints.

## API & System Changes (High-Level)
- Bot service authenticates requests by Discord ID.
- Bot uses member-scoped endpoints for:
  - Create/update/remove Bear signup
  - Create/update/remove Viking signup
  - Fetch Viking assignments for the requesting user
- Web UI adds “Connect Discord Guild” admin flow.

## Copy (Bot Responses)

### Registration Success (Bear)
“Registered! You’re signed up for {Bear Group} with rally size {Rally Size}.”

### Registration Success (Vikings)
“Registered! You’re signed up with {March Count} marches.”

### Edit Success
“Updated. Your registration details have been saved.”

### Remove Success
“Removed. You are no longer signed up for this event.”

### Assignment DM Intro
“Here are your Viking assignments. Use Equalize on every march and send all marches to the listed target(s).”

### Assignment Channel Intro
“{User}, here are your Viking assignments. Use Equalize on every march and send all marches to the listed target(s).”

### Missing Profile
“Please link a Kingshot profile on the website first, then try again.”

## Acceptance Criteria
- Alliance admin can associate a Discord guild with their alliance via the website.
- Members in the associated guild can use /bear and /vikings commands.
- Bot only allows members to manage their own signups.
- Admin actions remain website-only.
- /vikings assignments sends a DM by default and can post to a channel when requested.
- Autocomplete works for profile selection and any fixed options (bear group, output target).

## Open Questions (for future scope)
- Should we support multiple guilds per alliance?
- Should the bot support reminder scheduling or event start notifications?
- Should we allow auto-sync of Discord roles to app roles?

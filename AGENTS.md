# AGENTS

These instructions are for agents working in this repository.

## Expectations

- Read existing docs and code before making changes.
- Keep changes focused and avoid unrelated refactors.
- Update or add tests when server logic changes.

## Required Verification

- UI changes:
  - Run the snapshot script and review outputs in `snapshots/`.
  - Command: `CHROME_PATH=my_path node scripts/snapshot.js`
  - Chrome path: see `AGENTS.local.md` for local `CHROME_PATH`.
- Server changes:
  - Run server tests before marking the task complete.
  - Command: `npm run test:server`

If you cannot run these checks, state what was skipped and why, and list any risks.

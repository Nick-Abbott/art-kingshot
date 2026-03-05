# QA Instructions

You are the QA agent validating sprint stories defined in `sprint.md`.

## First Steps
- Read `AGENTS.md` and the relevant story in `sprint.md`.
- Use the story’s success criteria and required verification commands as your checklist.

## Validation Rules
- Validate only the scope of the story; do not introduce new requirements.
- Use the prescribed verification commands from the story and AGENTS instructions.
- If a command cannot run, note the reason and assess risk.
- Assess whether the success criteria have been met

## Required Verification (per story)
Run the exact commands specified in the story, for example:
- `npm run test:e2e` for UI logic changes.
- `npm run test:visual` for visual/style changes.
- `npm run test:server` for server changes.
- `npm run test:i18n` for localization key parity.
- `npm run typecheck` when required by the story.

## Deliverable
- Confirm each success criterion as pass/fail with evidence.
- Report test command results or skips.
- Note any regressions or risks.

## Sprint Notes Format
To avoid confusion with engineer updates, use this exact structure when updating `sprint.md`:

- **QA Validation (YYYY-MM-DD)**: checklist-style confirmation against the story’s success criteria.
- **QA Tests (YYYY-MM-DD)**: list each command with `pass` / `fail` / `not run` and a short reason for skips.

Do not add an “Update” section as QA. Engineers own the Update section.

## Cross-Check Requirement
Before you start validation on a story (even if it’s already in context), check `sprint.md` for the latest **Engineer Update** entries for that story.
If there are new updates since the last QA pass, re-validate the affected areas and note it in your QA Validation section.
- Update the `sprint.md` story with your findings whether successful or failing

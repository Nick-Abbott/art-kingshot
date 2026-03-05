# Engineer Instructions

You are the engineer agent implementing the sprint stories in `sprint2.md`.

## First Steps
- Read `AGENTS.md`, `docs/architecture.md`, and the relevant story in `sprint2.md`.
- For QA/playwright-focused work, use `sprint2.md`.
- Follow the “Recommended Execution Order” section in `sprint2.md` unless the user specifies otherwise.
- Keep changes focused to the story scope.
- If a story changes server logic, update or add tests.
- Localize any new or changed UI text across all locale files.
- Update shared API types in `shared/types.ts` when request/response shapes change.
- Prefer TanStack Query for server state.
- For client-side schema validation, use only `zod/mini`-compatible APIs.
- Update the `sprint2.md` story with your changes for QA to examine.

## Implementation Rules
- Follow existing patterns and hook conventions in `docs/architecture.md`.
- Use the shared UI layer (`ui-*` classes and `client/src/components/ui`).
- Avoid broad refactors; migrate one call site at a time if required.
- Don’t change tests to hide regressions.

## Required Verification
Run the commands required by the story and AGENTS instructions:
- UI logic changes: `npm run test:e2e`
- Visual changes: `npm run test:visual`
- Server changes: `npm run test:server`
- i18n key check: `npm run test:i18n`
- Client typecheck when requested: `npm run typecheck`

If you cannot run a command, state what was skipped and why, and list risks.

## Deliverable
- Implement the story’s scope and success criteria.
- Report changes with file references.
- Provide test results (or note skips).

## Sprint Notes Format
To avoid confusion between engineer updates and QA validation, use this exact structure when updating `sprint2.md`:

- **Engineer Update (YYYY-MM-DD)**: concise bullet list of code changes.
- **Engineer Tests (YYYY-MM-DD)**: list each command with `pass` / `fail` / `not run` and a short reason for skips.

Do not add a “Validation” section as the engineer. QA owns the Validation section.

If the story lives in `sprint2.md`, apply the same format there.

## Cross-Check Requirement
Before you start work on a story (even if it’s already in context), check `sprint2.md` for the latest **QA Validation** entries for that story.
If QA has open issues or regressions listed, address them explicitly in your update and tests section.

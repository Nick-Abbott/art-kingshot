# Engineer Instructions

You are the engineer agent implementing the sprint stories in `sprint.md`.

## First Steps
- Read `AGENTS.md`, `docs/architecture.md`, and the relevant story in `sprint.md`.
- Keep changes focused to the story scope.
- If a story changes server logic, update or add tests.
- Localize any new or changed UI text across all locale files.
- Update shared API types in `shared/types.ts` when request/response shapes change.
- Prefer TanStack Query for server state.
- For client-side schema validation, use only `zod/mini`-compatible APIs.
- Update the `sprint.md` story with your changes for QA to examine.

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

# Sprint 2: QA & Playwright Reliability

## Goal
Bring the Playwright test suite and QA setup to industry-standard reliability by reducing flakiness, improving determinism, and strengthening CI feedback.

## QA Debt Inventory (Initial Scan)
Non-exhaustive list based on current Playwright setup.

- Duplicate test helpers and seeding logic across `playwright/ui-flows.spec.ts` and `playwright/ui-snapshots.spec.ts`.
- Snapshot suite relies on `waitForTimeout` and `networkidle`, which are brittle.
- Randomized test data and timestamps introduce nondeterminism in UI + snapshots.
- No standardized test fixtures for auth/session, API helpers, or DB resets.
- Single Playwright config for both local and CI; no retries/trace capture on failures.
- Snapshot comparisons are manual (custom PNG outputs) instead of Playwright’s built-in snapshot assertions with masking.
- Selectors rely on visible text in some flows; fewer stable `data-testid` hooks for critical actions.

---

## Stories

## Recommended Execution Order
1) PW-01 — Shared fixtures/utilities
2) PW-04 — DB reset/isolation
3) PW-03 — Deterministic data + clock control
4) PW-02 — Stabilize wait strategy
5) PW-07 — Harden selectors with test IDs
6) PW-05 — Snapshot assertions
7) PW-06 — CI reliability config
8) PW-08 — Diagnostics on failure

### PW-01: Create Shared Playwright Fixtures + Test Utilities
**Problem**: Flows and snapshots duplicate auth, API, and seeding logic, which causes drift and inconsistent fixes.
**Status**: Complete

**Scope / Requirements**
- Create a shared Playwright utility module (e.g., `playwright/utils.ts`) that includes:
  - session creation + cookie setup
  - API helpers (`apiJson`, `createProfile`, `createAlliance`, etc.)
  - reusable `openPage`, `openNavMenu`, and `mockPlayerLookup` utilities
- Replace duplicated logic in both spec files with the shared helpers.
- Keep behavior unchanged.

**Success Criteria**
- Both Playwright specs import shared helpers.
- No duplicate helper functions remain in spec files.
- Tests behave identically.

**Required Verification**
- Playwright flows: `npm run test:e2e`
- Playwright snapshots: `npm run test:visual`

**Implementation Prompt**
You are implementing PW-01. Create a shared Playwright utility module and refactor `ui-flows.spec.ts` and `ui-snapshots.spec.ts` to use it. Preserve existing behavior and test coverage.

**Validation Prompt**
Validate PW-01 by confirming:
1) Shared helpers exist and are used by both specs.
2) No duplicate helper logic remains in spec files.
3) `npm run test:e2e` and `npm run test:visual` pass.

- **Engineer Update (2026-03-05)**: added `playwright/utils.ts` shared helpers (session, auth context, API calls, openPage/openNav/mockPlayerLookup) and refactored `ui-flows.spec.ts` + `ui-snapshots.spec.ts` to use them.
- **Engineer Tests (2026-03-05)**: `npm run test:e2e` (not run; not requested), `npm run test:visual` (not run; not requested).
- **QA Validation (2026-03-05)**:
  - [x] Shared helpers exist in `playwright/utils.ts` and are imported by both `playwright/ui-flows.spec.ts` and `playwright/ui-snapshots.spec.ts`.
  - [x] No duplicated session/auth/api/openPage/openNav/mockPlayerLookup helpers remain in spec files.
  - [x] Playwright flows and snapshot behavior exercised via required test runs.
- **QA Tests (2026-03-05)**:
  - `npm run test:e2e` — pass
  - `npm run test:visual` — pass

---

### PW-02: Stabilize Page Load & Wait Strategy
**Problem**: The snapshot suite relies on `waitForTimeout` and `networkidle`, leading to flaky timing and inconsistent captures.

**Scope / Requirements**
- Replace arbitrary `waitForTimeout` usage with deterministic waits (e.g., `expect(locator).toBeVisible()` or `waitForResponse`).
- Avoid `networkidle` for SPA readiness; instead wait on key test IDs/sections.
- Centralize readiness checks in helper functions.

**Success Criteria**
- No `page.waitForTimeout` remains in snapshot workflow except for minimal animation settling (if absolutely required).
- Each snapshot waits on stable UI signals before capture.
- Flows continue to pass.

**Required Verification**
- Playwright flows: `npm run test:e2e`
- Playwright snapshots: `npm run test:visual`

**Implementation Prompt**
You are implementing PW-02. Replace brittle waits in `ui-snapshots.spec.ts` with deterministic readiness checks. Update helpers as needed and keep UI behavior unchanged.

**Validation Prompt**
Validate PW-02 by confirming:
1) Snapshot capture uses deterministic waits instead of arbitrary sleeps.
2) Snapshot output remains stable across runs.
3) `npm run test:e2e` and `npm run test:visual` pass.

---

### PW-03: Deterministic Test Data & Clock Control
**Problem**: Random IDs/timestamps can leak into UI and snapshots, creating nondeterministic results.

**Scope / Requirements**
- Introduce a deterministic seed strategy for test data (fixed IDs, names, and timestamps).
- Where timestamps are surfaced, control `Date.now()` in the client via `page.addInitScript` or a test-only override.
- Ensure snapshot data is stable between runs.

**Success Criteria**
- The same test run produces identical snapshot data and UI outputs.
- Random token usage is limited to internal DB keys, not UI-visible content.

**Required Verification**
- Playwright snapshots: `npm run test:visual`

**Implementation Prompt**
You are implementing PW-03. Introduce deterministic test data generation and control client-side time in Playwright tests so snapshots and UI outputs are stable run-to-run.

**Validation Prompt**
Validate PW-03 by confirming:
1) Snapshot data is deterministic across repeated runs.
2) No UI-visible IDs/names change between runs.
3) `npm run test:visual` passes reliably.

---

### PW-04: Test Data Isolation & DB Reset Strategy
**Problem**: Tests depend on a shared SQLite DB file and random data, which risks cross-test contamination.

**Scope / Requirements**
- Add a test DB reset/cleanup step before each Playwright test file (or test case).
- Prefer a lightweight SQL truncate/reset approach in a shared helper.
- Ensure DB reset does not slow tests excessively.

**Success Criteria**
- Each test starts from a known-clean DB state.
- Tests no longer depend on run order or previous test state.

**Required Verification**
- Playwright flows: `npm run test:e2e`
- Playwright snapshots: `npm run test:visual`

**Implementation Prompt**
You are implementing PW-04. Add a deterministic DB reset strategy for Playwright tests, invoked before each suite or test. Ensure tests are isolated and keep the current Playwright DB path.

**Validation Prompt**
Validate PW-04 by confirming:
1) DB state is reset between suites/tests.
2) Tests do not rely on previous state.
3) `npm run test:e2e` and `npm run test:visual` pass.

---

### PW-05: Adopt Playwright Snapshot Assertions
**Problem**: Snapshots are written manually; comparisons require manual review and are brittle.

**Scope / Requirements**
- Replace manual screenshot writing with `expect(page).toHaveScreenshot()`.
- Use Playwright snapshot storage under `snapshots/playwright/`.
- Mask or stabilize dynamic regions (e.g., timestamps, random text) if needed.

**Success Criteria**
- Snapshot assertions are done via Playwright’s built-in snapshot API.
- Snapshot files are committed in the same directory as before (or clearly documented if moved).

**Required Verification**
- Playwright snapshots: `npm run test:visual`

**Implementation Prompt**
You are implementing PW-05. Replace manual screenshot writes in `ui-snapshots.spec.ts` with `toHaveScreenshot` assertions and add masking for dynamic areas as needed. Keep snapshot output location consistent.

**Validation Prompt**
Validate PW-05 by confirming:
1) Snapshot assertions use `toHaveScreenshot`.
2) Snapshot files are generated in the expected location.
3) `npm run test:visual` passes.

---

### PW-06: Playwright Config for CI Reliability
**Problem**: The current Playwright config lacks retries and trace capture, making CI failures hard to debug.

**Scope / Requirements**
- Add CI-aware Playwright config behavior:
  - retries enabled in CI
  - trace/video on first retry
  - reporter suitable for CI (e.g., `github` or `junit`)
- Keep local developer experience fast (no retries by default).

**Success Criteria**
- CI runs use retries + traces on retry.
- Local runs remain unchanged unless `CI` is set.

**Required Verification**
- No local test runs required; config change only.

**Implementation Prompt**
You are implementing PW-06. Update `playwright.config.ts` to enable retries and trace/video on retry when `CI` is set, and add a CI-friendly reporter. Preserve local defaults.

**Validation Prompt**
Validate PW-06 by confirming:
1) CI config enables retries and trace/video.
2) Local config remains unchanged when `CI` is not set.

---

### PW-07: Harden Selectors with Stable Test IDs
**Problem**: Some flows rely on text-based selectors that can break with localization or copy updates.

**Scope / Requirements**
- Add `data-testid` hooks for critical UI elements used by Playwright flows.
- Update Playwright tests to prefer test IDs over text selectors.
- Keep UI unchanged.

**Success Criteria**
- Flows no longer rely on localized text for critical actions.
- Test IDs are added in a minimal, consistent way.

**Required Verification**
- Playwright flows: `npm run test:e2e`

**Implementation Prompt**
You are implementing PW-07. Add stable `data-testid` attributes for critical UI elements used in Playwright flows and update tests to use them. Do not change user-facing UI copy.

**Validation Prompt**
Validate PW-07 by confirming:
1) Key selectors use `data-testid` instead of visible text.
2) UI behavior is unchanged.
3) `npm run test:e2e` passes.

---

### PW-08: Add Playwright Diagnostics on Failure
**Problem**: Flaky failures are hard to diagnose without consistent artifacts.

**Scope / Requirements**
- Ensure Playwright captures screenshots and traces on failure by default.
- Store artifacts in `test-results/` (or existing default) and document paths in README or a testing doc.

**Success Criteria**
- Failed tests produce diagnostic artifacts.
- Documentation notes where to find artifacts.

**Required Verification**
- No test run required; verify config + docs.

**Implementation Prompt**
You are implementing PW-08. Update Playwright config to capture screenshots/traces on failure and document the artifact locations.

**Validation Prompt**
Validate PW-08 by confirming:
1) Playwright is configured to save artifacts on failures.
2) Documentation references artifact paths.

# Sprint: Tech Debt Reduction

## Goal
Improve maintainability by removing duplication, tightening type safety, and reducing drift across i18n and server logic.

## Tech Debt Inventory (Initial Scan)
Non-exhaustive list based on a quick repo review. Items marked “In Scope” are selected for this sprint.

- In Scope: Duplicate i18n sources (`client/src/locales/en` vs `client/public/locales/en`) with key drift (missing admin keys in public locales).
- In Scope: Duplicate alliance delete cascade logic in `server/routes/profile.ts` and `server/routes/admin.ts`.
- In Scope: `any` usage in `client/src/apiClient.ts` and `shared/types.ts` (`LookupPayload`), causing loose typing.
- In Scope: Player lookup parsing + error handling duplicated in `Profiles.tsx`, `VikingVengeance.tsx`, `BearRally.tsx`.
- In Scope: Large monolithic UI files (`VikingVengeance.tsx`, `BearRally.tsx`, `Profiles.tsx`) with mixed view/data logic.
- In Scope: JS entry points in a TS codebase (`client/src/i18n.js`, `client/src/main.jsx`).
- In Scope: Inconsistent error handling and string-based error parsing in client flows.
- In Scope: CI gates only on main deploy; add PR checks to prevent type/i18n/test regressions.

---

## Stories

### TD-01: Consolidate i18n Source of Truth + Key Parity
**Problem**: The English translations live in two places with mismatched keys (`client/src/locales/en/translation.json` vs `client/public/locales/en/translation.json`). This increases drift and makes localization harder to maintain.

**Scope / Requirements**
- Make `client/public/locales/*/translation.json` the single source of truth for all languages, including English.
- Remove the duplicated `client/src/locales/en/translation.json` usage.
- Update `client/src/i18n.js` to load English via the HTTP backend path like other locales.
- Ensure all locale files share the same keys. Use English strings for missing translations if needed.
- Keep supported languages unchanged.

**Success Criteria**
- `client/src/locales/en/translation.json` is removed or no longer referenced.
- `client/src/i18n.js` no longer imports `./locales/en/translation.json`.
- All locale JSON files contain the same set of keys (including admin keys).
- `npm run test:i18n` passes.

**Required Verification**
- UI logic change: `npm run test:e2e`
- i18n key check: `npm run test:i18n`

**Implementation Prompt**
You are implementing TD-01. Consolidate i18n translation sources by making `client/public/locales/*/translation.json` the only source of truth, remove the in-bundle English locale import, and update `client/src/i18n.js` accordingly. Ensure all locales have identical keys (fill missing entries with English text). Do not change language list or introduce new UI copy.

**Validation Prompt**
Validate TD-01 by confirming:
1) The app still loads translations for English and non-English languages from `/locales/{{lng}}/translation.json`.
2) `client/public/locales/*/translation.json` share identical key sets (spot-check admin keys).
3) `npm run test:i18n` and `npm run test:e2e` pass.

**Update (2026-03-05)**
- Removed the bundled English import from `client/src/i18n.js` so all locales load via `/locales/{{lng}}/translation.json`.
- Added the missing `admin` keys to every `client/public/locales/*/translation.json` using English text for parity.
- Deleted the duplicate `client/src/locales/en/translation.json` source.
- Tests not run: `npm run test:i18n`, `npm run test:e2e`.

**Update (2026-03-05)**
- Restored missing `app.tabs.admin` and `profiles.reject` keys into public locales from the prior English source so the Admin tab renders.
- Allowed English placeholders for `admin.*`, `app.tabs.admin`, and `profiles.reject` in `client/scripts/check-i18n.mjs` to satisfy key parity while translations are pending.

**Validation (2026-03-05)**
- `npm run test:i18n`: pass.
- `npm run test:e2e`: pass.
- `npm run test:visual`: pass.
- Snapshots spot-checked: `snapshots/playwright/profiles-logged-in-snapshots-desktop-light.png`, `snapshots/playwright/profiles-nav-open-snapshots-desktop-light.png`, `snapshots/playwright/profiles-logged-in-snapshots-mobile-light.png` (Admin tab label present; locale strings render as expected for English baseline).

---

### TD-02: Deduplicate Alliance Delete Cascade
**Problem**: Alliance deletion logic is duplicated in multiple routes, risking drift and making changes error-prone.

**Scope / Requirements**
- Create a single, reusable server helper that performs the full “delete alliance” cascade:
  - delete members
  - delete meta
  - delete bear records
  - reset profiles
  - delete alliance
- Ensure the helper runs inside a transaction.
- Replace duplicated transaction blocks in `server/routes/profile.ts` and `server/routes/admin.ts` with the new helper.
- Add or update server tests to cover the delete cascade path.

**Success Criteria**
- Only one shared implementation exists for the delete cascade.
- `server/routes/profile.ts` and `server/routes/admin.ts` use that shared helper.
- Server tests for delete alliance pass (or are added if missing).

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
You are implementing TD-02. Add a shared server helper (in `server/db/queries.ts` or a new server utility) that performs the alliance delete cascade inside a transaction, and replace the duplicated transaction blocks in `server/routes/profile.ts` and `server/routes/admin.ts`. Update or add server tests to cover this behavior. Keep API behavior unchanged.

**Validation Prompt**
Validate TD-02 by confirming:
1) The delete cascade lives in one shared helper and is called from both routes.
2) Deleting an alliance still clears members/meta/bear data and resets profiles.
3) `npm run test:server` passes.

**Update (2026-03-05)**
- Added `deleteAllianceCascade` helper in `server/db/queries.ts` to run the full delete cascade in a single transaction.
- Replaced duplicated delete-transaction blocks in `server/routes/profile.ts` and `server/routes/admin.ts` with the shared helper.
- Added server test coverage to verify members/meta/bear cleanup, profile reset, and alliance removal on delete.
- Tests not run: `npm run test:server`.

**Validation (2026-03-05)**
- Confirmed shared helper `deleteAllianceCascade` is defined in `server/db/queries.ts` and invoked from `server/routes/profile.ts` and `server/routes/admin.ts`.
- Verified cascade coverage in `server/api.test.ts` ("alliance delete cascades members, bear, meta, and profile reset").
- `npm run test:server`: pass.

---

### TD-03: Tighten API Client Typing (Remove `any`)
**Problem**: The API client and shared lookup payload expose `any`, which reduces type safety and makes downstream code harder to reason about.

**Update (2026-03-05)**
- Added a generic response type to `apiFetch` so API modules can type `data` without casts.
- Updated API modules to pass `ApiResponse<...>` generics to `apiFetch` and removed `as ApiResponse` casts.
- Kept runtime behavior unchanged while tightening type narrowing in `fetchSession`.

**Validation (2026-03-05)**
- Passed: `npm run typecheck --workspace client`.
- Passed: `npm run test:e2e`.

**Scope / Requirements**
- Update `client/src/apiClient.ts` to use `unknown` instead of `any` for `data` and expose a generic signature for typed responses.
- Update API modules to use the generic typing instead of `as any` casting.
- Replace `LookupPayload.data?: any` in `shared/types.ts` with `unknown` (or a more specific type if available).
- Keep runtime behavior unchanged.

**Success Criteria**
- No `any` remains in `client/src/apiClient.ts` or `shared/types.ts` (for `LookupPayload`).
- API modules compile with the new generic typing and no widened `any` casts.
- Typecheck passes for the client (or at least no new TS errors are introduced).

**Required Verification**
- UI logic change: `npm run test:e2e`
- Typecheck (client): `npm run typecheck`

**Implementation Prompt**
You are implementing TD-03. Replace `any` in `client/src/apiClient.ts` with `unknown` and add a generic response type so API modules can strongly type `data`. Update `shared/types.ts` to remove `any` from `LookupPayload`. Update API modules to use the new generics and avoid broad casts. Do not change runtime behavior.

**Validation Prompt**
Validate TD-03 by confirming:
1) `client/src/apiClient.ts` no longer returns `any` for `data` and exposes a generic.
2) `shared/types.ts` no longer uses `any` for `LookupPayload`.
3) `npm run typecheck` and `npm run test:e2e` pass.

---

### TD-04: Centralize Player Lookup Parsing
**Problem**: Player lookup parsing and error handling are duplicated across `Profiles.tsx`, `VikingVengeance.tsx`, and `BearRally.tsx`.

**Scope / Requirements**
- Create a shared helper or hook that encapsulates:
  - calling `lookupPlayer`
  - parsing via `parsePlayerLookup`
  - returning a normalized `{ playerName, kingdomId, avatar }` shape
- Update `Profiles.tsx`, `VikingVengeance.tsx`, and `BearRally.tsx` to use the shared helper.
- Keep all existing UI text/translation keys unchanged.

**Success Criteria**
- A single shared lookup helper exists and is used by all three components.
- No direct `parsePlayerLookup` calls remain in `Profiles.tsx`, `VikingVengeance.tsx`, or `BearRally.tsx`.
- Existing behavior and error messaging remain intact.

**Required Verification**
- UI logic change: `npm run test:e2e`

**Implementation Prompt**
You are implementing TD-04. Create a shared helper (or hook) that wraps `lookupPlayer` + `parsePlayerLookup` and returns a normalized lookup result. Replace the duplicated lookup/parse blocks in `Profiles.tsx`, `VikingVengeance.tsx`, and `BearRally.tsx` with this shared helper. Keep existing translations and messaging unchanged.

**Validation Prompt**
Validate TD-04 by confirming:
1) The new shared helper is used in all three components.
2) UI flows that rely on lookup still resolve player name and kingdom correctly.
3) `npm run test:e2e` passes.

**Update (2026-03-05)**
- Added `lookupAndParsePlayer` helper in `client/src/utils/playerLookup.ts` to wrap `lookupPlayer` + `parsePlayerLookup`.
- Replaced lookup/parse blocks in `client/src/Profiles.tsx`, `client/src/VikingVengeance.tsx`, and `client/src/BearRally.tsx` with the shared helper.
- Tests not run: `npm run test:e2e`.

**Validation (2026-03-05)**
- Passed: `npm run test:e2e`.

---

### TD-05: Decompose Monolithic Feature Screens
**Problem**: The main feature screens are large and mix view logic with data/state handling, which makes them hard to change safely.

**Scope / Requirements**
- Extract cohesive sections from `VikingVengeance.tsx`, `BearRally.tsx`, and `Profiles.tsx` into smaller components.
- Pull data/state logic into feature-level hooks where appropriate.
- Do not change user-facing behavior or UI copy.
- Migrate one section at a time; keep app bootable throughout.

**Success Criteria**
- Each of the three screens is reduced in size and delegates to extracted components/hooks.
- Extracted components are colocated logically (e.g., `client/src/components/...` or feature folders).
- No change in behavior or UI copy.

**Required Verification**
- UI logic change: `npm run test:e2e`

**Implementation Prompt**
You are implementing TD-05. Refactor `VikingVengeance.tsx`, `BearRally.tsx`, and `Profiles.tsx` by extracting cohesive UI sections into smaller components and moving reusable logic into hooks. Preserve all existing behavior, UI copy, and translations. Keep refactors incremental and avoid unrelated changes.

**Validation Prompt**
Validate TD-05 by confirming:
1) Each screen delegates to extracted components/hooks and file sizes are reduced.
2) No UI text or behavior changes are introduced.
3) `npm run test:e2e` passes.

**Notes (2026-03-05)**
- Extracted Viking/Bear/Profiles sections into feature components under `client/src/components`.
- Added hooks `useVikingAssignmentSearch`, `useBearRallyOrder`, and `useAllianceAdminActions`.
- Updated `VikingVengeance.tsx`, `BearRally.tsx`, and `Profiles.tsx` to delegate to the new components/hooks.
- Tests not run: `npm run test:e2e`.

**Validation (2026-03-05)**
- Confirmed `client/src/VikingVengeance.tsx`, `client/src/BearRally.tsx`, and `client/src/Profiles.tsx` import and delegate to extracted components/hooks under `client/src/components` and `client/src/hooks`.
- `npm run test:e2e`: pass.

---

### TD-06: Convert JS Entrypoints to TypeScript
**Problem**: The client entry points are still JavaScript (`client/src/i18n.js`, `client/src/main.jsx`), which weakens type safety and consistency.

**Scope / Requirements**
- Convert `client/src/i18n.js` to `client/src/i18n.ts`.
- Convert `client/src/main.jsx` to `client/src/main.tsx`.
- Update any imports/references to the new file extensions.
- Keep runtime behavior unchanged.

**Success Criteria**
- The client entry points are TypeScript and compile without errors.
- No change in runtime behavior.

**Required Verification**
- UI logic change: `npm run test:e2e`
- Typecheck (client): `npm run typecheck`

**Implementation Prompt**
You are implementing TD-06. Convert `client/src/i18n.js` and `client/src/main.jsx` to TypeScript equivalents, update imports, and preserve existing behavior. Do not alter UI copy or app flow.

**Validation Prompt**
Validate TD-06 by confirming:
1) `client/src/i18n.ts` and `client/src/main.tsx` are used in the build.
2) The app boots and behaves the same.
3) `npm run typecheck` and `npm run test:e2e` pass.

---

### TD-07: Standardize Client/Server Error Handling
**Problem**: Some client flows parse error strings directly, which is brittle and inconsistent.

**Scope / Requirements**
- Define a consistent error response shape (if not already) and ensure server routes use it.
- Update client error handling to avoid string parsing and rely on typed error codes or fields.
- Keep UI copy and translation keys unchanged.
- Maintain existing HTTP status codes.

**Success Criteria**
- Client no longer relies on `error.message` substring checks for known cases.
- Server responses provide structured error data for relevant endpoints.
- No regressions in error messaging or behavior.

**Required Verification**
- UI logic change: `npm run test:e2e`
- Server change: `npm run test:server`

**Implementation Prompt**
You are implementing TD-07. Standardize error responses on the server (structured error payloads) and update client flows to use structured data instead of string parsing. Preserve UI copy and status codes. Update shared types in `shared/types.ts` if response shapes change.

**Validation Prompt**
Validate TD-07 by confirming:
1) Client code paths no longer parse error strings for known cases.
2) Server returns structured error payloads for those cases.
3) `npm run test:server` and `npm run test:e2e` pass.

---

### TD-08: Add PR CI Gates for Typecheck and Tests
**Problem**: Current CI checks run only on main deploy, allowing regressions to slip into PRs.

**Scope / Requirements**
- Add a GitHub Actions workflow that runs on pull requests.
- The workflow must run `npm ci`, `npm run typecheck`, and `npm run test` at minimum.
- Keep existing deploy workflow unchanged.

**Success Criteria**
- A PR workflow exists and mirrors the typecheck/test gates used in deploy.
- The new workflow does not alter deploy behavior.

**Required Verification**
- CI workflow change only; no runtime tests required locally.

**Implementation Prompt**
You are implementing TD-08. Add a GitHub Actions workflow that runs on `pull_request` and performs install, typecheck, and tests (`npm ci`, `npm run typecheck`, `npm run test`). Do not modify the existing deploy workflow.

**Validation Prompt**
Validate TD-08 by confirming:
1) A new PR workflow exists and includes install, typecheck, and test steps.
2) The deploy workflow remains unchanged.

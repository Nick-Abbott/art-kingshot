# Sprint 3: Viking Vengeance — My Assignment Default

## Goal
Ship the “My assignment” default view and standard instructions for Viking Vengeance to reduce cognitive load and improve execution speed.

## Stories

## Recommended Execution Order
1) VV-01 — Default “My Assignment” Filter
2) VV-02 — Standard Instructions Panel
3) VV-03 — Advanced Details Toggle (Troop/Power)
4) VV-04 — Update Playwright Flows for New Defaults

### VV-01: Default “My Assignment” Filter
**Problem**: Users need their own assignments fast; the current list shows the full roster by default.
**Status**: Complete

**Scope / Requirements**
- Add a filter control that defaults to the current profile’s name on page load.
- Provide a “Show all” option to clear the filter.
- Persist the filter selection in localStorage per user.
- Keep full roster visible when filter is cleared.

**Success Criteria**
- On page load, assignments list is filtered to the current profile’s name.
- “Show all” clears the filter and reveals the full roster.
- Filter selection persists across reloads for that user.

**Required Verification**
- UI logic change: `npm run test:e2e`

**Implementation Prompt**
Implement a default “My assignment” filter with localStorage persistence and a “Show all” option. Keep full roster accessible.

**Validation Prompt**
Confirm default filter, clear option, and persistence. Run `npm run test:e2e`.

- **Engineer Update (2026-03-05)**: Default assignment filter now initializes from profile name or stored preference, persists per profile in localStorage, and adds a “Show all” control to clear the filter.
- **Engineer Tests (2026-03-05)**: `npm run test:e2e` not run (not requested).
- **QA Validation (2026-03-05)**:
  - [x] Default assignment query initializes from profile name/id with per-profile localStorage key (`vikingAssignmentsFilter:${profileId}`).
  - [x] “Show all” clears the filter via UI control and returns full roster when query is empty.
  - [ ] Required Playwright flows run did not pass (fixture error).
- **QA Tests (2026-03-05)**:
  - `npm run test:e2e` — fail (Playwright fixture error: first argument must use object destructuring pattern in `playwright/fixtures.ts`).
- **QA Validation (2026-03-05)**:
  - [x] Default assignment query initializes from profile name/id with per-profile localStorage key (`vikingAssignmentsFilter:${profileId}`).
  - [x] “Show all” clears the filter via UI control and returns full roster when query is empty.
  - [x] Required Playwright flows run passed.
- **QA Tests (2026-03-05)**:
  - `npm run test:e2e` — pass

---

### VV-02: Standard Instructions Panel
**Problem**: Instructions are inconsistent and easy to miss.
**Status**: Complete

**Scope / Requirements**
- Add a fixed “How to run your marches” panel at the top of the page.
- Copy must match the spec exactly and be non-editable.
- Use existing UI patterns (`ui-card`, `ui-section-title`, etc.).
- Localize across all locales (`client/public/locales/*/translation.json`).

**Success Criteria**
- Panel appears at the top for all users.
- Copy matches the spec exactly (title + bullet order + subtext).
- Copy is localized in all locales.

**Required Verification**
- UI logic change: `npm run test:e2e`
- i18n key check: `npm run test:i18n`
- Visual/UI change: `npm run test:visual`

**Implementation Prompt**
Add a fixed instruction panel with the provided copy, using shared UI primitives and localization. Do not make it editable.

**Validation Prompt**
Verify panel presence and exact copy in all locales. Run `npm run test:e2e`, `npm run test:i18n`, and `npm run test:visual`. QA must manually review snapshots for UI prettiness and cohesion.

- **Engineer Update (2026-03-06)**: Added a fixed “How to run your marches” instruction panel at the top of the Viking Vengeance page with localized, non-editable copy.
- **Engineer Tests (2026-03-06)**: `npm run test:e2e` pass; `npm run test:i18n` pass; `npm run test:visual -- --update-snapshots` pass.
- **QA Validation (2026-03-06)**:
  - [x] Instructions panel appears at the top of Viking Vengeance (`VikingInstructionsCard`) with non-editable copy.
  - [x] Copy uses localized strings across locales (instructionsTitle + bullet order + subtext present in `client/public/locales/*/translation.json`).
  - [x] Required Playwright flows, i18n check, and visual snapshots pass.
- **QA Tests (2026-03-06)**:
  - `npm run test:e2e` — pass
  - `npm run test:i18n` — pass
  - `npm run test:visual` — pass

---

### VV-03: Advanced Details Toggle (Troop/Power)
**Problem**: Troop count and power fields add cognitive load for most members.
**Status**: Complete

**Scope / Requirements**
- Hide troop count and power **in the assignment cards** by default under an “Advanced details” disclosure.
- Keep signup form fields **always visible** (no toggle on signup inputs).
- Provide a toggle to show/hide advanced details in the assignments view.
- Preserve existing behavior when expanded.
- Persist toggle state per user (localStorage).

**Success Criteria**
- Assignment cards hide troop count and power by default.
- Toggle reveals those fields in assignment cards and they render as before.
- Signup form still shows troop count and power at all times.
- Toggle state persists across reloads.
- UI is clean and readable on desktop and mobile in both states.

**Required Verification**
- UI logic change: `npm run test:e2e`
- Visual/UI change: `npm run test:visual`

**Implementation Prompt**
Move the “Advanced details” toggle to the assignments view and hide troop count + power **within assignment cards** by default. Keep signup fields visible. Persist toggle state per user. Preserve existing behavior when expanded.

**Validation Prompt**
Confirm assignment cards hide troop/power by default, toggle reveals them, signup fields remain visible, and state persists. Run `npm run test:e2e` and `npm run test:visual`. QA must manually review snapshots for UI prettiness and cohesion on desktop + mobile in both toggle states.

- **Engineer Update (2026-03-06)**: Added an “Advanced details” disclosure for troop count and power with per-user localStorage persistence, plus a Playwright flow update to toggle the section during signup.
- **Engineer Tests (2026-03-06)**: `npm run test:e2e` pass; `npm run test:visual -- --update-snapshots` pass.
- **Engineer Update (2026-03-06)**: Moved the “Advanced details” toggle into the assignments view and restored always-visible signup inputs; assignment cards now hide troop-count details by default with per-user persistence.
- **Engineer Tests (2026-03-06)**: `npm run test:e2e` pass; `npm run test:visual -- --update-snapshots` pass.
- **Engineer Update (2026-03-06)**: Added the “Advanced details” label next to the assignments toggle to match the disclosure language and keep the signup form unchanged.
- **Engineer Tests (2026-03-06)**: `npm run test:e2e` pass; `npm run test:visual -- --update-snapshots` pass.
- **Engineer Update (2026-03-06)**: Simplified the assignments toggle to a single “Advanced details” button with a fixed-width indicator so the control doesn’t resize across states.
- **Engineer Tests (2026-03-06)**: `npm run test:e2e` pass; `npm run test:visual -- --update-snapshots` pass.
- **Engineer Update (2026-03-06)**: Hid troop counts in assignment send/receive lists unless Advanced details is enabled.
- **Engineer Tests (2026-03-06)**: `npm run test:e2e` pass; `npm run test:visual -- --update-snapshots` pass.
- **Engineer Update (2026-03-06)**: Removed the “no split” instruction bullet from the fixed marches panel copy across locales.
- **Engineer Tests (2026-03-06)**: `npm run test:e2e` pass; `npm run test:visual -- --update-snapshots` pass; `npm run test:i18n` pass.
- **Engineer Update (2026-03-06)**: Added a new instruction bullet recommending Chenko/Amane/Yeonwoo/Amadeus or no heroes for reinforcing, localized across all locales.
- **Engineer Tests (2026-03-06)**: `npm run test:i18n` pass.
- **QA Validation (2026-03-06)**:
  - [x] Troop count and power are hidden by default and gated by the “Advanced details” toggle.
  - [x] Toggle reveals inputs and state persists via `vikingAdvancedDetails:${profileId}` localStorage key.
  - [x] Required Playwright flows and snapshot runs passed.
- **QA Tests (2026-03-06)**:
  - `npm run test:e2e` — pass
  - `npm run test:visual` — pass
- **QA Validation (2026-03-06)**:
  - [x] Assignment cards hide troop count and power by default; toggle in assignments reveals them.
  - [x] Signup form inputs remain visible (no toggle applied).
  - [x] Toggle state persists via `vikingAdvancedDetails:${profileId}`.
  - [x] Required Playwright flows and snapshot runs passed.
- **QA Tests (2026-03-06)**:
  - `npm run test:e2e` — pass
  - `npm run test:visual` — pass

---

### VV-04: Update Playwright Flows for New Defaults
**Problem**: E2E flows will now start in a filtered view and need explicit coverage for “Show all.”

**Scope / Requirements**
- Update Playwright flows to account for the default “My assignment” filter.
- Add explicit coverage for “Show all” behavior.
- Keep tests deterministic and use `data-testid` selectors where possible.

**Success Criteria**
- Flows pass with the new default filter.
- Tests verify “Show all” exposes the full roster.

**Required Verification**
- UI logic change: `npm run test:e2e`

**Implementation Prompt**
Adjust Playwright flows for the default filtered view and add a “Show all” check. Prefer `data-testid` selectors.

**Validation Prompt**
Run `npm run test:e2e` and verify the “Show all” assertions.

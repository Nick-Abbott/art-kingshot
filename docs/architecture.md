# Architecture Guide

This guide is a quick reference for agents working in this repo. It summarizes how data flows, where logic lives, and how to extend the system safely.

## High-Level Layout

- `client/` — React + Vite app (TypeScript).
- `server/` — Express API + SQLite (better-sqlite3).
- `shared/` — Shared API types (`shared/types.ts`).
- `playwright/` — UI flow tests and UI snapshots.
- `docs/` — Project documentation and contracts.

## Client Architecture

### Data Fetching
- **TanStack Query** powers most client-side server state.
- Query hooks live in `client/src/hooks/`.
- Shared helpers:
  - `useProfilesListQuery` — base list query for profiles.
  - `useProfileListMutation` — base mutation helper for approve/reject/suspend/role.
  - `useEligibleMembersBaseQuery` — base query for eligible member lists.
- **Session** is still managed in `useSession.ts` (local state).

### Key Data Flows
- **Profiles**: `useProfilesQuery`, `useProfileMutations`, `useProfileSelection`.
- **Alliance admin list**: `useAllianceProfilesQuery` + `useAllianceProfileMutation`.
- **App admin list**: `useAdminQueries` + `useAdminAllianceProfileMutation`.
- **Bear Rally**: `useBearGroupQuery` + `useBearGroupMutations`.
- **Viking**: `useVikingMembersQuery` + `useVikingMembersMutations` + `useAssignments`.
- **Eligible members** (admin dropdowns):
  - Vikings: `useEligibleMembersQuery`
  - Bear: `useEligibleBearMembersQuery`

### UI Conventions
- Prefer `ui-*` classes and primitives under `client/src/components/ui`.
- Add a new `ui-*` class when a pattern appears in 2+ places.
- Localize all new text via `client/public/locales/*/translation.json` (single source of truth).

## Server Architecture

- Express app in `server/index.ts`.
- SQLite db with migrations in `server/db/migrations`.
- DB access is centralized in `server/db/queries.ts` and exposed via `ctx.queries` (avoid raw `db.prepare` in routes).
- Request payload validation lives in `server/validation.ts` using `zod/mini`.
- **Auth**: Discord OAuth + session cookie `ak_session`.
- **Health**: `GET /health` for Playwright `webServer` readiness.

### Server Routes
- `server/routes/auth.ts` — login/logout, `/api/me`.
- `server/routes/profile.ts` — profiles, alliances, player lookup.
- `server/routes/members.ts` — Viking roster + eligible list.
- `server/routes/bear.ts` — Bear roster + eligible list.
- `server/routes/assignments.ts` — run/reset/results.
- `server/routes/admin.ts` — app-admin cross-kingdom tooling.

## Playwright & Testing

### Playwright Projects
- **Flows**: `flows-desktop`, `flows-mobile` (light only).
- **Snapshots**: `snapshots-*` (desktop/mobile light/dark).

### Commands
- `npm run test:e2e` — UI flows only.
- `npm run test:visual` — snapshots only.
- `npm run test:playwright` — full Playwright suite.

Playwright uses per-worker fixtures in `playwright/fixtures.ts`:
- Each worker boots its own server/client on available ports.
- Each worker uses its own SQLite DB (`server/data/viking.playwright.worker-*.sqlite`).
- DB is reset before each test via `resetPlaywrightDb` in `playwright/utils.ts`.

Artifacts:
- Test artifacts are written to `test-results/`.
- Snapshot baselines are stored under `snapshots/playwright/`.

## Patterns to Follow

- Update `shared/types.ts` when API payloads change.
- Linting uses ESLint 9 with a custom Airbnb-like flat config (`eslint.config.js`); run `npm run lint` from the repo root.
- Favor TanStack Query for server state (avoid manual fetch + local state).
- In mutation flows that change list membership, use optimistic updates and invalidate the relevant query key.
- Keep admin/user flows in separate endpoints for auth clarity; share hooks/helpers to reduce duplication.

## Common Query Keys

- `profilesQueryKey`
- `allianceProfilesQueryKey`
- `adminAllianceProfilesQueryKey`
- `eligibleMembersQueryKey`
- `eligibleBearMembersQueryKey`
- `bearGroupQueryKey`
- `vikingMembersQueryKey`

## Where to Look First

- **Data changes**: `client/src/hooks/`, `server/routes/`, `shared/types.ts`
- **UI changes**: `client/src/`, `client/src/styles.css`, `client/src/components/ui`
- **Auth/session**: `server/routes/auth.ts`, `client/src/hooks/useSession.ts`

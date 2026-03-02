# TODO

Refactor plan (extensibility + standards):

Phase 1 — API + Client Data Layer
- [x] Standardize server responses (`{ ok, data }`, `{ ok: false, error }`).
- [x] Expand client API layer to domain modules (`api/session`, `api/members`, `api/bear`, `api/profile`).
- [x] Migrate client calls to new API modules.

Phase 2 — Server Modularization
- [x] Split routes into `server/routes/*`.
- [x] Move middleware into `server/middleware/*`.
- [x] Keep `server/index.ts` as wiring only.

Phase 3 — Schema + Migrations
- [x] Add migration runner + `schema_version`.
- [x] Move schema creation into versioned migrations.

Phase 4 — Client Hooks + View Models
- [x] Add hooks: `useMembers`, `useBear`, `useProfileDefaults`, `useAssignments`.
- [x] Slim UI components to consume hooks only.

Phase 5 — Tests
- [x] Add auth/alliance/role integration tests (temp SQLite).
- [x] Add smoke checks for login + alliance switch.

TypeScript migration plan (incremental):

Phase TS-1 — Client setup
- [x] Add TypeScript config for client (`tsconfig.json`) with `allowJs`.
- [x] Update Vite config for TS support and type checking.
- [x] Add basic types for API response shape.

Phase TS-2 — Client conversion (high value)
- [x] Convert `api/*` modules to `.ts`.
- [x] Convert hooks to `.ts` and type their return values.
- [x] Convert `App.jsx`, `VikingVengeance.jsx`, `BearRally.jsx`.

Phase TS-3 — Client cleanup
- [x] Enable stricter TS options (noImplicitAny, strictNullChecks).
- [x] Fix remaining implicit `any` and type gaps.

Phase TS-4 — Server setup (optional)
- [x] Add server `tsconfig.json`.
- [x] Convert `server/routes` and `server/repos` to TS.
- [x] Convert `server/index.ts` last.

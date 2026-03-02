# API Contract (Current)

This document captures the current API conventions so clients stay consistent as the app evolves.

## Alliance Scoping

- All alliance-scoped endpoints accept the header: `x-alliance-id: <allianceId>`.
- If the header is missing, the server uses the first membership for the authenticated user.
- If the alliance does not exist, the server returns `400 { "error": "Alliance not found." }`.

## Authentication

- Session cookie `ak_session` is required for all `/api/*` endpoints except auth routes.
- When unauthenticated, the server returns `401 { "error": "Authentication required." }`.

## Response Shape

- Success responses: `{ "ok": true, "data": ... }`
- Error responses: `{ "ok": false, "error": "<message>" }`
- Validation failures return `400`.
- Authorization failures return `403`.

## Common Endpoints (Current)

- `GET /api/me` → `{ ok: true, data: { user, memberships } }`
- `GET /api/members` → `{ ok: true, data: { members } }`
- `POST /api/signup` → `{ ok: true, data: { members } }`
- `POST /api/run` → `{ ok: true, data: assignmentPayload }`
- `GET /api/results` → `{ ok: true, data: { results } }`
- `POST /api/reset` → `{ ok: true, data: { ok: true } }`
- `GET /api/bear/:group` → `{ ok: true, data: { members } }`
- `POST /api/bear/:group` → `{ ok: true, data: { members } }`
- `DELETE /api/bear/:group` → `{ ok: true, data: { members } }`
- `DELETE /api/bear/:group/:playerId` → `{ ok: true, data: { members } }`

## Notes

- Some endpoints return nested data objects; keep this consistent when adding new routes.

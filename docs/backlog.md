# Backlog

## Bot + Discord

### DB-10: Observability + Rate Limits + Error Copy
**Problem**: Bot failures must be diagnosable and user-friendly.

**Scope / Requirements**
- Add structured logging for bot requests + responses.
- Rate limit bot endpoints to prevent spam.
- Normalize user-facing error copy (use design doc text).

**Success Criteria**
- Logs identify command, user, and outcome.
- Rate limits enforce sensible defaults.
- Errors are consistent and friendly.

**Required Verification**
- Server change: `npm run test:server`

**Implementation Prompt**
Add logging + rate limiting and align error copy with the design doc.

**Validation Prompt**
Verify logging output format and rate limit behavior.

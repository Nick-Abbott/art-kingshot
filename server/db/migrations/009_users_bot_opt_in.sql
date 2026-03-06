ALTER TABLE users ADD COLUMN botOptInAssignments INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS assignment_notifications (
  id TEXT PRIMARY KEY,
  allianceId TEXT NOT NULL,
  playerId TEXT NOT NULL,
  discordId TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS assignment_notifications_status_idx
  ON assignment_notifications(status, allianceId);

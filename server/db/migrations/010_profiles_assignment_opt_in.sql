ALTER TABLE profiles ADD COLUMN botOptInAssignments INTEGER NOT NULL DEFAULT 1;

UPDATE profiles
SET botOptInAssignments = COALESCE(
  (SELECT botOptInAssignments FROM users WHERE users.id = profiles.userId),
  1
);

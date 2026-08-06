-- One-time EVM wallet ownership challenges for employee payout verification.
ALTER TABLE employees ADD COLUMN payout_verified_at TEXT;

CREATE TABLE payout_verification_challenges (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  address TEXT NOT NULL,
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_payout_challenges_user
  ON payout_verification_challenges(user_id, created_at);

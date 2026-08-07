-- Recurring payroll schedules generate draft runs only. Payment approval and
-- execution remain explicit administrator actions.
ALTER TABLE payroll_runs ADD COLUMN schedule_id TEXT;
ALTER TABLE payroll_runs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS payroll_schedules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL,                       -- weekly | biweekly | monthly
  anchor_day INTEGER,                          -- preserves month-end schedules
  next_pay_date TEXT NOT NULL,
  last_generated_date TEXT NOT NULL,
  draft_lead_days INTEGER NOT NULL DEFAULT 5,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_payroll_schedules_org ON payroll_schedules(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_schedules_due ON payroll_schedules(active, next_pay_date);
CREATE INDEX IF NOT EXISTS idx_runs_schedule ON payroll_runs(schedule_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_schedule_date
  ON payroll_runs(schedule_id, pay_date)
  WHERE schedule_id IS NOT NULL;

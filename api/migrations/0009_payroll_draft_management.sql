-- Preserve payroll history while allowing administrators to remove drafts
-- from active views. Executed payment data remains immutable.
ALTER TABLE payroll_runs ADD COLUMN archived_at TEXT;
ALTER TABLE payroll_runs ADD COLUMN archived_by TEXT;

ALTER TABLE payroll_schedules ADD COLUMN archived_at TEXT;
ALTER TABLE payroll_schedules ADD COLUMN archived_by TEXT;

ALTER TABLE payrun_items ADD COLUMN removed_at TEXT;
ALTER TABLE payrun_items ADD COLUMN removed_by TEXT;

CREATE INDEX IF NOT EXISTS idx_runs_active_org
  ON payroll_runs(org_id, archived_at, pay_date);
CREATE INDEX IF NOT EXISTS idx_schedules_active_org
  ON payroll_schedules(org_id, archived_at, created_at);
CREATE INDEX IF NOT EXISTS idx_items_active_run
  ON payrun_items(run_id, removed_at, created_at);

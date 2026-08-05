-- Rebuild payrun_items: employee_id nullable (manual items may not link an employee row)
CREATE TABLE payrun_items_new (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  employee_id TEXT,
  employee_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  token TEXT NOT NULL DEFAULT 'USDC',
  network TEXT NOT NULL DEFAULT 'Base',
  status TEXT NOT NULL DEFAULT 'pending',
  intent_hash TEXT,
  deposit_address TEXT,
  signed_at TEXT,
  submitted_at TEXT,
  confirmed_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO payrun_items_new (id, run_id, employee_id, employee_name, amount, token, network, status, intent_hash, deposit_address, signed_at, submitted_at, confirmed_at, error, created_at)
  SELECT id, run_id, employee_id, employee_name, amount, token, network, status, intent_hash, deposit_address, signed_at, submitted_at, confirmed_at, error, created_at FROM payrun_items;
DROP TABLE payrun_items;
ALTER TABLE payrun_items_new RENAME TO payrun_items;
CREATE INDEX IF NOT EXISTS idx_items_run ON payrun_items(run_id);

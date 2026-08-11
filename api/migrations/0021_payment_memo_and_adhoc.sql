-- User-facing payment memo + ad-hoc Quick Pay (nullable employee_id).
-- Does not reuse provider deposit_memo fields.

CREATE TABLE employee_payments_new (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  employee_id TEXT,
  period_key TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'paid', 'failed', 'refunded'
  )),
  paid_at TEXT,
  memo TEXT,
  recipient_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO employee_payments_new (
  id, org_id, employee_id, period_key, amount_minor, token, network,
  status, paid_at, memo, recipient_name, created_at, updated_at
)
SELECT
  id, org_id, employee_id, period_key, amount_minor, token, network,
  status, paid_at, NULL, NULL, created_at, updated_at
FROM employee_payments;

DROP TABLE employee_payments;
ALTER TABLE employee_payments_new RENAME TO employee_payments;

CREATE INDEX idx_employee_payments_org_period
  ON employee_payments(org_id, period_key, status);

CREATE INDEX idx_employee_payments_employee
  ON employee_payments(employee_id, period_key);

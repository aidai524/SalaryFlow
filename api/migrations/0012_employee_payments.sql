-- Per-employee period payments (Quick Pay / Pay overview).
-- Attempts may attach to employee_payments instead of (or in addition to) payroll run items.
-- New ORIGIN_CHAIN deposit flow states: awaiting_deposit, deposit_submitted.

CREATE TABLE employee_payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'paid', 'failed', 'refunded'
  )),
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, employee_id, period_key)
);

CREATE INDEX idx_employee_payments_org_period
  ON employee_payments(org_id, period_key, status);

CREATE INDEX idx_employee_payments_employee
  ON employee_payments(employee_id, period_key);

-- Recreate payment_attempts with nullable run/item, employee_payment_id, deposit fields,
-- and expanded state machine for ORIGIN_CHAIN deposits.
CREATE TABLE payment_attempts_new (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  run_id TEXT,
  item_id TEXT,
  employee_payment_id TEXT,
  idempotency_key TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'near-intents-1click',
  state TEXT NOT NULL DEFAULT 'created' CHECK (state IN (
    'created', 'quoting', 'quoted',
    'generating', 'awaiting_signature', 'submitting', 'submitted',
    'awaiting_deposit', 'deposit_submitted',
    'processing', 'confirmed', 'failed', 'refunded'
  )),
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  recipient TEXT NOT NULL,
  signer_id TEXT NOT NULL,
  origin_asset_id TEXT,
  destination_asset_id TEXT,
  quote_request TEXT,
  quote_response TEXT,
  quote_hash TEXT,
  correlation_id TEXT,
  deposit_address TEXT,
  deposit_memo TEXT,
  deposit_tx_hash TEXT,
  quote_expires_at TEXT,
  intent_payload TEXT,
  intent_hash TEXT,
  provider_status TEXT,
  provider_response TEXT,
  last_error TEXT,
  reconcile_failures INTEGER NOT NULL DEFAULT 0,
  next_reconcile_at TEXT,
  last_reconciled_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  confirmed_at TEXT,
  failed_at TEXT,
  refunded_at TEXT,
  UNIQUE (org_id, idempotency_key)
);

INSERT INTO payment_attempts_new (
  id, org_id, run_id, item_id, employee_payment_id, idempotency_key, provider, state,
  token, network, amount_minor, recipient, signer_id,
  origin_asset_id, destination_asset_id,
  quote_request, quote_response, quote_hash, correlation_id,
  deposit_address, deposit_memo, deposit_tx_hash, quote_expires_at,
  intent_payload, intent_hash, provider_status, provider_response,
  last_error, reconcile_failures, next_reconcile_at, last_reconciled_at,
  created_by, created_at, updated_at, submitted_at, confirmed_at, failed_at, refunded_at
)
SELECT
  id, org_id, run_id, item_id, NULL, idempotency_key, provider, state,
  token, network, amount_minor, recipient, signer_id,
  NULL, NULL,
  quote_request, quote_response, quote_hash, correlation_id,
  deposit_address, deposit_memo, NULL, quote_expires_at,
  intent_payload, intent_hash, provider_status, provider_response,
  last_error, reconcile_failures, next_reconcile_at, last_reconciled_at,
  created_by, created_at, updated_at, submitted_at, confirmed_at, failed_at, refunded_at
FROM payment_attempts;

DROP TABLE payment_attempts;
ALTER TABLE payment_attempts_new RENAME TO payment_attempts;

CREATE INDEX idx_payment_attempts_run ON payment_attempts(run_id, created_at);
CREATE INDEX idx_payment_attempts_item ON payment_attempts(item_id, created_at);
CREATE INDEX idx_payment_attempts_employee_payment ON payment_attempts(employee_payment_id, created_at);
CREATE INDEX idx_payment_attempts_reconcile ON payment_attempts(state, next_reconcile_at);

CREATE UNIQUE INDEX idx_payment_attempts_active_item
  ON payment_attempts(item_id)
  WHERE item_id IS NOT NULL AND state IN (
    'created', 'quoting', 'quoted', 'generating', 'awaiting_signature',
    'submitting', 'submitted', 'awaiting_deposit', 'deposit_submitted', 'processing'
  );

CREATE UNIQUE INDEX idx_payment_attempts_active_employee_payment
  ON payment_attempts(employee_payment_id)
  WHERE employee_payment_id IS NOT NULL AND state IN (
    'created', 'quoting', 'quoted', 'generating', 'awaiting_signature',
    'submitting', 'submitted', 'awaiting_deposit', 'deposit_submitted', 'processing'
  );

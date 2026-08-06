-- Stateful, idempotent payment execution. The table is dormant while
-- PAYMENTS_MODE remains dry-run or disabled.

CREATE TABLE payment_wallet_challenges (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_payment_wallet_challenges_user
  ON payment_wallet_challenges(user_id, created_at);

-- Addresses bound by the earlier prototype did not require proof of ownership.
-- Keep the address for display, but require admins to verify again.
UPDATE users SET wallet_verified_at = NULL
  WHERE role = 'admin' AND wallet_address IS NOT NULL;

CREATE TABLE payment_attempts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'near-intents-1click',
  state TEXT NOT NULL DEFAULT 'created' CHECK (state IN (
    'created', 'quoting', 'quoted', 'generating', 'awaiting_signature',
    'submitting', 'submitted', 'processing', 'confirmed', 'failed', 'refunded'
  )),
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  recipient TEXT NOT NULL,
  signer_id TEXT NOT NULL,
  quote_request TEXT,
  quote_response TEXT,
  quote_hash TEXT,
  correlation_id TEXT,
  deposit_address TEXT,
  deposit_memo TEXT,
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

CREATE INDEX idx_payment_attempts_run ON payment_attempts(run_id, created_at);
CREATE INDEX idx_payment_attempts_item ON payment_attempts(item_id, created_at);
CREATE INDEX idx_payment_attempts_reconcile ON payment_attempts(state, next_reconcile_at);

CREATE UNIQUE INDEX idx_payment_attempts_active_item
  ON payment_attempts(item_id)
  WHERE state IN (
    'created', 'quoting', 'quoted', 'generating', 'awaiting_signature',
    'submitting', 'submitted', 'processing'
  );

ALTER TABLE chain_records ADD COLUMN attempt_id TEXT;
ALTER TABLE chain_records ADD COLUMN provider_status TEXT;

CREATE UNIQUE INDEX idx_chain_records_attempt
  ON chain_records(attempt_id)
  WHERE attempt_id IS NOT NULL;

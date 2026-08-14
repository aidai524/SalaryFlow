-- Batch payout: one origin-chain tx covering N independent 1Click deposits.

CREATE TABLE payment_batches (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  origin_asset_id TEXT NOT NULL,
  origin_network TEXT NOT NULL,
  origin_token TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  total_amount_in TEXT NOT NULL,
  item_count INTEGER NOT NULL CHECK (item_count > 0),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN (
    'processing', 'partial', 'completed', 'failed'
  )),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, batch_id)
);

CREATE INDEX idx_payment_batches_org_created ON payment_batches(org_id, created_at DESC);

CREATE TABLE payment_batch_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  employee_id TEXT,
  employee_payment_id TEXT,
  attempt_id TEXT,
  employee_name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  memo TEXT,
  deposit_address TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES payment_batches(id)
);

CREATE INDEX idx_payment_batch_items_batch ON payment_batch_items(batch_id);

ALTER TABLE payment_attempts ADD COLUMN batch_id TEXT;

CREATE INDEX idx_payment_attempts_batch ON payment_attempts(batch_id) WHERE batch_id IS NOT NULL;

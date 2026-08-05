-- SalaryFlow initial schema
-- SQLite (Cloudflare D1)

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',        -- admin | employee
  status TEXT NOT NULL DEFAULT 'active',        -- invited | active | disabled
  org_id TEXT,
  -- bound EVM wallet used for payment authorization / payout
  wallet_address TEXT,
  wallet_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  token TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | accepted | expired | revoked
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invites_org ON invitations(org_id);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,                                 -- linked user account (null until accepted)
  name TEXT NOT NULL,
  role_title TEXT,
  location TEXT,
  token TEXT NOT NULL DEFAULT 'USDC',           -- USDC | USDT
  network TEXT NOT NULL DEFAULT 'Base',         -- Base | Arbitrum | Solana | Polygon | ...
  amount INTEGER DEFAULT 0,                     -- current net amount (USD cents)
  endpoint TEXT,                                -- masked wallet display
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | ready | update_required
  last_paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(org_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  label TEXT NOT NULL,                          -- e.g. 'August 2026'
  pay_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',         -- draft | ready | paid | failed | partial
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_org ON payroll_runs(org_id);

CREATE TABLE IF NOT EXISTS payrun_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  amount INTEGER NOT NULL,                      -- net amount (USD cents)
  token TEXT NOT NULL DEFAULT 'USDC',
  network TEXT NOT NULL DEFAULT 'Base',
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | paid | failed | refunded
  intent_hash TEXT,
  deposit_address TEXT,
  signed_at TEXT,
  submitted_at TEXT,
  confirmed_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_run ON payrun_items(run_id);

CREATE TABLE IF NOT EXISTS chain_records (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  org_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  amount INTEGER NOT NULL,
  origin_chain TEXT,
  dest_chain TEXT,
  confidentiality TEXT NOT NULL DEFAULT 'advanced',
  intent_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | confirmed | failed | refunded
  quote_at TEXT,
  signed_at TEXT,
  submitted_at TEXT,
  confirmed_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_chain_org ON chain_records(org_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  actor_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  employee_id TEXT,
  signed_at TEXT NOT NULL DEFAULT (datetime('now')),
  payload TEXT                               -- signed consent reference
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consents_user ON consents(user_id);

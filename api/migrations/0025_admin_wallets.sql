-- Persist one admin payment wallet per chain (EVM / Near / Solana).

CREATE TABLE IF NOT EXISTS admin_wallets (
  user_id TEXT NOT NULL,
  chain_kind TEXT NOT NULL,
  address TEXT NOT NULL,
  verified_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, chain_kind),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO admin_wallets (user_id, chain_kind, address, verified_at, updated_at)
SELECT
  id,
  COALESCE(NULLIF(wallet_chain_kind, ''), 'evm'),
  wallet_address,
  wallet_verified_at,
  datetime('now')
FROM users
WHERE role = 'admin'
  AND wallet_address IS NOT NULL
  AND wallet_address != '';

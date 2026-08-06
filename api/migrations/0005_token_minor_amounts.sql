-- Store USDC/USDT amounts as integer minor units (6 decimals).
-- Existing prototype values were entered/displayed as whole token amounts.
ALTER TABLE employees RENAME COLUMN amount TO amount_minor;
UPDATE employees SET amount_minor = CAST(ROUND(amount_minor * 1000000) AS INTEGER);

ALTER TABLE payrun_items RENAME COLUMN amount TO amount_minor;
UPDATE payrun_items SET amount_minor = CAST(ROUND(amount_minor * 1000000) AS INTEGER);

ALTER TABLE chain_records RENAME COLUMN amount TO amount_minor;
UPDATE chain_records SET amount_minor = CAST(ROUND(amount_minor * 1000000) AS INTEGER);

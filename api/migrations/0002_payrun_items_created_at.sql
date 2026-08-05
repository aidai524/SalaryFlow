-- Add missing created_at on payrun_items
ALTER TABLE payrun_items ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));

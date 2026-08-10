-- Team payment preferences on organizations (phase 1: one org per admin).
-- Separate from payroll_runs / createRun — Create Team setup writes these fields only.
-- payment_cadence: monthly | weekly
-- payment_date_key: every_1st | every_15th | every_end_of_month | every_monday | … | every_sunday
-- reminder_lead_days: 7 (monthly) | 3 (weekly)

ALTER TABLE organizations ADD COLUMN payment_cadence TEXT;
ALTER TABLE organizations ADD COLUMN payment_date_key TEXT;
ALTER TABLE organizations ADD COLUMN reminder_lead_days INTEGER;
ALTER TABLE organizations ADD COLUMN payment_configured_at TEXT;

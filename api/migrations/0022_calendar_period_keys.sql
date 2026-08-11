-- Correct monthly period_key rows to the natural calendar month of the payment
-- (paid_at, else created_at). Weekly ISO keys (YYYY-Www) are left unchanged.
-- Previously, resolveCurrentPeriod rolled past payday into the next month's key.

UPDATE employee_payments
SET period_key = substr(COALESCE(paid_at, created_at), 1, 7)
WHERE period_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]';

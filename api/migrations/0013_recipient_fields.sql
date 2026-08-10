-- Recipients page: per-contractor pay cadence + invite job title.
-- Contractor payment_cadence: monthly | weekly | on_demand (enforced in app).
-- payment_date_key mirrors org keys when cadence is monthly/weekly; NULL for on_demand / employees.

ALTER TABLE employees ADD COLUMN payment_cadence TEXT;
ALTER TABLE employees ADD COLUMN payment_date_key TEXT;

ALTER TABLE invitations ADD COLUMN role_title TEXT;

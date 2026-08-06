-- Link employee directory profiles to invitations/accounts by stable email identity.
ALTER TABLE employees ADD COLUMN email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_org_email
  ON employees(org_id, email)
  WHERE email IS NOT NULL;

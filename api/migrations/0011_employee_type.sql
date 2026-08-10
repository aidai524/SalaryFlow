-- Recipient type: Employees (full-time) vs Contractors (temp/contract).
-- Allowed values enforced in application code: 'employee' | 'contractor'.
-- Contractor-specific pay cadence fields land in a later Recipients-page migration.
-- Phase-1 Pay overview stats only aggregate employee_type = 'employee'.

ALTER TABLE employees ADD COLUMN employee_type TEXT NOT NULL DEFAULT 'employee';

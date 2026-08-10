-- Invite dialog profile fields (name + recipient type) carried through accept.
ALTER TABLE invitations ADD COLUMN name TEXT;
ALTER TABLE invitations ADD COLUMN employee_type TEXT;

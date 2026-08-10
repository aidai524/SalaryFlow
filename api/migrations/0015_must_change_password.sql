-- Flag invite-created accounts that must set a real password after first login.
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;

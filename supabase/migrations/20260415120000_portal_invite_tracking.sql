-- Portal invite lifecycle: sent timestamp + password flag
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_invite_sent_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_password_set BOOLEAN NOT NULL DEFAULT false;

-- Optional security phrase shown in CRM (not a login password).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS verbal_password TEXT;

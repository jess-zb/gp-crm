-- Client profile "reviewed" marker (header toggle)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT;

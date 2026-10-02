-- One attorney can be marked default for auto-assignment (e.g. after POA upload)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_default_attorney BOOLEAN NOT NULL DEFAULT false;

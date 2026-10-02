-- Optional alternate first name for search / display
ALTER TABLE clients ADD COLUMN IF NOT EXISTS secondary_first_name TEXT;

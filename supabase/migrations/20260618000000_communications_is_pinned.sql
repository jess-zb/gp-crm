ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_communications_pinned
  ON communications (client_id, is_pinned)
  WHERE is_pinned = true;

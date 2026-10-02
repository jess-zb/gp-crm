-- Durable attorney display name for Attorney Queue "Recent assignments".
-- History previously only joined profiles via attorney_id; legacy portal
-- backfills (and any row missing attorney_id) showed a blank attorney column.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS attorney_portal_attorney_name TEXT;

COMMENT ON COLUMN clients.attorney_portal_attorney_name IS
  'Display name of the attorney at portal-assignment time (Attorney Queue history).';

-- Best-effort backfill from current attorney profile when attorney_id is set.
UPDATE clients c
SET attorney_portal_attorney_name = COALESCE(
  NULLIF(trim(p.full_name), ''),
  NULLIF(trim(p.email), ''),
  c.attorney_portal_attorney_name
)
FROM profiles p
WHERE p.id = c.attorney_id
  AND c.attorney_portal_assigned_at IS NOT NULL
  AND (
    c.attorney_portal_attorney_name IS NULL
    OR trim(c.attorney_portal_attorney_name) = ''
  );

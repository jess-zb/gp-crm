-- Restore Shape lead id on clients (external upload bot + webhook).
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS shape_lead_id TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_shape_lead_id
  ON clients (shape_lead_id);

-- Backfill from shape_contact_id where possible
UPDATE clients
SET shape_lead_id = shape_contact_id
WHERE shape_lead_id IS NULL
  AND shape_contact_id IS NOT NULL;

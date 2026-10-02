-- FedEx batch grouping: Pacific calendar day string (YYYY-MM-DD) when batch was sent
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS batch_id text;

CREATE INDEX IF NOT EXISTS idx_clients_batch_id
  ON clients (batch_id)
  WHERE batch_id IS NOT NULL;

-- Backfill from existing send timestamps (LA calendar day)
UPDATE clients
SET batch_id = to_char(
  (fedex_batch_sent_at AT TIME ZONE 'America/Los_Angeles')::date,
  'YYYY-MM-DD'
)
WHERE batch_id IS NULL
  AND fedex_batch_sent_at IS NOT NULL;

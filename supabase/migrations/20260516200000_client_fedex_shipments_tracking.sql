ALTER TABLE client_fedex_shipments
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_client_fedex_shipments_tracking
  ON client_fedex_shipments (tracking_number)
  WHERE tracking_number IS NOT NULL;

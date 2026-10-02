-- Shape CRM → zb-crm webhook: raw logs + sync columns

CREATE TABLE IF NOT EXISTS shape_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shape_webhook_logs_created_at ON shape_webhook_logs (created_at DESC);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS shape_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS active_client_status TEXT,
  ADD COLUMN IF NOT EXISTS customer_service_status TEXT,
  ADD COLUMN IF NOT EXISTS client_services_status TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS clients_shape_contact_id_key
  ON clients (shape_contact_id)
  WHERE shape_contact_id IS NOT NULL;

ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS shape_note_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS communications_shape_note_id_key
  ON communications (shape_note_id)
  WHERE shape_note_id IS NOT NULL;

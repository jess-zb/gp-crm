-- Proof of delivery (POD) fields on clients for account sidebar
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pod_delivered_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pod_signed_by TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pod_tracking TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pod_notes TEXT;

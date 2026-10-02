-- Appointments (reminders), documents re-tag, compliance assignee, DNC reason

-- ---------------------------------------------------------------------------
-- Reminders: appointment metadata
-- ---------------------------------------------------------------------------
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS appointment_type TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_type TEXT;

ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_pipeline_type_check;
ALTER TABLE reminders ADD CONSTRAINT reminders_pipeline_type_check
  CHECK (pipeline_type IS NULL OR pipeline_type IN ('sales', 'service'));

-- ---------------------------------------------------------------------------
-- Clients: DNC reason + compliance manager
-- ---------------------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS dnc_reason TEXT,
  ADD COLUMN IF NOT EXISTS assigned_compliance_id UUID REFERENCES profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_assigned_compliance
  ON clients (assigned_compliance_id);

-- ---------------------------------------------------------------------------
-- Document type: CC Authorization
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TYPE document_type ADD VALUE 'cc_authorization';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE documents
SET document_type = 'cc_authorization'
WHERE document_type::text = 'other';

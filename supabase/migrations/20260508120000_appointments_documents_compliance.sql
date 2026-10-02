-- Appointments (reminders), documents re-tag, DNC reason

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
-- Clients: DNC reason
-- ---------------------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS dnc_reason TEXT;

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

-- Client profile page: columns, RLS, storage, checklist trigger, enum value
-- Run in Supabase SQL Editor if migrations are not auto-applied.

-- ---------------------------------------------------------------------------
-- Clients: contact expansion, onboarding timestamps, resend, portal token
-- ---------------------------------------------------------------------------
ALTER TABLE clients ADD COLUMN IF NOT EXISTS spouse_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS spouse_nickname TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_mobile TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_work TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_home TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cc_charged_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fedex_queued_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS resend_method delivery_method;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS resend_requested_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_invite_token TEXT;

UPDATE clients
SET phone_mobile = COALESCE(phone_mobile, phone)
WHERE phone IS NOT NULL AND phone_mobile IS NULL;

-- ---------------------------------------------------------------------------
-- Cards: charge amount in cents
-- ---------------------------------------------------------------------------
ALTER TABLE client_cards ADD COLUMN IF NOT EXISTS charge_amount_cents INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Reminders: cancelled
-- ---------------------------------------------------------------------------
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS cancelled BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Document type: POA Document (keep legacy enum values in DB)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TYPE document_type ADD VALUE 'poa_document';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Audit log: team can read/insert for assigned clients
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Team can see audit for assigned clients" ON audit_log;
CREATE POLICY "Team can see audit for assigned clients"
  ON audit_log FOR SELECT
  USING (
    current_user_role() = 'team'
    AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "Team can insert audit for assigned clients" ON audit_log;
CREATE POLICY "Team can insert audit for assigned clients"
  ON audit_log FOR INSERT
  WITH CHECK (
    current_user_role() = 'team'
    AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Onboarding checklist: allow inserts for staff managing client
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can insert checklist rows" ON onboarding_checklist;
CREATE POLICY "Staff can insert checklist rows"
  ON onboarding_checklist FOR INSERT
  WITH CHECK (
    current_user_role() IN ('admin', 'management')
    OR (
      current_user_role() = 'team'
      AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Default checklist items for new clients
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_default_checklist()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO onboarding_checklist (client_id, item) VALUES
    (NEW.id, 'Charge CC Information'),
    (NEW.id, 'Send Welcome Packet + POA'),
    (NEW.id, 'Enable Client Portal Access'),
    (NEW.id, 'Signed POA Received'),
    (NEW.id, 'Collection Letter Received');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Storage (optional): if uploads fail with RLS, run in SQL Editor:
-- DROP POLICY IF EXISTS "Authenticated upload client documents" ON storage.objects;
-- CREATE POLICY "Authenticated upload client documents"
--   ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'client-documents');
-- (repeat for SELECT/UPDATE/DELETE as needed)
-- ---------------------------------------------------------------------------

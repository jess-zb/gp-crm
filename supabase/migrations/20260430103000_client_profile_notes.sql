-- Sidebar notes on client profile (separate from clients.client_notes single field).

CREATE TABLE IF NOT EXISTS client_profile_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_profile_notes_client_created
  ON client_profile_notes(client_id, created_at DESC);

ALTER TABLE client_profile_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership read client profile notes"
  ON client_profile_notes FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Leadership insert client profile notes"
  ON client_profile_notes FOR INSERT
  WITH CHECK (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    AND created_by = auth.uid()
  );

CREATE POLICY "Attorney read client profile notes"
  ON client_profile_notes FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
  );

CREATE POLICY "Attorney insert client profile notes"
  ON client_profile_notes FOR INSERT
  WITH CHECK (
    current_user_role() = 'attorney'
    AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
    AND created_by = auth.uid()
  );

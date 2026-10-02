-- Cancellation reasons when moving a client to Retention (ClientStageHeader)
CREATE TABLE IF NOT EXISTS cancellation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  notes TEXT,
  performed_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  performed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_logs_client_id ON cancellation_logs (client_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_logs_created_at ON cancellation_logs (created_at DESC);

ALTER TABLE cancellation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can insert cancellation logs for accessible clients"
  ON cancellation_logs FOR INSERT
  WITH CHECK (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR (
      current_user_role() IN ('sales', 'service')
      AND client_id IN (
        SELECT id
        FROM clients
        WHERE assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can read cancellation logs for accessible clients"
  ON cancellation_logs FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager', 'manager')
    OR (
      current_user_role() IN ('sales', 'service')
      AND client_id IN (
        SELECT id
        FROM clients
        WHERE assigned_to = auth.uid()
      )
    )
  );

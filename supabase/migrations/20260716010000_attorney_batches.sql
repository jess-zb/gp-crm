-- Attorney handoff batches: staff builds a queue batch, shares a tokenized
-- public download link (no login). Client case_referred email + attorney
-- in-app alerts fire when the batch is created/sent, not on collection-letter upload.

CREATE TABLE IF NOT EXISTS attorney_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT attorney_batches_access_token_hex
    CHECK (access_token ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attorney_batches_access_token
  ON attorney_batches (access_token);

CREATE INDEX IF NOT EXISTS idx_attorney_batches_sent_at
  ON attorney_batches (sent_at DESC);

CREATE TABLE IF NOT EXISTS attorney_batch_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES attorney_batches(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_attorney_batch_clients_client
  ON attorney_batch_clients (client_id);

CREATE TABLE IF NOT EXISTS attorney_batch_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES attorney_batches(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_attorney_batch_documents_batch
  ON attorney_batch_documents (batch_id);

CREATE INDEX IF NOT EXISTS idx_attorney_batch_documents_document
  ON attorney_batch_documents (document_id);

ALTER TABLE attorney_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE attorney_batch_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE attorney_batch_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM staff manage attorney_batches"
  ON attorney_batches
  FOR ALL
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'))
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "CRM staff manage attorney_batch_clients"
  ON attorney_batch_clients
  FOR ALL
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'))
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "CRM staff manage attorney_batch_documents"
  ON attorney_batch_documents
  FOR ALL
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'))
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON attorney_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON attorney_batch_clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON attorney_batch_documents TO authenticated;

-- Public tokenized download page uses the service role (no login).
GRANT SELECT ON attorney_batches TO service_role;
GRANT SELECT ON attorney_batch_clients TO service_role;
GRANT SELECT ON attorney_batch_documents TO service_role;

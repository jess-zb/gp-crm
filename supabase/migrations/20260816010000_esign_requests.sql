-- Native eSign request rows. Writes are Dev-only until rollout
-- (lib/esign/config.ts ESIGN_STAFF_ROLES). Public /sign APIs use the
-- service role and bypass RLS. Attorneys and portal clients cannot access.

CREATE TABLE esign_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('cc_authorization', 'welcome_packet')),
  opensign_document_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'sent',
      'viewed',
      'signed',
      'completed',
      'declined',
      'revoked',
      'failed',
      'superseded'
    )
  ),
  signer_email TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  signed_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  certificate_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opensign_document_id)
);

CREATE INDEX esign_requests_client_kind_sent_idx
  ON esign_requests (client_id, kind, sent_at DESC);

CREATE TRIGGER esign_requests_updated_at
  BEFORE UPDATE ON esign_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE esign_requests ENABLE ROW LEVEL SECURITY;

-- Writes match ESIGN_STAFF_ROLES (dev-only until rollout). Service role
-- (public /sign APIs) bypasses RLS.
CREATE POLICY "Staff manage esign_requests"
  ON esign_requests FOR ALL
  TO authenticated
  USING (current_user_role() = 'dev')
  WITH CHECK (current_user_role() = 'dev');

GRANT SELECT, INSERT, UPDATE ON esign_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON esign_requests TO service_role;

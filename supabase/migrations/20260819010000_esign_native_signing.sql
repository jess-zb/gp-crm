-- CRM-native eSign (F-006). OpenSign document id is optional.
-- Tokenized public sign links + OTP + audit events for a completion certificate.

ALTER TABLE esign_requests
  ALTER COLUMN opensign_document_id DROP NOT NULL;

ALTER TABLE esign_requests
  ADD COLUMN IF NOT EXISTS sign_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_ip TEXT,
  ADD COLUMN IF NOT EXISTS signed_ip TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS intent_accepted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS esign_requests_sign_token_uidx
  ON esign_requests (sign_token)
  WHERE sign_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS esign_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES esign_requests(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS esign_events_request_idx
  ON esign_events (request_id, created_at);

ALTER TABLE esign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read esign_events"
  ON esign_events FOR SELECT
  TO authenticated
  USING (current_user_role() = 'dev');

GRANT SELECT ON esign_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON esign_events TO service_role;

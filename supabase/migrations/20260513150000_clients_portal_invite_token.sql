ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_invite_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_portal_invite_token
  ON clients (portal_invite_token)
  WHERE portal_invite_token IS NOT NULL;

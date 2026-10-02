-- Ensure clients.unsubscribed_at exists.
-- The original ADD was in 20260429072600_email_sequences.sql but that migration
-- was never recorded/applied on this database. Dispatch and holiday autoresponder
-- select this column; when missing, PostgREST fails the client fetch and the
-- dispatcher treated null client as inactive — mass-cancelling due enrollments.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

COMMENT ON COLUMN clients.unsubscribed_at IS
  'Set when the client unsubscribes (portal link or Resend complaint/bounce). Dispatch skips/cancels when non-null.';

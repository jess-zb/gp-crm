-- Attorney portal assignment: staff bulk-assigns queue clients to an attorney;
-- client case_referred email + attorney portal notification fire on assignment.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS attorney_portal_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attorney_portal_assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_attorney_portal_assigned_at
  ON clients (attorney_portal_assigned_at DESC NULLS LAST)
  WHERE attorney_portal_assigned_at IS NOT NULL;

COMMENT ON COLUMN clients.attorney_portal_assigned_at IS
  'When staff released this case to the assigned attorney via Attorney Queue.';
COMMENT ON COLUMN clients.attorney_portal_assigned_by IS
  'CRM user who bulk-assigned this client to the attorney portal.';

-- Clients already released via the legacy public batch link should not re-enter the queue.
UPDATE clients c
SET
  attorney_portal_assigned_at = COALESCE(c.attorney_portal_assigned_at, b.sent_at),
  attorney_portal_assigned_by = COALESCE(c.attorney_portal_assigned_by, b.created_by)
FROM attorney_batch_clients bc
JOIN attorney_batches b ON b.id = bc.batch_id
WHERE bc.client_id = c.id
  AND b.revoked_at IS NULL
  AND c.attorney_portal_assigned_at IS NULL;

-- Fix communications UPDATE access for modern CRM roles.
-- Live DB still had stale "Admin and management see all comms" (admin + management only),
-- so acct_manager / dev could SELECT + INSERT but not UPDATE — pin toggles silently no-oped.

DROP POLICY IF EXISTS "Admin and management see all comms" ON communications;
DROP POLICY IF EXISTS "Leadership see all comms" ON communications;

CREATE POLICY "Leadership see all comms"
  ON communications FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'))
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

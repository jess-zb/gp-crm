DROP POLICY IF EXISTS "Staff can update portal messages for their clients" ON portal_messages;

CREATE POLICY "Staff can update portal messages for their clients"
  ON portal_messages FOR UPDATE
  USING (
    current_user_role() IN ('admin', 'management')
    OR (
      current_user_role() = 'team'
      AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
    )
    OR (
      current_user_role() = 'attorney'
      AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
    )
  )
  WITH CHECK (
    current_user_role() IN ('admin', 'management')
    OR (
      current_user_role() = 'team'
      AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
    )
    OR (
      current_user_role() = 'attorney'
      AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
    )
  );

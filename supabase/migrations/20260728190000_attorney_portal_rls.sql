-- Gate attorney RLS on portal assignment (attorney_portal_assigned_at).
-- Prevents attorneys from reading client rows/docs before staff bulk-assigns via the queue.

DROP POLICY IF EXISTS "Attorney sees assigned cases" ON clients;
CREATE POLICY "Attorney sees assigned cases"
  ON clients FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND attorney_id = auth.uid()
    AND attorney_portal_assigned_at IS NOT NULL
    AND stage IN ('case_sent_to_attorneys', 'closed')
  );

DROP POLICY IF EXISTS "Attorney can update assigned case stages" ON clients;
CREATE POLICY "Attorney can update assigned case stages"
  ON clients FOR UPDATE
  USING (
    current_user_role() = 'attorney'
    AND attorney_id = auth.uid()
    AND attorney_portal_assigned_at IS NOT NULL
    AND stage IN ('case_sent_to_attorneys', 'closed')
  )
  WITH CHECK (
    current_user_role() = 'attorney'
    AND attorney_id = auth.uid()
    AND attorney_portal_assigned_at IS NOT NULL
    AND stage IN ('case_sent_to_attorneys', 'closed')
  );

DROP POLICY IF EXISTS "Attorney sees documents for their cases" ON documents;
CREATE POLICY "Attorney sees documents for their cases"
  ON documents FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (
      SELECT id FROM clients
      WHERE attorney_id = auth.uid()
        AND attorney_portal_assigned_at IS NOT NULL
        AND stage IN ('case_sent_to_attorneys', 'closed')
    )
  );

DROP POLICY IF EXISTS "Attorney sees comms for their cases" ON communications;
CREATE POLICY "Attorney sees comms for their cases"
  ON communications FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (
      SELECT id FROM clients
      WHERE attorney_id = auth.uid()
        AND attorney_portal_assigned_at IS NOT NULL
        AND stage IN ('case_sent_to_attorneys', 'closed')
    )
  );

DROP POLICY IF EXISTS "Attorney can insert audit for their cases" ON audit_log;
CREATE POLICY "Attorney can insert audit for their cases"
  ON audit_log FOR INSERT
  WITH CHECK (
    current_user_role() = 'attorney'
    AND client_id IN (
      SELECT id FROM clients
      WHERE attorney_id = auth.uid()
        AND attorney_portal_assigned_at IS NOT NULL
        AND stage IN ('case_sent_to_attorneys', 'closed')
    )
  );

DROP POLICY IF EXISTS "Attorney sees audit for their cases" ON audit_log;
CREATE POLICY "Attorney sees audit for their cases"
  ON audit_log FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (
      SELECT id FROM clients
      WHERE attorney_id = auth.uid()
        AND attorney_portal_assigned_at IS NOT NULL
        AND stage IN ('case_sent_to_attorneys', 'closed')
    )
  );

DROP POLICY IF EXISTS "Staff see portal messages for clients" ON portal_messages;
CREATE POLICY "Staff see portal messages for clients"
  ON portal_messages FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR (
      current_user_role() = 'attorney'
      AND client_id IN (
        SELECT id FROM clients
        WHERE attorney_id = auth.uid()
          AND attorney_portal_assigned_at IS NOT NULL
          AND stage IN ('case_sent_to_attorneys', 'closed')
      )
    )
    OR client_id = current_client_id()
  );

DROP POLICY IF EXISTS "Can send portal messages" ON portal_messages;
CREATE POLICY "Can send portal messages"
  ON portal_messages FOR INSERT
  WITH CHECK (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR (
      current_user_role() = 'attorney'
      AND client_id IN (
        SELECT id FROM clients
        WHERE attorney_id = auth.uid()
          AND attorney_portal_assigned_at IS NOT NULL
          AND stage IN ('case_sent_to_attorneys', 'closed')
      )
    )
    OR client_id = current_client_id()
  );

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
      AND client_id IN (
        SELECT id FROM clients
        WHERE attorney_id = auth.uid()
          AND attorney_portal_assigned_at IS NOT NULL
          AND stage IN ('case_sent_to_attorneys', 'closed')
      )
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
      AND client_id IN (
        SELECT id FROM clients
        WHERE attorney_id = auth.uid()
          AND attorney_portal_assigned_at IS NOT NULL
          AND stage IN ('case_sent_to_attorneys', 'closed')
      )
    )
  );

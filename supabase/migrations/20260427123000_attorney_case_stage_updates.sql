-- Allow assigned attorneys to change stage (close / revert) and log it
CREATE POLICY "Attorney can update assigned case stages"
  ON clients FOR UPDATE
  USING (
    current_user_role() = 'attorney'
    AND attorney_id = auth.uid()
    AND stage IN ('case_sent_to_attorneys', 'closed')
  )
  WITH CHECK (
    current_user_role() = 'attorney'
    AND attorney_id = auth.uid()
    AND stage IN ('case_sent_to_attorneys', 'closed')
  );

CREATE POLICY "Attorney can insert audit for their cases"
  ON audit_log FOR INSERT
  WITH CHECK (
    current_user_role() = 'attorney'
    AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
  );

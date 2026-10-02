-- Allow attorneys to read audit_log rows for clients assigned to them (case timeline)
CREATE POLICY "Attorney sees audit for their cases"
  ON audit_log FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
  );

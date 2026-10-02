-- Grant acct_manager SELECT on sequence_enrollments and email_logs (scoped to assigned clients).
-- Without these policies, the Drips tab returned empty results for acct_manager role.

DROP POLICY IF EXISTS "Acct manager view sequence_enrollments" ON sequence_enrollments;
CREATE POLICY "Acct manager view sequence_enrollments"
  ON sequence_enrollments FOR SELECT
  USING (
    current_user_role() = 'acct_manager'
    AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "Acct manager view email_logs" ON email_logs;
CREATE POLICY "Acct manager view email_logs"
  ON email_logs FOR SELECT
  USING (
    current_user_role() = 'acct_manager'
    AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
  );

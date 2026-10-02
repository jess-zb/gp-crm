-- Appointments edit permissions:
-- dev + admin can UPDATE/DELETE any reminder.
-- acct_manager can only UPDATE/DELETE reminders assigned to themselves.
-- SELECT stays wide open for dev/admin/acct_manager (no change to visibility).

-- Drop the current catch-all FOR ALL policy
DROP POLICY IF EXISTS "Staff see and manage reminders" ON reminders;

-- SELECT: dev/admin/acct_manager see all; others see only their own assigned
CREATE POLICY "Staff can view reminders"
  ON reminders FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR assigned_to = auth.uid()
  );

-- INSERT: unchanged (separate policy already exists; this covers any gaps)
CREATE POLICY "Staff can insert reminders"
  ON reminders FOR INSERT
  WITH CHECK (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR assigned_to = auth.uid()
  );

-- UPDATE: dev/admin → all rows; acct_manager → own rows only
CREATE POLICY "Staff can update reminders"
  ON reminders FOR UPDATE
  USING (
    current_user_role() IN ('dev', 'admin')
    OR (current_user_role() = 'acct_manager' AND assigned_to = auth.uid())
  )
  WITH CHECK (
    current_user_role() IN ('dev', 'admin')
    OR (current_user_role() = 'acct_manager' AND assigned_to = auth.uid())
  );

-- DELETE: dev/admin → all rows; acct_manager → own rows only
CREATE POLICY "Staff can delete reminders"
  ON reminders FOR DELETE
  USING (
    current_user_role() IN ('dev', 'admin')
    OR (current_user_role() = 'acct_manager' AND assigned_to = auth.uid())
  );

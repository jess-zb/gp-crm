-- Allow any authenticated staff role to create appointments (reminders).
-- Existing row-level policies still govern SELECT/UPDATE/DELETE.

CREATE POLICY "Authenticated users can insert reminders"
  ON reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

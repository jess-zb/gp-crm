-- Restrict eSign send to Dev role plus named pilot staff (not every admin).

DROP POLICY IF EXISTS "Staff manage esign_requests" ON esign_requests;
CREATE POLICY "Staff manage esign_requests"
  ON esign_requests FOR ALL
  TO authenticated
  USING (
    current_user_role() = 'dev'
    OR lower(trim((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))) IN (
      'cs@debtsupportpros.com',
      'jessica@debtsupportpros.com',
      'daniel@stellari.io',
      'dev@debtsupportpros.com'
    )
  )
  WITH CHECK (
    current_user_role() = 'dev'
    OR lower(trim((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))) IN (
      'cs@debtsupportpros.com',
      'jessica@debtsupportpros.com',
      'daniel@stellari.io',
      'dev@debtsupportpros.com'
    )
  );

DROP POLICY IF EXISTS "Staff read esign_events" ON esign_events;
CREATE POLICY "Staff read esign_events"
  ON esign_events FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'dev'
    OR lower(trim((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))) IN (
      'cs@debtsupportpros.com',
      'jessica@debtsupportpros.com',
      'daniel@stellari.io',
      'dev@debtsupportpros.com'
    )
  );

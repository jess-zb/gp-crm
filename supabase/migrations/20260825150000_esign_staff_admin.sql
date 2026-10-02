-- Admin can send CC Auth / Welcome Packet from client Packets.
-- Place-fields layout tables stay Dev-only.

DROP POLICY IF EXISTS "Staff manage esign_requests" ON esign_requests;
CREATE POLICY "Staff manage esign_requests"
  ON esign_requests FOR ALL
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin'))
  WITH CHECK (current_user_role() IN ('dev', 'admin'));

DROP POLICY IF EXISTS "Staff read esign_events" ON esign_events;
CREATE POLICY "Staff read esign_events"
  ON esign_events FOR SELECT
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin'));

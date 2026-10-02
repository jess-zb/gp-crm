-- Arlington Coaching eSign templates, plus Amanda and Asim on the pilot send list.
-- Daniel (daniel@stellari.io) is already on the list.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('esign_requests'::regclass, 'esign_layouts'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

ALTER TABLE esign_requests
  ADD CONSTRAINT esign_requests_kind_check
  CHECK (kind IN (
    'cc_authorization',
    'welcome_packet',
    'ac_cc_authorization',
    'ac_welcome_packet'
  ));

ALTER TABLE esign_layouts
  ADD CONSTRAINT esign_layouts_kind_check
  CHECK (kind IN (
    'cc_authorization',
    'welcome_packet',
    'ac_cc_authorization',
    'ac_welcome_packet'
  ));

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
      'amanda@stellari.io',
      'asim@voxtrongroup.com',
      'dev@debtsupportpros.com'
    )
  )
  WITH CHECK (
    current_user_role() = 'dev'
    OR lower(trim((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))) IN (
      'cs@debtsupportpros.com',
      'jessica@debtsupportpros.com',
      'daniel@stellari.io',
      'amanda@stellari.io',
      'asim@voxtrongroup.com',
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
      'amanda@stellari.io',
      'asim@voxtrongroup.com',
      'dev@debtsupportpros.com'
    )
  );

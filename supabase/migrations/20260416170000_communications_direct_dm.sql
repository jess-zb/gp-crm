-- Direct messages use subject format direct:uuid|uuid (sorted pair), same as team: threads.
CREATE POLICY "Staff can read internal hub communications direct"
  ON communications FOR SELECT
  USING (
    client_id IS NULL
    AND type = 'note'
    AND direction = 'internal'
    AND subject LIKE 'direct:%'
    AND current_user_role() IN ('admin', 'management', 'team', 'attorney')
    AND (
      split_part(split_part(subject, ':', 2), '|', 1) = auth.uid()::text
      OR split_part(split_part(subject, ':', 2), '|', 2) = auth.uid()::text
    )
  );

CREATE POLICY "Staff can insert internal hub communications direct"
  ON communications FOR INSERT
  WITH CHECK (
    client_id IS NULL
    AND type = 'note'
    AND direction = 'internal'
    AND recorded_by = auth.uid()
    AND subject LIKE 'direct:%'
    AND current_user_role() IN ('admin', 'management', 'team', 'attorney')
    AND (
      split_part(split_part(subject, ':', 2), '|', 1) = auth.uid()::text
      OR split_part(split_part(subject, ':', 2), '|', 2) = auth.uid()::text
    )
  );

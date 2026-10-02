-- Direct message channels between two staff profiles.

ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS participant_1 UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS participant_2 UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_chat_dm_participants
  ON chat_channels(participant_1, participant_2)
  WHERE type = 'direct';

GRANT ALL ON chat_channels TO service_role;
GRANT SELECT, INSERT ON chat_channels TO authenticated;

-- Restrict direct channels to participants only (replace open direct read).
DROP POLICY IF EXISTS "chat_channels_select_accessible" ON chat_channels;
CREATE POLICY "chat_channels_select_accessible"
  ON chat_channels FOR SELECT
  TO authenticated
  USING (
    type = 'announcement'
    OR (
      type = 'direct'
      AND (
        participant_1 = auth.uid()
        OR participant_2 = auth.uid()
      )
    )
    OR (
      type = 'department'
      AND (
        department IS NULL
        OR (
          department = 'compliance'
          AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND COALESCE(p.is_compliance, false)
          )
        )
        OR (
          department = 'accounts'
          AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND COALESCE(p.is_accounts, false)
          )
        )
        OR (
          department = 'services'
          AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND COALESCE(p.is_services, false)
          )
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role IN ('dev', 'admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "chat_channels_insert_dm" ON chat_channels;
CREATE POLICY "chat_channels_insert_dm"
  ON chat_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'direct'
    AND participant_1 = auth.uid()
    AND participant_2 IS NOT NULL
    AND participant_2 <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = participant_2 AND p.role <> 'client'
    )
  );

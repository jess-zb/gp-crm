-- CRM floating chat: channels, messages, read receipts + Realtime (chat_messages).
-- After apply: confirm `chat_messages` is in publication `supabase_realtime` (Dashboard → Replication).

CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chat_channels_type_chk CHECK (type IN ('department', 'direct', 'announcement'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS chat_read_receipts (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx
  ON chat_messages (channel_id, created_at DESC);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- Channels: visible when announcement, General (department null), user's dept, or dev/admin.
DROP POLICY IF EXISTS "Auth users read channels" ON chat_channels;
CREATE POLICY "chat_channels_select_accessible"
  ON chat_channels FOR SELECT
  TO authenticated
  USING (
    type = 'announcement'
    OR type = 'direct'
    OR (
      type = 'department'
      AND (
        department IS NULL
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

DROP POLICY IF EXISTS "Auth users read messages" ON chat_messages;
CREATE POLICY "chat_messages_select_accessible"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = chat_messages.channel_id
      AND (
        c.type = 'announcement'
        OR c.type = 'direct'
        OR (
          c.type = 'department'
          AND (
            c.department IS NULL
            OR (
              c.department = 'accounts'
              AND EXISTS (
                SELECT 1 FROM profiles p
                WHERE p.id = auth.uid() AND COALESCE(p.is_accounts, false)
              )
            )
            OR (
              c.department = 'services'
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
      )
    )
  );

DROP POLICY IF EXISTS "Auth users send messages" ON chat_messages;
CREATE POLICY "chat_messages_insert_own_sender"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = channel_id
      AND (
        (
          c.type = 'announcement'
          AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('dev', 'admin')
          )
        )
        OR (
          c.type <> 'announcement'
          AND (
            c.type = 'direct'
            OR (
              c.type = 'department'
              AND (
                c.department IS NULL
                OR (
                  c.department = 'accounts'
                  AND EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND COALESCE(p.is_accounts, false)
                  )
                )
                OR (
                  c.department = 'services'
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
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Own read receipts" ON chat_read_receipts;
CREATE POLICY "chat_read_receipts_select_own"
  ON chat_read_receipts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "chat_read_receipts_insert_own"
  ON chat_read_receipts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_read_receipts_update_own"
  ON chat_read_receipts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_read_receipts_delete_own"
  ON chat_read_receipts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Seed default channels (idempotent by name)
INSERT INTO chat_channels (name, type, department)
SELECT 'Announcements', 'announcement', NULL
WHERE NOT EXISTS (SELECT 1 FROM chat_channels WHERE name = 'Announcements');

INSERT INTO chat_channels (name, type, department)
SELECT 'Account Managers', 'department', 'accounts'
WHERE NOT EXISTS (SELECT 1 FROM chat_channels WHERE name = 'Account Managers');

INSERT INTO chat_channels (name, type, department)
SELECT 'Services', 'department', 'services'
WHERE NOT EXISTS (SELECT 1 FROM chat_channels WHERE name = 'Services');

INSERT INTO chat_channels (name, type, department)
SELECT 'General', 'department', NULL
WHERE NOT EXISTS (SELECT 1 FROM chat_channels WHERE name = 'General');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;

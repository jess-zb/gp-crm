-- Scope chat reads/writes to channel membership.
--
-- The policies live in the database differed from what earlier migrations
-- declared: chat_messages allowed SELECT to any authenticated user, and
-- chat_channels had a blanket "authenticated read" policy that OR'd with (and
-- therefore defeated) the participant check added in 20260516230000. Every
-- staff user could read every direct message and post into any channel.

-- ---------------------------------------------------------------------------
-- Data repair
-- ---------------------------------------------------------------------------

-- "General" was created as a direct channel with no participants, so the
-- membership rules below would hide it from everyone.
UPDATE chat_channels
SET type = 'department', department = NULL
WHERE name = 'General' AND type = 'direct'
  AND participant_1 IS NULL AND participant_2 IS NULL;

-- Collapse duplicate DM channels for the same pair, keeping the one that holds
-- the conversation.
WITH ranked AS (
  SELECT c.id,
         ROW_NUMBER() OVER (
           PARTITION BY LEAST(c.participant_1, c.participant_2),
                        GREATEST(c.participant_1, c.participant_2)
           ORDER BY (SELECT COUNT(*) FROM chat_messages m WHERE m.channel_id = c.id) DESC,
                    c.created_at ASC
         ) AS rn
  FROM chat_channels c
  WHERE c.type = 'direct'
    AND c.participant_1 IS NOT NULL
    AND c.participant_2 IS NOT NULL
)
DELETE FROM chat_channels
WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  AND NOT EXISTS (SELECT 1 FROM chat_messages m WHERE m.channel_id = chat_channels.id);

-- One DM per pair regardless of who opened it first.
CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_direct_pair_uniq
  ON chat_channels (
    LEAST(participant_1, participant_2),
    GREATEST(participant_1, participant_2)
  )
  WHERE type = 'direct' AND participant_1 IS NOT NULL AND participant_2 IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_channels_participant_1_idx
  ON chat_channels (participant_1) WHERE type = 'direct';
CREATE INDEX IF NOT EXISTS chat_channels_participant_2_idx
  ON chat_channels (participant_2) WHERE type = 'direct';

-- ---------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so the policies below can read chat_channels/profiles
-- without recursing through the very policies they back.
CREATE OR REPLACE FUNCTION public.can_access_chat_channel(p_channel_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_channels c
    JOIN profiles me ON me.id = auth.uid()
    WHERE c.id = p_channel_id
      AND me.role <> 'client'
      AND (
        c.type = 'announcement'
        OR (
          c.type = 'direct'
          AND (me.id = c.participant_1 OR me.id = c.participant_2)
        )
        OR (
          c.type = 'department'
          AND (
            me.role IN ('dev', 'admin')
            OR c.department IS NULL
            OR (c.department = 'compliance' AND COALESCE(me.is_compliance, false))
            OR (c.department = 'accounts' AND COALESCE(me.is_accounts, false))
            OR (c.department = 'services' AND COALESCE(me.is_services, false))
          )
        )
      )
  );
$$;

-- Announcements are read-only for everyone except dev/admin.
CREATE OR REPLACE FUNCTION public.can_post_chat_channel(p_channel_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT can_access_chat_channel(p_channel_id)
     AND (
       NOT EXISTS (
         SELECT 1 FROM chat_channels c
         WHERE c.id = p_channel_id AND c.type = 'announcement'
       )
       OR EXISTS (
         SELECT 1 FROM profiles p
         WHERE p.id = auth.uid() AND p.role IN ('dev', 'admin')
       )
     );
$$;

REVOKE ALL ON FUNCTION public.can_access_chat_channel(UUID) FROM public;
REVOKE ALL ON FUNCTION public.can_post_chat_channel(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.can_access_chat_channel(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_post_chat_channel(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- chat_channels policies
-- ---------------------------------------------------------------------------

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;

-- Permissive policies OR together, so every prior SELECT policy has to go or
-- the broadest one wins.
DROP POLICY IF EXISTS "Authenticated read channels" ON chat_channels;
DROP POLICY IF EXISTS "Users read own DM channels" ON chat_channels;
DROP POLICY IF EXISTS "Auth users read channels" ON chat_channels;
DROP POLICY IF EXISTS "chat_channels_select_accessible" ON chat_channels;

CREATE POLICY "chat_channels_select_member"
  ON chat_channels FOR SELECT
  TO authenticated
  USING (can_access_chat_channel(id));

DROP POLICY IF EXISTS "Users create DM channels" ON chat_channels;
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
      WHERE p.id = auth.uid() AND p.role <> 'client'
    )
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = participant_2 AND p.role <> 'client'
    )
  );

-- ---------------------------------------------------------------------------
-- chat_messages policies
-- ---------------------------------------------------------------------------

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read messages" ON chat_messages;
DROP POLICY IF EXISTS "Auth users read messages" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_select_accessible" ON chat_messages;

CREATE POLICY "chat_messages_select_member"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (can_access_chat_channel(channel_id));

DROP POLICY IF EXISTS "Authenticated send messages" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert_own_sender" ON chat_messages;

CREATE POLICY "chat_messages_insert_member"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND can_post_chat_channel(channel_id)
  );

DROP POLICY IF EXISTS "chat_messages_update_own" ON chat_messages;
CREATE POLICY "chat_messages_update_own"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid() AND can_access_chat_channel(channel_id))
  WITH CHECK (sender_id = auth.uid() AND can_access_chat_channel(channel_id));

DROP POLICY IF EXISTS "chat_messages_delete_own" ON chat_messages;
CREATE POLICY "chat_messages_delete_own"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid() AND can_access_chat_channel(channel_id));

-- ---------------------------------------------------------------------------
-- chat_read_receipts: drop the redundant catch-all ALL policy
-- ---------------------------------------------------------------------------

ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own receipts" ON chat_read_receipts;

DROP POLICY IF EXISTS "chat_read_receipts_select_own" ON chat_read_receipts;
CREATE POLICY "chat_read_receipts_select_own"
  ON chat_read_receipts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_read_receipts_insert_own" ON chat_read_receipts;
CREATE POLICY "chat_read_receipts_insert_own"
  ON chat_read_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_read_receipts_update_own" ON chat_read_receipts;
CREATE POLICY "chat_read_receipts_update_own"
  ON chat_read_receipts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_read_receipts_delete_own" ON chat_read_receipts;
CREATE POLICY "chat_read_receipts_delete_own"
  ON chat_read_receipts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

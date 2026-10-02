-- Team announcements (notification panel + realtime)

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS announcements_created_at_idx
  ON announcements (created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE announcements TO authenticated;

CREATE POLICY "CRM staff read announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (
    current_user_role() IN (
      'dev',
      'admin',
      'acct_manager',
      'attorney',
      'manager',
      'sales',
      'service'
    )
  );

CREATE POLICY "Dev and admin insert announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (current_user_role() IN ('dev', 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE announcements;

-- Optional (run in SQL Editor when pg_cron + pg_net are enabled):
-- SELECT cron.schedule(
--   'appointment-reminders',
--   '*/15 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://zb-crm.vercel.app/api/notifications/appointments',
--     headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );

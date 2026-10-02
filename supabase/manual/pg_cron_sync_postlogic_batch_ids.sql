-- Run once in Supabase SQL Editor after enabling pg_cron + pg_net (if not already).
-- Replace the URL host with your deployed app URL if different from production.

SELECT cron.unschedule('sync-postlogic-batch-ids');

SELECT cron.schedule(
  'sync-postlogic-batch-ids',
  '30 */3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zb-crm.vercel.app/api/postlogic/sync-batch-ids',
    headers := '{"Content-Type": "application/json", 
      "x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

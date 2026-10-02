-- Estimate batch/delivery timestamps for imported tracking rows where dates reflect import time.
-- Run manually in SQL Editor if needed; safe to re-run (narrow WHERE).

UPDATE clients
SET
  fedex_queued_at = created_at,
  pod_delivered_at = created_at + INTERVAL '5 days'
WHERE fedex_tracking_number IS NOT NULL
  AND fedex_tracking_number != ''
  AND (
    fedex_queued_at > '2026-05-03'::timestamptz
    OR fedex_queued_at IS NULL
  );

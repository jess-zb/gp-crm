-- Fake "Appointment scheduled:" communications notes belong in the activity
-- log, not Notes. Copy them to audit_log, then delete the note rows.

INSERT INTO audit_log (
  client_id,
  action,
  new_value,
  performed_by,
  performed_by_name,
  created_at
)
SELECT
  c.client_id,
  'appointment_created',
  jsonb_build_object(
    'description',
    regexp_replace(
      regexp_replace(c.body, '^Appointment scheduled: ', ''),
      ' on .+ by .+$',
      ''
    ),
    'source',
    'note_backfill'
  ),
  c.recorded_by,
  COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Staff'),
  COALESCE(c.sent_at, c.created_at, NOW())
FROM communications c
LEFT JOIN profiles p ON p.id = c.recorded_by
WHERE c.type = 'note'
  AND c.body LIKE 'Appointment scheduled:%';

DELETE FROM communications
WHERE type = 'note'
  AND body LIKE 'Appointment scheduled:%';

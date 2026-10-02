-- next_send_at: when the next sequence email is due (cron uses status + next_send_at)

ALTER TABLE sequence_enrollments
  ADD COLUMN IF NOT EXISTS next_send_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_active_next_send
  ON sequence_enrollments (next_send_at)
  WHERE status = 'active';

-- Active enrollments: due time for the next unsent step (last_step_sent + 1)
UPDATE sequence_enrollments e
SET next_send_at = e.enrolled_at + make_interval(days => COALESCE((
  SELECT s.day_offset::int
  FROM email_sequence_steps s
  WHERE s.sequence_id = e.sequence_id
    AND s.step_order = COALESCE(e.last_step_sent, 0) + 1
  LIMIT 1
), 0))
WHERE e.status = 'active';

-- Status-trigger enrollments: set first-step due time on insert
CREATE OR REPLACE FUNCTION handle_client_status_change() RETURNS trigger AS $$
DECLARE
  seq email_sequences%ROWTYPE;
  cancel_key text;
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.status IS DISTINCT FROM OLD.status) THEN

    IF TG_OP = 'UPDATE' THEN
      NEW.status_changed_at := now();
    END IF;

    FOR seq IN
      SELECT * FROM email_sequences
      WHERE trigger_status = NEW.status
        AND trigger_type = 'status'
        AND is_active = true
    LOOP
      FOREACH cancel_key IN ARRAY seq.cancels_keys LOOP
        UPDATE sequence_enrollments e
          SET status = 'cancelled', cancelled_at = now(),
              cancel_reason = 'superseded by ' || seq.key,
              next_send_at = NULL
          FROM email_sequences s
          WHERE e.sequence_id = s.id
            AND s.key = cancel_key
            AND e.client_id = NEW.id
            AND e.status = 'active';
      END LOOP;

      INSERT INTO sequence_enrollments (client_id, sequence_id, next_send_at)
      SELECT NEW.id, seq.id,
        now() + make_interval(days => COALESCE((
          SELECT s.day_offset::int
          FROM email_sequence_steps s
          WHERE s.sequence_id = seq.id
          ORDER BY s.step_order ASC
          LIMIT 1
        ), 0))
      WHERE NOT EXISTS (
        SELECT 1 FROM sequence_enrollments
        WHERE client_id = NEW.id AND sequence_id = seq.id AND status = 'active'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

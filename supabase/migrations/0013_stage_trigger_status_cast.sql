-- email_sequences.trigger_status is text. clients.stage is case_stage.
-- Comparing them without a cast aborts every client insert.

CREATE OR REPLACE FUNCTION public.handle_client_stage_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  seq   email_sequences%ROWTYPE;
  ckey  text;
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.stage IS DISTINCT FROM OLD.stage) THEN

    FOR seq IN
      SELECT * FROM email_sequences
      WHERE trigger_status = NEW.stage::text
        AND trigger_type = 'status'
        AND is_active = true
    LOOP
      FOREACH ckey IN ARRAY seq.cancels_keys LOOP
        UPDATE sequence_enrollments e
          SET status = 'cancelled', cancelled_at = now(),
              cancel_reason = 'superseded by ' || seq.key,
              next_send_at = NULL
          FROM email_sequences s2
          WHERE e.sequence_id = s2.id::text
            AND s2.key = ckey
            AND e.client_id = NEW.id
            AND e.status = 'active';

        UPDATE sequence_enrollments e
          SET status = 'cancelled', cancelled_at = now(),
              cancel_reason = 'superseded by ' || seq.key,
              next_send_at = NULL
          WHERE e.sequence_key = ckey
            AND e.client_id = NEW.id
            AND e.status = 'active';
      END LOOP;

      INSERT INTO sequence_enrollments (client_id, sequence_id, sequence_key, next_send_at)
      SELECT NEW.id, seq.id, seq.key,
        now() + make_interval(days => COALESCE((
          SELECT st.day_offset::int
          FROM email_sequence_steps st
          WHERE st.sequence_id = seq.id
          ORDER BY st.step_order ASC
          LIMIT 1
        ), 0))
      WHERE NOT EXISTS (
        SELECT 1 FROM sequence_enrollments
        WHERE client_id = NEW.id
          AND (sequence_id = seq.id::text OR sequence_key = seq.key)
          AND status = 'active'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Defense in depth against the 2026-06-18 incident (62 inactive/DNC clients emailed).
-- Whenever a client transitions to is_active=false, cancel every active email enrollment
-- immediately. The dispatcher already skips inactive clients on send, but this trigger
-- clears the queue up-front so it can't leak through a future code regression.

CREATE OR REPLACE FUNCTION cancel_enrollments_on_client_inactive()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active = false AND (OLD.is_active IS DISTINCT FROM false) THEN
    UPDATE sequence_enrollments
       SET status = 'cancelled',
           cancelled_at = now(),
           next_send_at = NULL,
           cancel_reason = 'client_inactive'
     WHERE client_id = NEW.id
       AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_enrollments_on_client_inactive ON clients;
CREATE TRIGGER trg_cancel_enrollments_on_client_inactive
  AFTER UPDATE OF is_active ON clients
  FOR EACH ROW
  EXECUTE FUNCTION cancel_enrollments_on_client_inactive();

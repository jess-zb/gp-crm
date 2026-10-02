-- Delivery no longer advances welcome_packet → client_services (handled at AM→CS FedEx modal).

CREATE OR REPLACE FUNCTION handle_fedex_delivered()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.postlogic_status IS NOT NULL
     AND lower(trim(NEW.postlogic_status)) LIKE '%delivered%'
     AND (
       OLD.postlogic_status IS NULL
       OR lower(trim(OLD.postlogic_status)) NOT LIKE '%delivered%'
     )
  THEN
    UPDATE onboarding_checklist
    SET completed = true,
        completed_at = NOW()
    WHERE client_id = NEW.id
      AND item ILIKE '%welcome packet%'
      AND completed = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

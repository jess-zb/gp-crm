-- When PostLogic marks a shipment Delivered, advance welcome_packet → client_services,
-- complete "Send Welcome Packet + POA" checklist rows, and audit (backup for non–poll-status paths).

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
     AND OLD.stage = 'welcome_packet'
  THEN
    -- App (`poll-status`) usually advances stage in the same UPDATE; only patch if still stuck.
    IF NEW.stage = 'welcome_packet' THEN
      UPDATE clients
      SET stage = 'client_services',
          stage_entered_at = NOW()
      WHERE id = NEW.id;
    END IF;

    UPDATE onboarding_checklist
    SET completed = true,
        completed_at = NOW()
    WHERE client_id = NEW.id
      AND item ILIKE '%welcome packet%'
      AND completed = false;

    -- Audit for FedEx delivery is recorded by `lib/postlogic/poll-status.ts` when the app polls.
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_fedex_delivered ON clients;

CREATE TRIGGER on_fedex_delivered
  AFTER UPDATE OF postlogic_status ON clients
  FOR EACH ROW
  EXECUTE FUNCTION handle_fedex_delivered();

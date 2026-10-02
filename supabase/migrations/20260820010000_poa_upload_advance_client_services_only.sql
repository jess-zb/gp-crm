-- POA upload must not jump Account Manager (welcome_packet) to Awaiting
-- Collection Letter. That gate is Client Services only (Jul 2026 policy).
-- The old trigger used stage = welcome_packet, which pulled eSign Welcome
-- Packet clients off Packets Needed / AM as soon as the signed POA landed.

CREATE OR REPLACE FUNCTION public.handle_poa_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  advanced int;
BEGIN
  IF NEW.document_type::text NOT IN ('poa_document', 'poa_signed') THEN
    RETURN NEW;
  END IF;

  UPDATE clients
  SET
    stage = 'awaiting_collection_letter',
    stage_entered_at = NOW()
  WHERE id = NEW.client_id
    AND stage = 'client_services';

  GET DIAGNOSTICS advanced = ROW_COUNT;

  IF advanced > 0 THEN
    UPDATE onboarding_checklist
    SET
      completed = true,
      completed_at = NOW()
    WHERE client_id = NEW.client_id
      AND item ILIKE '%poa%'
      AND completed = false;

    INSERT INTO audit_log (client_id, action, new_value, performed_by_name)
    VALUES (
      NEW.client_id,
      'stage_auto_advanced',
      jsonb_build_object(
        'stage', 'awaiting_collection_letter',
        'trigger', 'poa_upload',
        'document_id', NEW.id
      ),
      'System'
    );
  END IF;

  RETURN NEW;
END;
$$;

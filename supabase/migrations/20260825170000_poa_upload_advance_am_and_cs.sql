-- Safety: POA on Uploads (manual or Welcome Packet eSign) must jump both
-- Account Manager (welcome_packet) and Client Services to Awaiting Collection
-- Letter so AM clients are not stuck after the file lands.

CREATE OR REPLACE FUNCTION public.handle_poa_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  advanced int;
  from_stage text;
BEGIN
  IF NEW.document_type::text NOT IN ('poa_document', 'poa_signed') THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO from_stage
  FROM clients
  WHERE id = NEW.client_id;

  UPDATE clients
  SET
    stage = 'awaiting_collection_letter',
    stage_entered_at = NOW()
  WHERE id = NEW.client_id
    AND stage IN ('welcome_packet', 'client_services');

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
        'from_stage', from_stage,
        'document_id', NEW.id
      ),
      'System'
    );
  END IF;

  RETURN NEW;
END;
$$;

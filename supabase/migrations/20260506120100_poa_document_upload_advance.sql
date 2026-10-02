-- After INSERT on documents: POA upload advances welcome_packet → awaiting_collection_letter,
-- completes Signed POA checklist row, and audits (backup for non-API upload paths).

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
    AND stage = 'welcome_packet';

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

DROP TRIGGER IF EXISTS on_poa_upload ON documents;

CREATE TRIGGER on_poa_upload
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION handle_poa_upload();

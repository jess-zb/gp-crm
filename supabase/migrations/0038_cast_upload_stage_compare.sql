-- clients.stage is case_stage. Comparing it to a text variable
-- (stage = from_stage) raises "operator does not exist: case_stage = text"
-- and rolls back the document insert. Credit card forms and Welcome Packets
-- then never save.

CREATE OR REPLACE FUNCTION public.handle_poa_upload() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  advanced int;
  from_stage public.case_stage;
  next_stage public.case_stage;
BEGIN
  IF NEW.document_type::text NOT IN (
    'poa_document',
    'poa_signed',
    'poa',
    'power_of_attorney'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO from_stage
  FROM clients
  WHERE id = NEW.client_id;

  IF from_stage = 'client_services' THEN
    next_stage := 'awaiting_collection_letter';
  ELSIF from_stage IN ('lead', 'account_manager') AND EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.client_id = NEW.client_id
      AND d.archived_at IS NULL
      AND d.document_type::text = 'cc_authorization'
  ) THEN
    next_stage := 'awaiting_collection_letter';
  ELSIF from_stage = 'lead' THEN
    next_stage := 'account_manager';
  ELSE
    RETURN NEW;
  END IF;

  UPDATE clients
  SET
    stage = next_stage,
    stage_entered_at = NOW()
  WHERE id = NEW.client_id
    AND stage = from_stage;

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
        'stage', next_stage,
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

CREATE OR REPLACE FUNCTION public.handle_cc_auth_upload() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  advanced int;
  from_stage public.case_stage;
  next_stage public.case_stage;
BEGIN
  IF NEW.document_type::text <> 'cc_authorization' THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO from_stage
  FROM clients
  WHERE id = NEW.client_id;

  IF from_stage NOT IN ('lead', 'account_manager') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.client_id = NEW.client_id
      AND d.archived_at IS NULL
      AND d.document_type::text IN (
        'poa_document',
        'poa_signed',
        'poa',
        'power_of_attorney'
      )
  ) THEN
    next_stage := 'awaiting_collection_letter';
  ELSE
    next_stage := 'client_services';
  END IF;

  UPDATE clients
  SET
    stage = next_stage,
    stage_entered_at = NOW()
  WHERE id = NEW.client_id
    AND stage = from_stage;

  GET DIAGNOSTICS advanced = ROW_COUNT;

  IF advanced > 0 THEN
    INSERT INTO audit_log (client_id, action, new_value, performed_by_name)
    VALUES (
      NEW.client_id,
      'stage_auto_advanced',
      jsonb_build_object(
        'stage', next_stage,
        'trigger', 'cc_authorization_upload',
        'from_stage', from_stage,
        'document_id', NEW.id
      ),
      'System'
    );
  END IF;

  RETURN NEW;
END;
$$;

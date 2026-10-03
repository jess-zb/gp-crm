-- Account Manager stage key, checklist labels, and support phone.
-- E-sign behavior welcome_packet is a different value and is not renamed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'case_stage'
      AND e.enumlabel = 'welcome_packet'
  ) THEN
    ALTER TYPE public.case_stage RENAME VALUE 'welcome_packet' TO 'account_manager';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_default_checklist() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO onboarding_checklist (client_id, item) VALUES
    (NEW.id, 'Charge CC Information'),
    (NEW.id, 'Welcome Packet signed'),
    (NEW.id, 'Signed POA Received'),
    (NEW.id, 'Collection Letter Received');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_poa_upload() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    AND stage IN ('account_manager', 'client_services');

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

UPDATE public.reminder_templates
SET stage = 'account_manager'
WHERE stage = 'welcome_packet';

UPDATE public.email_sequences
SET trigger_status = 'account_manager'
WHERE trigger_status = 'welcome_packet';

UPDATE public.onboarding_checklist
SET item = 'Welcome Packet signed'
WHERE item IN (
  'Send Welcome Packet + POA',
  'Send Welcome Packet',
  'Send Account Manager',
  'Send to Account Manager'
);

UPDATE public.onboarding_checklist
SET item = 'Welcome Packet on file'
WHERE item = 'Packet Update'
   OR (item_key = 'packet_update' AND item IS DISTINCT FROM 'Welcome Packet on file');

UPDATE public.email_message_templates
SET
  default_body = replace(default_body, '(888) 807-4221', '928-433-8408'),
  body_override = CASE
    WHEN body_override IS NULL THEN NULL
    ELSE replace(body_override, '(888) 807-4221', '928-433-8408')
  END
WHERE default_body LIKE '%(888) 807-4221%'
   OR COALESCE(body_override, '') LIKE '%(888) 807-4221%';

UPDATE public.email_message_templates
SET
  default_body = replace(default_body, 'Golden Pathway Financial', 'Golden Pathway'),
  body_override = CASE
    WHEN body_override IS NULL THEN NULL
    ELSE replace(body_override, 'Golden Pathway Financial', 'Golden Pathway')
  END
WHERE default_body LIKE '%Golden Pathway Financial%'
   OR COALESCE(body_override, '') LIKE '%Golden Pathway Financial%';

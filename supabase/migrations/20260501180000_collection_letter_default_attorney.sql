-- When a collection letter document is uploaded, also assign default attorney if none set.
CREATE OR REPLACE FUNCTION handle_collection_letter_upload()
RETURNS TRIGGER AS $$
DECLARE
  default_attorney_id UUID;
BEGIN
  IF NEW.is_collection_letter = true THEN
    UPDATE clients
    SET
      stage = 'case_sent_to_attorneys',
      collection_letter_received_at = NOW(),
      case_sent_to_attorney_at = NOW(),
      stage_entered_at = NOW()
    WHERE id = NEW.client_id
      AND stage NOT IN ('case_sent_to_attorneys', 'closed');

    UPDATE onboarding_checklist
    SET completed = true, completed_at = NOW()
    WHERE client_id = NEW.client_id
      AND item ILIKE '%collection letter%'
      AND completed = false;

    SELECT id INTO default_attorney_id
    FROM profiles
    WHERE role = 'attorney'
      AND is_default_attorney = true
      AND is_active = true
    LIMIT 1;

    IF default_attorney_id IS NOT NULL THEN
      UPDATE clients
      SET attorney_id = default_attorney_id
      WHERE id = NEW.client_id
        AND attorney_id IS NULL;
    END IF;

    INSERT INTO audit_log (client_id, action, new_value, performed_by_name)
    VALUES (
      NEW.client_id,
      'stage_auto_advanced',
      jsonb_build_object(
        'stage', 'case_sent_to_attorneys',
        'trigger', 'collection_letter_upload',
        'document_id', NEW.id
      ),
      'System'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

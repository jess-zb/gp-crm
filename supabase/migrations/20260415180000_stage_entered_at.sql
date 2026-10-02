-- Track when the client entered their current stage (for pipeline "days in stage")
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ;

UPDATE clients
SET stage_entered_at = COALESCE(updated_at, created_at)
WHERE stage_entered_at IS NULL;

ALTER TABLE clients ALTER COLUMN stage_entered_at SET DEFAULT NOW();
ALTER TABLE clients ALTER COLUMN stage_entered_at SET NOT NULL;

-- Collection letter auto-advance should reset stage clock
CREATE OR REPLACE FUNCTION handle_collection_letter_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_collection_letter = true THEN
    UPDATE clients
    SET
      stage = 'case_sent_to_attorneys',
      collection_letter_received_at = NOW(),
      case_sent_to_attorney_at = NOW(),
      stage_entered_at = NOW()
    WHERE id = NEW.client_id
      AND stage = 'awaiting_collection_letter';

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

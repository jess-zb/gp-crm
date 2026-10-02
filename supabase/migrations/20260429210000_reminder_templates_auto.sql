-- Stage-based reminder templates and auto-generated reminders

CREATE TABLE IF NOT EXISTS reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL,
  description TEXT NOT NULL,
  hours_after_stage_entry INTEGER NOT NULL CHECK (hours_after_stage_entry >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_templates_stage_active
  ON reminder_templates (stage)
  WHERE is_active = true;

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS from_template_id UUID REFERENCES reminder_templates (id) ON DELETE SET NULL;

ALTER TABLE reminder_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read reminder_templates"
  ON reminder_templates FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
  );

CREATE POLICY "Dev admin manage reminder_templates"
  ON reminder_templates FOR ALL
  USING (current_user_role() IN ('dev', 'admin'))
  WITH CHECK (current_user_role() IN ('dev', 'admin'));

-- Insert reminders from active templates for a client stage (used by collection-letter trigger).
CREATE OR REPLACE FUNCTION insert_auto_reminders_from_templates(
  p_client_id UUID,
  p_stage TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned UUID;
BEGIN
  SELECT assigned_to INTO v_assigned FROM clients WHERE id = p_client_id;

  INSERT INTO reminders (
    client_id,
    assigned_to,
    description,
    due_date,
    completed,
    created_by,
    auto_generated,
    from_template_id
  )
  SELECT
    p_client_id,
    v_assigned,
    t.description,
    NOW() + make_interval(hours => t.hours_after_stage_entry),
    false,
    NULL,
    true,
    t.id
  FROM reminder_templates t
  WHERE t.stage = p_stage
    AND t.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION handle_collection_letter_upload()
RETURNS TRIGGER AS $$
DECLARE
  v_updated INTEGER;
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

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated > 0 THEN
      PERFORM insert_auto_reminders_from_templates(NEW.client_id, 'case_sent_to_attorneys');
    END IF;

    UPDATE onboarding_checklist
    SET completed = true, completed_at = NOW()
    WHERE client_id = NEW.client_id
      AND item ILIKE '%collection letter%'
      AND completed = false;

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

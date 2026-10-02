-- Attorney queue: collection letter auto-advance, staff email queue for attorney assignment.

-- Collection letter upload → Case Sent to Attorneys (Attorney Queue eligibility).
CREATE OR REPLACE FUNCTION handle_collection_letter_upload()
RETURNS TRIGGER AS $$
DECLARE
  default_attorney_id UUID;
  is_collection_doc BOOLEAN;
BEGIN
  is_collection_doc :=
    COALESCE(NEW.is_collection_letter, false) = true
    OR NEW.document_type::text = 'collection_letter';

  IF is_collection_doc THEN
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

-- Staff / attorney transactional emails (processed by dispatch-emails cron).
CREATE TABLE IF NOT EXISTS staff_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  to_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error TEXT,
  resend_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_email_queue_pending
  ON staff_email_queue (scheduled_at ASC)
  WHERE status = 'pending';

ALTER TABLE staff_email_queue ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON staff_email_queue TO service_role;

CREATE POLICY "Service role manages staff_email_queue"
  ON staff_email_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Editable copy for Settings → Templates when that table exists (optional).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'email_message_templates'
  ) THEN
    INSERT INTO email_message_templates (
      template_key,
      name,
      sequence_key,
      step_order,
      day_offset,
      default_subject,
      default_body,
      required_variables,
      category,
      is_active
    ) VALUES (
      'attorney_portal_assignment',
      'Attorney Portal — New Case Assigned',
      NULL,
      NULL,
      NULL,
      'New Case Assigned — DebtSupportPros Attorney Portal',
      E'Hi {attorney.firstName},\n\nA new case has been assigned to you in the DebtSupportPros attorney portal.\n\nSign in with your attorney CRM credentials to review client contact info, signed POA, and collection letters.',
      ARRAY['attorney.firstName', 'casesUrl', 'clients'],
      'staff',
      true
    )
    ON CONFLICT (template_key) DO NOTHING;
  END IF;
END $$;

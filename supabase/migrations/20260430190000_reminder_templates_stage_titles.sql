-- Short titles for pipeline-stage reminder templates; auto-reminders prefer title for description.

ALTER TABLE reminder_templates
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

DELETE FROM reminder_templates;

INSERT INTO reminder_templates
  (stage, title, description, hours_after_stage_entry, is_active)
VALUES
  ('lead', 'Lead Call', 'Initial lead follow up call', 0, true),
  ('lead', '24hr Call', '24 hour follow up call', 24, true),
  ('lead', '48hr Call', '48 hour follow up call', 48, true),

  ('compliance_verification', 'Auth Recording', 'Call auth recording', 2, true),
  ('compliance_verification', 'Cards Charged', 'Verify all cards charged', 4, true),
  ('compliance_verification', '24hr Call', '24 hour follow up', 24, true),
  ('compliance_verification', '48hr Call', '48 hour follow up', 48, true),

  ('client_services', 'Welcome Call', 'Welcome call to client', 2, true),
  ('client_services', '24hr Call', '24 hour follow up', 24, true),

  ('retention', 'Retention Call', 'Retention follow up call', 2, true),
  ('retention', '24hr Call', '24 hour retention follow up', 24, true),
  ('retention', '48hr Call', '48 hour retention follow up', 48, true),

  ('welcome_packet', 'Packet Sent', 'Confirm welcome packet sent', 2, true),
  ('welcome_packet', '7 Day Call', 'Follow up on packet delivery', 168, true),

  ('awaiting_collection_letter', 'Waiting Call', 'Check on collection letters', 48, true),
  ('awaiting_collection_letter', '7 Day Call', 'Week follow up on letters', 168, true),
  ('awaiting_collection_letter', '30 Day Call', '30 day follow up', 720, true),

  ('case_sent_to_attorneys', 'Case Sent Call', 'Notify client case sent', 4, true),
  ('case_sent_to_attorneys', '30 Day Check', '30 day attorney check in', 720, true),

  ('dnc', 'DNC Confirmed', 'Confirm DNC status with client', 24, true),

  ('closed', 'Closed Call', 'Final closed case call', 4, true);

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
    COALESCE(NULLIF(BTRIM(t.title), ''), t.description),
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

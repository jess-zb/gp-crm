-- ============================================================
-- Email sequences + client status (RLS-enabled)
-- ============================================================

-- === ENUM ===
DO $$
BEGIN
  CREATE TYPE client_status AS ENUM (
    'lead',
    'compliance_verification',
    'active',
    'case_referred',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- === ALTER clients ===
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS status client_status NOT NULL DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

-- === TABLES ===

CREATE TABLE IF NOT EXISTS email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  trigger_status client_status,
  trigger_type text NOT NULL,
  cancels_keys text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  day_offset int NOT NULL,
  template_key text NOT NULL,
  subject text NOT NULL,
  UNIQUE(sequence_id, step_order)
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  sequence_id uuid REFERENCES email_sequences(id),
  status text CHECK (status IN ('active','paused','completed','cancelled')) DEFAULT 'active',
  enrolled_at timestamptz DEFAULT now(),
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  last_step_sent int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_id uuid REFERENCES email_sequence_steps(id),
  client_id uuid REFERENCES clients(id),
  template_key text,
  resend_message_id text UNIQUE,
  status text CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','complained','failed')),
  error text,
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz
);

CREATE TABLE IF NOT EXISTS client_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  triggered_email_log_id uuid REFERENCES email_logs(id),
  created_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- === INDEXES ===

CREATE INDEX IF NOT EXISTS idx_clients_status_changed
  ON clients(status, status_changed_at);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_client_id
  ON sequence_enrollments(client_id);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status_enrolled_at
  ON sequence_enrollments(status, enrolled_at);

CREATE INDEX IF NOT EXISTS idx_email_logs_enrollment_id_sent_at_desc
  ON email_logs(enrollment_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_resend_message_id
  ON email_logs(resend_message_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_client_id_sent_at_desc
  ON email_logs(client_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_template_key_sent_at_desc
  ON email_logs(template_key, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_reminders_due_at_open
  ON client_reminders(due_at)
  WHERE completed_at IS NULL AND triggered_email_log_id IS NULL;

-- === RLS ===

ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reminders ENABLE ROW LEVEL SECURITY;

-- Admins: full access (existing admin role check)
CREATE POLICY "Admin manage email_sequences"
  ON email_sequences FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Admin manage email_sequence_steps"
  ON email_sequence_steps FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Admin manage sequence_enrollments"
  ON sequence_enrollments FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Admin manage email_logs"
  ON email_logs FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Admin manage client_reminders"
  ON client_reminders FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

-- Attorneys: SELECT only, scoped via client.attorney_id = auth.uid()
CREATE POLICY "Attorney can view email_sequences for their clients"
  ON email_sequences FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND EXISTS (
      SELECT 1
      FROM sequence_enrollments e
      JOIN clients c ON c.id = e.client_id
      WHERE e.sequence_id = email_sequences.id
        AND c.attorney_id = auth.uid()
    )
  );

CREATE POLICY "Attorney can view email_sequence_steps for their clients"
  ON email_sequence_steps FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND EXISTS (
      SELECT 1
      FROM sequence_enrollments e
      JOIN clients c ON c.id = e.client_id
      WHERE e.sequence_id = email_sequence_steps.sequence_id
        AND c.attorney_id = auth.uid()
    )
  );

CREATE POLICY "Attorney can view sequence_enrollments for their clients"
  ON sequence_enrollments FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
  );

CREATE POLICY "Attorney can view email_logs for their clients"
  ON email_logs FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
  );

CREATE POLICY "Attorney can view client_reminders for their clients"
  ON client_reminders FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
  );

-- === SEED — sequences ===
INSERT INTO email_sequences (key, name, trigger_status, trigger_type, cancels_keys) VALUES
  ('welcome_lead',    'Welcome – Lead',                'lead',          'status',   '{}'::text[]),
  ('welcome_cs',      'Welcome – Client Services',     'active',        'status',   '{welcome_lead,follow_up_24hr}'::text[]),
  ('active_arc',      'Active 1–7',                    'active',        'status',   '{partial_arc,welcome_lead,follow_up_24hr}'::text[]),
  ('partial_arc',     'Partial 1–4',                   NULL,            'duration', '{welcome_lead,follow_up_24hr}'::text[]),
  ('case_referred',   'Case Referred to Attorneys',    'case_referred', 'status',   '{active_arc,partial_arc}'::text[]),
  ('follow_up_24hr',  'Follow Up – 24hr',              NULL,            'reminder', '{}'::text[]),
  ('holiday',         'Holiday Auto-Responder',        NULL,            'date',     '{}'::text[])
ON CONFLICT (key) DO NOTHING;

-- === SEED — steps ===
INSERT INTO email_sequence_steps (sequence_id, step_order, day_offset, template_key, subject)
SELECT s.id, v.step_order, v.day_offset, v.template_key, v.subject
FROM email_sequences s
JOIN (VALUES
  ('welcome_lead',   1,  0,  'welcome_lead',    'Welcome to Zero Balance!'),
  ('welcome_cs',     1,  0,  'welcome_cs',      'Welcome to Your Next Step with Zero Balance!'),
  ('active_arc',     1,  0,  'active_1',        'Welcome—Here''s What Happens Next'),
  ('active_arc',     2, 14,  'active_2',        'Quick Check-In—We''re Here for You'),
  ('active_arc',     3, 21,  'active_3',        'Why You MUST Forward Creditor Mail'),
  ('active_arc',     4, 30,  'active_4',        'One Month In—You''re Doing Great!'),
  ('active_arc',     5, 45,  'active_5',        'How to Stay Confident During Your Program'),
  ('active_arc',     6, 60,  'active_6',        'Halfway Through—Keeping You on Track'),
  ('active_arc',     7, 90,  'active_7',        '90 Days Strong—Thank You for Trusting Zero Balance'),
  ('partial_arc',    1,  0,  'partial_1',       'Let''s Complete Your Enrollment Today'),
  ('partial_arc',    2,  3,  'partial_2',       'Your Enrollment Is Still Pending'),
  ('partial_arc',    3,  7,  'partial_3',       'Urgent: Last Step to Activate Your Program'),
  ('partial_arc',    4, 10,  'partial_4',       'Last Chance to Confirm Your Enrollment'),
  ('case_referred',  1,  0,  'case_referred',   'Congrats! Your File Is Now with Our Attorney Network'),
  ('follow_up_24hr', 1,  0,  'follow_up_24hr',  'We Missed You – Let''s Reschedule Your Appointment'),
  ('holiday',        1,  0,  'holiday',         'We''re currently closed for the holidays')
) AS v(sequence_key, step_order, day_offset, template_key, subject)
  ON v.sequence_key = s.key
ON CONFLICT (sequence_id, step_order) DO NOTHING;

-- === TRIGGER FUNCTION ===
CREATE OR REPLACE FUNCTION handle_client_status_change() RETURNS trigger AS $$
DECLARE
  seq email_sequences%ROWTYPE;
  cancel_key text;
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.status IS DISTINCT FROM OLD.status) THEN

    -- Update status_changed_at on UPDATE (INSERT default already correct)
    IF TG_OP = 'UPDATE' THEN
      NEW.status_changed_at := now();
    END IF;

    -- Loop over every sequence triggered by this new status
    FOR seq IN
      SELECT * FROM email_sequences
      WHERE trigger_status = NEW.status
        AND trigger_type = 'status'
        AND is_active = true
    LOOP
      -- Cancel competing in-flight enrollments
      FOREACH cancel_key IN ARRAY seq.cancels_keys LOOP
        UPDATE sequence_enrollments e
          SET status = 'cancelled', cancelled_at = now(),
              cancel_reason = 'superseded by ' || seq.key
          FROM email_sequences s
          WHERE e.sequence_id = s.id
            AND s.key = cancel_key
            AND e.client_id = NEW.id
            AND e.status = 'active';
      END LOOP;

      -- Enroll (idempotent)
      INSERT INTO sequence_enrollments (client_id, sequence_id)
      SELECT NEW.id, seq.id
      WHERE NOT EXISTS (
        SELECT 1 FROM sequence_enrollments
        WHERE client_id = NEW.id AND sequence_id = seq.id AND status = 'active'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- BEFORE trigger so we can mutate NEW.status_changed_at
DROP TRIGGER IF EXISTS trg_client_status_before ON clients;
CREATE TRIGGER trg_client_status_before
  BEFORE INSERT OR UPDATE OF status ON clients
  FOR EACH ROW EXECUTE FUNCTION handle_client_status_change();


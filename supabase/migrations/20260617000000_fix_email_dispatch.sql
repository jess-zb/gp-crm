-- ============================================================
-- Catch-up: email sequences + enrollment trigger + dispatch fix
-- Safe to run on a DB where these tables do not yet exist.
-- ============================================================

-- 1. email_sequences — uses TEXT for trigger_status to match clients.stage
CREATE TABLE IF NOT EXISTS email_sequences (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text    UNIQUE NOT NULL,
  name          text    NOT NULL,
  trigger_status text,                         -- matches clients.stage value
  trigger_type  text    NOT NULL,
  cancels_keys  text[]  DEFAULT '{}'::text[],
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- 2. email_sequence_steps
CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_order  int  NOT NULL,
  day_offset  int  NOT NULL,
  template_key text NOT NULL,
  subject     text NOT NULL,
  UNIQUE(sequence_id, step_order)
);

-- 3. sequence_enrollments — create if missing, add missing columns if it exists
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  sequence_id   uuid,                          -- soft FK (email_sequences may not pre-exist)
  status        text CHECK (status IN ('active','paused','completed','cancelled')) DEFAULT 'active',
  enrolled_at   timestamptz DEFAULT now(),
  paused_at     timestamptz,
  completed_at  timestamptz,
  cancelled_at  timestamptz,
  cancel_reason text,
  last_step_sent int DEFAULT 0
);

ALTER TABLE sequence_enrollments
  ADD COLUMN IF NOT EXISTS next_send_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sequence_key  text,
  ADD COLUMN IF NOT EXISTS current_step  int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_active_next_send
  ON sequence_enrollments (next_send_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_client_sequence_key
  ON sequence_enrollments (client_id, sequence_key);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status_next_send_at
  ON sequence_enrollments (status, next_send_at)
  WHERE status = 'active';

-- 4. email_logs — create if missing, add missing columns if it exists
CREATE TABLE IF NOT EXISTS email_logs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id      uuid REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  client_id          uuid REFERENCES clients(id),
  template_key       text,
  resend_message_id  text UNIQUE,
  status             text CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','complained','failed')),
  error              text,
  sent_at            timestamptz DEFAULT now(),
  delivered_at       timestamptz,
  opened_at          timestamptz,
  clicked_at         timestamptz,
  bounced_at         timestamptz
);

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS sequence_id text,
  ADD COLUMN IF NOT EXISTS step        int,
  ADD COLUMN IF NOT EXISTS subject     text;

CREATE INDEX IF NOT EXISTS idx_email_logs_client_id_sent_at_desc
  ON email_logs (client_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_resend_message_id
  ON email_logs (resend_message_id);

-- 5. RLS
ALTER TABLE email_sequences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_steps  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage email_sequences"      ON email_sequences;
DROP POLICY IF EXISTS "Admin manage email_sequence_steps" ON email_sequence_steps;
DROP POLICY IF EXISTS "Admin manage sequence_enrollments" ON sequence_enrollments;
DROP POLICY IF EXISTS "Admin manage email_logs"           ON email_logs;

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

DROP POLICY IF EXISTS "Acct manager view email_logs" ON email_logs;
CREATE POLICY "Acct manager view email_logs"
  ON email_logs FOR SELECT
  USING (
    current_user_role() = 'acct_manager'
    AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
  );

-- 6. Seed sequences — trigger_status matches exact clients.stage text values
INSERT INTO email_sequences (key, name, trigger_status, trigger_type, cancels_keys) VALUES
  ('welcome_lead',   'Welcome – New Lead',           'lead',                  'status',   '{}'::text[]),
  ('active_arc',     'Active Arc (1–7)',              'welcome_packet',        'status',   '{partial_arc,welcome_lead,follow_up_24hr}'::text[]),
  ('welcome_cs',     'Welcome – Client Services',    'client_services',       'status',   '{welcome_lead,follow_up_24hr}'::text[]),
  ('partial_arc',    'Partial Arc (1–4)',             NULL,                   'duration', '{welcome_lead,follow_up_24hr}'::text[]),
  ('case_referred',  'Case Sent to Attorneys',        'case_sent_to_attorneys','status',  '{active_arc,partial_arc}'::text[]),
  ('follow_up_24hr', 'Follow Up – 24hr',             NULL,                   'reminder', '{}'::text[]),
  ('holiday',        'Holiday Auto-Responder',        NULL,                   'date',     '{}'::text[])
ON CONFLICT (key) DO NOTHING;

-- 7. Seed steps
INSERT INTO email_sequence_steps (sequence_id, step_order, day_offset, template_key, subject)
SELECT s.id, v.step_order, v.day_offset, v.template_key, v.subject
FROM email_sequences s
JOIN (VALUES
  ('welcome_lead',   1,  0,  'welcome_lead',   'Welcome to Zero Balance!'),
  ('welcome_cs',     1,  0,  'welcome_cs',     'Welcome to Your Next Step with Zero Balance!'),
  ('active_arc',     1,  0,  'active_1',       'Welcome—Here''s What Happens Next'),
  ('active_arc',     2, 14,  'active_2',       'Quick Check-In—We''re Here for You'),
  ('active_arc',     3, 21,  'active_3',       'Why You MUST Forward Creditor Mail'),
  ('active_arc',     4, 30,  'active_4',       'One Month In—You''re Doing Great!'),
  ('active_arc',     5, 45,  'active_5',       'How to Stay Confident During Your Program'),
  ('active_arc',     6, 60,  'active_6',       'Halfway Through—Keeping You on Track'),
  ('active_arc',     7, 90,  'active_7',       '90 Days Strong—Thank You for Trusting Zero Balance'),
  ('partial_arc',    1,  0,  'partial_1',      'Let''s Complete Your Enrollment Today'),
  ('partial_arc',    2,  3,  'partial_2',      'Your Enrollment Is Still Pending'),
  ('partial_arc',    3,  7,  'partial_3',      'Urgent: Last Step to Activate Your Program'),
  ('partial_arc',    4, 10,  'partial_4',      'Last Chance to Confirm Your Enrollment'),
  ('case_referred',  1,  0,  'case_referred',  'Congrats! Your File Is Now with Our Attorney Network'),
  ('follow_up_24hr', 1,  0,  'follow_up_24hr', 'We Missed You – Let''s Reschedule Your Appointment'),
  ('holiday',        1,  0,  'holiday',        'We''re currently closed for the holidays')
) AS v(sequence_key, step_order, day_offset, template_key, subject)
  ON v.sequence_key = s.key
ON CONFLICT (sequence_id, step_order) DO NOTHING;

-- 8. Backfill sequence_key on any existing enrollments
UPDATE sequence_enrollments e
SET sequence_key = s.key
FROM email_sequences s
WHERE e.sequence_id = s.id
  AND e.sequence_key IS NULL;

-- 9. Enrollment trigger — fires on clients.stage (the column the app actually uses)
CREATE OR REPLACE FUNCTION handle_client_stage_change() RETURNS trigger AS $$
DECLARE
  seq   email_sequences%ROWTYPE;
  ckey  text;
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.stage IS DISTINCT FROM OLD.stage) THEN

    FOR seq IN
      SELECT * FROM email_sequences
      WHERE trigger_status = NEW.stage
        AND trigger_type = 'status'
        AND is_active = true
    LOOP
      -- Cancel competing active enrollments
      FOREACH ckey IN ARRAY seq.cancels_keys LOOP
        UPDATE sequence_enrollments e
          SET status = 'cancelled', cancelled_at = now(),
              cancel_reason = 'superseded by ' || seq.key,
              next_send_at = NULL
          FROM email_sequences s2
          WHERE e.sequence_id = s2.id
            AND s2.key = ckey
            AND e.client_id = NEW.id
            AND e.status = 'active';

        UPDATE sequence_enrollments e
          SET status = 'cancelled', cancelled_at = now(),
              cancel_reason = 'superseded by ' || seq.key,
              next_send_at = NULL
          WHERE e.sequence_key = ckey
            AND e.client_id = NEW.id
            AND e.status = 'active';
      END LOOP;

      -- Enroll (idempotent) — always writes both sequence_id and sequence_key
      INSERT INTO sequence_enrollments (client_id, sequence_id, sequence_key, next_send_at)
      SELECT NEW.id, seq.id, seq.key,
        now() + make_interval(days => COALESCE((
          SELECT st.day_offset::int
          FROM email_sequence_steps st
          WHERE st.sequence_id = seq.id
          ORDER BY st.step_order ASC
          LIMIT 1
        ), 0))
      WHERE NOT EXISTS (
        SELECT 1 FROM sequence_enrollments
        WHERE client_id = NEW.id
          AND (sequence_id = seq.id OR sequence_key = seq.key)
          AND status = 'active'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_client_stage_change ON clients;
CREATE TRIGGER trg_client_stage_change
  AFTER INSERT OR UPDATE OF stage ON clients
  FOR EACH ROW EXECUTE FUNCTION handle_client_stage_change();

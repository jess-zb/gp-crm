-- crm_settings (email_sequences_enabled toggle)
CREATE TABLE IF NOT EXISTS crm_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON crm_settings TO authenticated, service_role;

ALTER TABLE crm_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All can read settings" ON crm_settings;
CREATE POLICY "All can read settings"
  ON crm_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Dev can update settings" ON crm_settings;
CREATE POLICY "Dev can update settings"
  ON crm_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'dev'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'dev'
    )
  );

INSERT INTO crm_settings (key, value)
VALUES ('email_sequences_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- comm_templates: sequence drip columns
ALTER TABLE comm_templates
  ADD COLUMN IF NOT EXISTS sequence_key TEXT,
  ADD COLUMN IF NOT EXISTS step_order INT,
  ADD COLUMN IF NOT EXISTS day_offset INT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_templates_sequence_step
  ON comm_templates (sequence_key, step_order)
  WHERE sequence_key IS NOT NULL;

-- sequence_enrollments: logical sequence id + current step
ALTER TABLE sequence_enrollments
  ADD COLUMN IF NOT EXISTS sequence_id TEXT,
  ADD COLUMN IF NOT EXISTS current_step INT DEFAULT 0;

UPDATE sequence_enrollments
SET sequence_id = sequence_key
WHERE sequence_id IS NULL AND sequence_key IS NOT NULL;

-- email_logs: dispatch schema fields
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS sequence_id TEXT,
  ADD COLUMN IF NOT EXISTS step INT,
  ADD COLUMN IF NOT EXISTS subject TEXT;

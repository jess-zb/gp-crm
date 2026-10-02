-- Reusable email / SMS-style text templates for communications logging
CREATE TABLE comm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('email', 'text')),
  subject TEXT,
  body TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comm_templates_type ON comm_templates(template_type);

ALTER TABLE comm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read comm templates"
  ON comm_templates FOR SELECT
  USING (
    current_user_role() IN ('admin', 'management', 'team', 'attorney')
  );

CREATE POLICY "Admin and management manage comm templates"
  ON comm_templates FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'management'));

CREATE POLICY "Admin and management update comm templates"
  ON comm_templates FOR UPDATE
  USING (current_user_role() IN ('admin', 'management'))
  WITH CHECK (current_user_role() IN ('admin', 'management'));

CREATE POLICY "Admin and management delete comm templates"
  ON comm_templates FOR DELETE
  USING (current_user_role() IN ('admin', 'management'));

CREATE TRIGGER comm_templates_updated_at
  BEFORE UPDATE ON comm_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

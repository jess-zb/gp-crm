-- Saved drag-and-drop field placements for CC Auth and Welcome Packet PDFs.

CREATE TABLE IF NOT EXISTS esign_layouts (
  kind TEXT PRIMARY KEY CHECK (kind IN ('cc_authorization', 'welcome_packet')),
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE esign_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read esign_layouts"
  ON esign_layouts FOR SELECT
  TO authenticated
  USING (current_user_role() = 'dev');

CREATE POLICY "Staff write esign_layouts"
  ON esign_layouts FOR ALL
  TO authenticated
  USING (current_user_role() = 'dev')
  WITH CHECK (current_user_role() = 'dev');

GRANT SELECT, INSERT, UPDATE ON esign_layouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON esign_layouts TO service_role;

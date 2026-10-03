-- MID-scoped e-sign templates.
--
-- Replaces the hardcoded `EsignKind` union. In the source project a document
-- was a TypeScript union member with six `switch` statements hanging off it, a
-- CHECK constraint on two tables, a filename mapping, a default field layout and
-- a card in the client-profile UI. Adding one brand meant touching ten files and
-- writing a migration.
--
-- Here a document is a row owned by a MID. Adding a MID and its documents must
-- stay fully no-code: an admin enters a MID name, uploads PDFs, and places the
-- signature and data fields in the existing drag-and-drop editor.

CREATE TABLE esign_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mid_id         uuid NOT NULL REFERENCES mids(id) ON DELETE CASCADE,
  name           text NOT NULL,
  hint           text,
  -- What the signed file *does*. Behaviour stays a closed list because it
  -- drives automation; the document set it is attached to is open.
  behavior       text NOT NULL DEFAULT 'other'
                 CHECK (behavior IN ('cc_authorization', 'welcome_packet', 'agreement', 'other')),
  document_type  text NOT NULL DEFAULT 'client_agreement',
  storage_path   text NOT NULL,
  page_count     integer,
  -- EsignLayoutField[]: percent-based boxes with a bind key. Same shape the
  -- drag-and-drop editor already produces.
  fields         jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_binds text[] NOT NULL DEFAULT '{}',
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 100,
  created_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT esign_templates_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT esign_templates_mid_name_key UNIQUE (mid_id, name)
);

CREATE INDEX esign_templates_mid_idx
  ON esign_templates (mid_id, sort_order, name)
  WHERE is_active;

CREATE TRIGGER esign_templates_updated_at
  BEFORE UPDATE ON esign_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE esign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read esign_templates"
  ON esign_templates FOR SELECT
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Leadership manage esign_templates"
  ON esign_templates FOR ALL
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin'))
  WITH CHECK (current_user_role() IN ('dev', 'admin'));

GRANT SELECT ON esign_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON esign_templates TO service_role;

-- ---------------------------------------------------------------------------
-- esign_requests points at a template instead of naming a kind.
--
-- template_name and behavior are snapshots: a signed document is a legal record,
-- so renaming or deleting a template must not rewrite what was signed.
-- ---------------------------------------------------------------------------
ALTER TABLE esign_requests
  ADD COLUMN template_id   uuid REFERENCES esign_templates(id) ON DELETE SET NULL,
  ADD COLUMN template_name text,
  ADD COLUMN behavior      text;

ALTER TABLE esign_requests DROP CONSTRAINT IF EXISTS esign_requests_kind_check;
ALTER TABLE esign_requests DROP COLUMN kind;

DROP INDEX IF EXISTS esign_requests_client_kind_sent_idx;
CREATE INDEX esign_requests_client_template_sent_idx
  ON esign_requests (client_id, template_id, sent_at DESC);

-- Field layouts now live on the template row, so the per-kind table is gone.
DROP TABLE IF EXISTS esign_layouts;

-- Access is a normal staff capability, not a named-pilot allowlist. The source
-- project embedded six literal email addresses in these policies.
DROP POLICY IF EXISTS "Staff manage esign_requests" ON esign_requests;
CREATE POLICY "Staff manage esign_requests"
  ON esign_requests FOR ALL
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'))
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Staff read esign_events" ON esign_events;
CREATE POLICY "Staff read esign_events"
  ON esign_events FOR SELECT
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

-- comm_templates: reconcile the table with the columns the app reads.
--
-- Two different designs for this table collided in the source project. The
-- baseline schema created the email-sequence flavour (name / subject / body /
-- sequence_key / step_order / day_offset / template_type) and a later migration
-- tried to CREATE TABLE it again with a different shape, failing with "relation
-- already exists". The columns the Templates UI and the renderer actually read
-- were therefore never created in any repo migration — they only existed in the
-- source project's live database.
--
-- The application is the contract here: it reads `type`, never `template_type`
-- (lib/email/render-template.ts, app/(crm)/settings/templates/TemplatesClient.tsx).

ALTER TABLE comm_templates RENAME COLUMN template_type TO type;

ALTER TABLE comm_templates
  ADD COLUMN IF NOT EXISTS template_key   TEXT,
  ADD COLUMN IF NOT EXISTS is_overridden  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category       TEXT,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS comm_templates_template_key_key
  ON comm_templates (template_key)
  WHERE template_key IS NOT NULL;

COMMENT ON COLUMN comm_templates.is_overridden IS
  'True once staff edit a shipped template, so the UI can show "edited <date>".';

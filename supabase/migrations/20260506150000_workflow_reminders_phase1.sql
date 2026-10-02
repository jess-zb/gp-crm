-- Phase 1: workflow metadata on reminders (backwards compatible; pipeline_type retained).

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS appointment_type_key TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS workflow_source TEXT,
  ADD COLUMN IF NOT EXISTS origin_stage TEXT;

ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_department_check;
ALTER TABLE reminders ADD CONSTRAINT reminders_department_check
  CHECK (department IS NULL OR department IN ('sales', 'retention', 'service', 'legal'));

COMMENT ON COLUMN reminders.appointment_type_key IS 'Stable slug for automation and future grouping; legacy appointment_type unchanged.';
COMMENT ON COLUMN reminders.department IS 'Operational queue (sales|retention|service|legal). Dual-write with pipeline_type during migration.';
COMMENT ON COLUMN reminders.workflow_source IS 'Origin: manual, template, import, migration, system.';
COMMENT ON COLUMN reminders.origin_stage IS 'Pipeline stage this task was created under (for stage-transition orchestration).';

-- Dashboard / cron / list queries
CREATE INDEX IF NOT EXISTS idx_reminders_completed_cancelled_due
  ON reminders (completed, cancelled, due_date);

CREATE INDEX IF NOT EXISTS idx_reminders_assignee_completed_due
  ON reminders (assigned_to, completed, due_date);

CREATE INDEX IF NOT EXISTS idx_reminders_client_completed
  ON reminders (client_id, completed);

-- Optional backfill: department from legacy pipeline_type (best-effort)
UPDATE reminders
SET department = CASE pipeline_type
  WHEN 'sales' THEN 'sales'::text
  WHEN 'service' THEN 'service'::text
  ELSE department
END
WHERE department IS NULL
  AND pipeline_type IS NOT NULL;

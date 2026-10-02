-- Corrections applied to the reference database before it is dumped into the
-- Golden Pathway baseline. Each block exists because the source project's
-- migration set could not produce the intended state on an empty database.

-- ---------------------------------------------------------------------------
-- 1. Legacy role-era policies.
--    `user_roles_v2` and `acct_manager_role` were supposed to drop these and
--    recreate acct_manager equivalents, but both migrations errored partway, so
--    the pre-merge policies survived alongside the new ones.
--    The `Team ...` policies scoped the retired `sales` / `service` roles to
--    their own assignees. Those roles merged into acct_manager, which the
--    modern Leadership policies already cover, and lib/roles.ts deliberately
--    does not scope staff by assignee (scopedAssigneeUserId returns null).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Team sees assigned clients" ON clients;
DROP POLICY IF EXISTS "Team can update assigned clients" ON clients;
DROP POLICY IF EXISTS "Team sees documents for assigned clients" ON documents;
DROP POLICY IF EXISTS "Team can update documents for assigned clients" ON documents;
DROP POLICY IF EXISTS "Team can upload documents for assigned clients" ON documents;
DROP POLICY IF EXISTS "Team can view cards for assigned clients" ON client_cards;
DROP POLICY IF EXISTS "Team can add cards for assigned clients" ON client_cards;
DROP POLICY IF EXISTS "Team sees comms for assigned clients" ON communications;
DROP POLICY IF EXISTS "Team can log comms for assigned clients" ON communications;

-- Exact duplicates of the modern Leadership policies.
DROP POLICY IF EXISTS "Admin and management see all clients" ON clients;
DROP POLICY IF EXISTS "Admin and management can view all profiles" ON profiles;

-- ---------------------------------------------------------------------------
-- 2. Policies whose only role list still names the retired `manager` role.
--    `manager` became `acct_manager`, so these are recreated with the current
--    name. Dropping them instead would make the table unreachable.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin and management see all documents" ON documents;
CREATE POLICY "Leadership sees all documents" ON documents FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Admin and management see cards" ON client_cards;
CREATE POLICY "Leadership manages cards" ON client_cards FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Admin and management see audit log" ON audit_log;
CREATE POLICY "Leadership sees audit log" ON audit_log FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Admin and management can insert audit log" ON audit_log;
CREATE POLICY "Leadership inserts audit log" ON audit_log FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Admin and management manage comm templates insert" ON comm_templates;
DROP POLICY IF EXISTS "Admin and management manage comm templates update" ON comm_templates;
DROP POLICY IF EXISTS "Admin and management manage comm templates delete" ON comm_templates;
CREATE POLICY "Leadership manages comm templates" ON comm_templates FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'))
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Admin manage email_logs" ON email_logs;
CREATE POLICY "Leadership manages email_logs" ON email_logs FOR ALL
  USING (current_user_role() IN ('dev', 'admin'));

DROP POLICY IF EXISTS "Admin manage email_sequences" ON email_sequences;
CREATE POLICY "Leadership manages email_sequences" ON email_sequences FOR ALL
  USING (current_user_role() IN ('dev', 'admin'));

DROP POLICY IF EXISTS "Admin manage email_sequence_steps" ON email_sequence_steps;
CREATE POLICY "Leadership manages email_sequence_steps" ON email_sequence_steps FOR ALL
  USING (current_user_role() IN ('dev', 'admin'));

DROP POLICY IF EXISTS "Admin manage sequence_enrollments" ON sequence_enrollments;
CREATE POLICY "Leadership manages sequence_enrollments" ON sequence_enrollments FOR ALL
  USING (current_user_role() IN ('dev', 'admin'));

DROP POLICY IF EXISTS "Admin manage client_reminders" ON client_reminders;
CREATE POLICY "Leadership manages client_reminders" ON client_reminders FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Staff can see checklists" ON onboarding_checklist;
CREATE POLICY "Staff can see checklists" ON onboarding_checklist FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Team can update checklists for assigned clients" ON onboarding_checklist;
CREATE POLICY "Staff can update checklists" ON onboarding_checklist FOR UPDATE
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Staff see messages for their clients" ON portal_messages;
CREATE POLICY "Staff see portal messages" ON portal_messages FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR (
      current_user_role() = 'attorney'
      AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff can see and manage reminders" ON reminders;
CREATE POLICY "Staff can see and manage reminders" ON reminders FOR ALL
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR assigned_to = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 3. Enum values the application requires but no migration adds.
--    lib/constants/stages.ts drives the pipeline off all of these, and the
--    clients list filters terminal stages by name.
-- ---------------------------------------------------------------------------
ALTER TYPE case_stage ADD VALUE IF NOT EXISTS 'retention';
ALTER TYPE case_stage ADD VALUE IF NOT EXISTS 'dnc';
ALTER TYPE case_stage ADD VALUE IF NOT EXISTS 'not_interested';
ALTER TYPE case_stage ADD VALUE IF NOT EXISTS 'dnq';
ALTER TYPE case_stage ADD VALUE IF NOT EXISTS 'mortgage';

-- ---------------------------------------------------------------------------
-- 4. Columns the application reads but no migration adds.
--    `sub_status` backs the RNA ("reached, no answer") dashboard widgets.
-- ---------------------------------------------------------------------------
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sub_status TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_sub_status
  ON clients (sub_status)
  WHERE sub_status IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. `email_sequences.trigger_status` is typed `client_status` but every seed
--    row and the enrolment trigger put a `clients.stage` key in it. Stage keys
--    are not client_status values, which is why the seed failed. The column is
--    plain text so it can hold a stage key.
-- ---------------------------------------------------------------------------
ALTER TABLE email_sequences
  ALTER COLUMN trigger_status TYPE TEXT USING trigger_status::text;

-- ---------------------------------------------------------------------------
-- 6. `sequence_enrollments.sequence_id` was created as UUID by the first email
--    migration, but the dispatch code writes a sequence *key* into it
--    (lib/email/sequence-enrollment.ts sets `sequence_id: args.sequenceKey`),
--    and a later migration tried to add it as TEXT. Text matches the writers.
-- ---------------------------------------------------------------------------
ALTER TABLE sequence_enrollments
  DROP CONSTRAINT IF EXISTS sequence_enrollments_sequence_id_fkey;
ALTER TABLE sequence_enrollments
  ALTER COLUMN sequence_id TYPE TEXT USING sequence_id::text;
-- These attorney-visibility policies joined sequence_enrollments.sequence_id to
-- email_sequences.id, which only type-checks while sequence_id is UUID. The
-- dispatch code writes a sequence *key* there, so the join moves to
-- sequence_key -> email_sequences.key, which matches every writer.
DROP POLICY IF EXISTS "Attorney can view email_sequences for their clients" ON email_sequences;
DROP POLICY IF EXISTS "Attorney can view email_sequence_steps for their clients" ON email_sequence_steps;

ALTER TABLE sequence_enrollments
  DROP CONSTRAINT IF EXISTS sequence_enrollments_sequence_id_fkey;
ALTER TABLE sequence_enrollments
  ALTER COLUMN sequence_id TYPE TEXT USING sequence_id::text;

CREATE POLICY "Attorney can view email_sequences for their clients"
  ON email_sequences FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND EXISTS (
      SELECT 1
      FROM sequence_enrollments e
      JOIN clients c ON c.id = e.client_id
      WHERE e.sequence_key = email_sequences.key
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
      JOIN email_sequences s ON s.key = e.sequence_key
      WHERE s.id = email_sequence_steps.sequence_id
        AND c.attorney_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 7. `handle_client_status_change` enrolled drips off clients.status, which the
--    20260617000000 migration superseded with handle_client_stage_change
--    ("the column the app actually uses"). It never dropped the old trigger, so
--    both were installed and the status one could never match. Dropped here.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_client_status_before ON clients;
DROP FUNCTION IF EXISTS handle_client_status_change();

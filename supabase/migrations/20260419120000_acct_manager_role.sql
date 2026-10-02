-- Final role model: dev, admin, acct_manager, attorney, client
-- Maps legacy manager / sales / service → acct_manager
-- Refreshes RLS from user_roles_v2 to use acct_manager (drops sales/service assignee-scoped client rules)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'acct_manager';

UPDATE profiles
SET role = 'acct_manager'::user_role
WHERE role::text IN ('manager', 'sales', 'service');

-- ========== Drop policies from 20260418170000_user_roles_v2.sql ==========

DROP POLICY IF EXISTS "Leadership can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Dev and admin manage profiles" ON profiles;
DROP POLICY IF EXISTS "Manager can update non-leadership profiles" ON profiles;

DROP POLICY IF EXISTS "Staff can view teams" ON teams;
DROP POLICY IF EXISTS "Dev and admin manage teams" ON teams;

DROP POLICY IF EXISTS "Leadership sees all clients" ON clients;
DROP POLICY IF EXISTS "Sales and service see assigned clients" ON clients;
DROP POLICY IF EXISTS "Sales and service update assigned clients" ON clients;
DROP POLICY IF EXISTS "Attorney sees assigned cases" ON clients;
DROP POLICY IF EXISTS "Client sees own record" ON clients;

DROP POLICY IF EXISTS "Leadership sees all documents" ON documents;
DROP POLICY IF EXISTS "Sales and service see documents for assigned clients" ON documents;
DROP POLICY IF EXISTS "Sales and service upload documents for assigned clients" ON documents;
DROP POLICY IF EXISTS "Sales and service update documents for assigned clients" ON documents;
DROP POLICY IF EXISTS "Attorney sees documents for their cases" ON documents;
DROP POLICY IF EXISTS "Client can see own documents" ON documents;
DROP POLICY IF EXISTS "Client can upload own documents" ON documents;

DROP POLICY IF EXISTS "Leadership see cards" ON client_cards;
DROP POLICY IF EXISTS "Sales and service view cards for assigned clients" ON client_cards;
DROP POLICY IF EXISTS "Sales and service add cards for assigned clients" ON client_cards;

DROP POLICY IF EXISTS "Leadership see all comms" ON communications;
DROP POLICY IF EXISTS "Sales and service see comms for assigned clients" ON communications;
DROP POLICY IF EXISTS "Sales and service log comms for assigned clients" ON communications;
DROP POLICY IF EXISTS "Attorney sees comms for their cases" ON communications;

DROP POLICY IF EXISTS "Staff can read comm templates" ON comm_templates;
DROP POLICY IF EXISTS "Leadership manage comm templates insert" ON comm_templates;
DROP POLICY IF EXISTS "Leadership manage comm templates update" ON comm_templates;
DROP POLICY IF EXISTS "Leadership manage comm templates delete" ON comm_templates;

DROP POLICY IF EXISTS "Staff can read internal hub communications" ON communications;
DROP POLICY IF EXISTS "Staff can insert internal hub communications" ON communications;

DROP POLICY IF EXISTS "Staff see portal messages for clients" ON portal_messages;
DROP POLICY IF EXISTS "Can send portal messages" ON portal_messages;

DROP POLICY IF EXISTS "Leadership see audit log" ON audit_log;
DROP POLICY IF EXISTS "Leadership insert audit log" ON audit_log;

DROP POLICY IF EXISTS "Staff see checklists" ON onboarding_checklist;
DROP POLICY IF EXISTS "Staff update checklists for assigned clients" ON onboarding_checklist;

DROP POLICY IF EXISTS "Staff see and manage reminders" ON reminders;

-- ========== Recreate with acct_manager ==========

CREATE POLICY "Leadership can view all profiles"
  ON profiles FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Dev and admin manage profiles"
  ON profiles FOR ALL
  USING (current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Acct manager can update non-leadership profiles"
  ON profiles FOR UPDATE
  USING (
    current_user_role() = 'acct_manager'
    AND role NOT IN ('dev'::user_role, 'admin'::user_role)
  )
  WITH CHECK (
    current_user_role() = 'acct_manager'
    AND role NOT IN ('dev'::user_role, 'admin'::user_role)
  );

CREATE POLICY "Staff can view teams"
  ON teams FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager', 'attorney')
  );

CREATE POLICY "Dev and admin manage teams"
  ON teams FOR ALL
  USING (current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Leadership sees all clients"
  ON clients FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Attorney sees assigned cases"
  ON clients FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND attorney_id = auth.uid()
    AND stage IN ('case_sent_to_attorneys', 'closed')
  );

CREATE POLICY "Client sees own record"
  ON clients FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Leadership sees all documents"
  ON documents FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Attorney sees documents for their cases"
  ON documents FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (
      SELECT id FROM clients WHERE attorney_id = auth.uid()
    )
  );

CREATE POLICY "Client can see own documents"
  ON documents FOR SELECT
  USING (client_id = current_client_id());

CREATE POLICY "Client can upload own documents"
  ON documents FOR INSERT
  WITH CHECK (client_id = current_client_id());

CREATE POLICY "Leadership see cards"
  ON client_cards FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Leadership see all comms"
  ON communications FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Attorney sees comms for their cases"
  ON communications FOR SELECT
  USING (
    current_user_role() = 'attorney'
    AND client_id IN (
      SELECT id FROM clients WHERE attorney_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read comm templates"
  ON comm_templates FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager', 'attorney')
  );

CREATE POLICY "Leadership manage comm templates insert"
  ON comm_templates FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Leadership manage comm templates update"
  ON comm_templates FOR UPDATE
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'))
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Leadership manage comm templates delete"
  ON comm_templates FOR DELETE
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Staff can read internal hub communications"
  ON communications FOR SELECT
  USING (
    client_id IS NULL
    AND type = 'note'
    AND direction = 'internal'
    AND (
      (
        subject LIKE 'dept:%'
        AND current_user_role() IN ('dev', 'admin', 'acct_manager', 'attorney')
      )
      OR (
        subject LIKE 'team:%'
        AND current_user_role() IN ('dev', 'admin', 'acct_manager', 'attorney')
        AND (
          current_user_role() IN ('dev', 'admin', 'acct_manager')
          OR split_part(split_part(subject, ':', 2), '|', 1) = auth.uid()::text
          OR split_part(split_part(subject, ':', 2), '|', 2) = auth.uid()::text
        )
      )
    )
  );

CREATE POLICY "Staff can insert internal hub communications"
  ON communications FOR INSERT
  WITH CHECK (
    client_id IS NULL
    AND type = 'note'
    AND direction = 'internal'
    AND recorded_by = auth.uid()
    AND (
      (
        subject LIKE 'dept:%'
        AND current_user_role() IN ('dev', 'admin', 'acct_manager', 'attorney')
      )
      OR (
        subject LIKE 'team:%'
        AND current_user_role() IN ('dev', 'admin', 'acct_manager', 'attorney')
        AND (
          split_part(split_part(subject, ':', 2), '|', 1) = auth.uid()::text
          OR split_part(split_part(subject, ':', 2), '|', 2) = auth.uid()::text
        )
      )
    )
  );

CREATE POLICY "Staff see portal messages for clients"
  ON portal_messages FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR (
      current_user_role() = 'attorney'
      AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
    )
    OR client_id = current_client_id()
  );

CREATE POLICY "Can send portal messages"
  ON portal_messages FOR INSERT
  WITH CHECK (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR (
      current_user_role() = 'attorney'
      AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
    )
    OR client_id = current_client_id()
  );

CREATE POLICY "Leadership see audit log"
  ON audit_log FOR SELECT
  USING (current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Leadership insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Staff see checklists"
  ON onboarding_checklist FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
  );

CREATE POLICY "Staff update checklists for assigned clients"
  ON onboarding_checklist FOR UPDATE
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
  );

CREATE POLICY "Staff see and manage reminders"
  ON reminders FOR ALL
  USING (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
    OR assigned_to = auth.uid()
  );

-- Role model: dev, admin, manager, sales, service, attorney, client
-- Maps legacy: management → manager; team → sales (data migration)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dev';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'service';

DO $$
BEGIN
  ALTER TYPE user_role RENAME VALUE 'management' TO 'manager';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

UPDATE profiles SET role = 'sales'::user_role WHERE role::text = 'team';

-- ========== RLS: drop policies that reference old labels ==========

DROP POLICY IF EXISTS "Admin and management can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Management can update non-admin profiles" ON profiles;

DROP POLICY IF EXISTS "Staff can view teams" ON teams;
DROP POLICY IF EXISTS "Admin can manage teams" ON teams;

DROP POLICY IF EXISTS "Admin and management see all clients" ON clients;
DROP POLICY IF EXISTS "Team sees assigned clients" ON clients;
DROP POLICY IF EXISTS "Team can update assigned clients" ON clients;
DROP POLICY IF EXISTS "Attorney sees assigned cases" ON clients;
DROP POLICY IF EXISTS "Client sees own record" ON clients;

DROP POLICY IF EXISTS "Admin and management see all documents" ON documents;
DROP POLICY IF EXISTS "Team sees documents for assigned clients" ON documents;
DROP POLICY IF EXISTS "Team can upload documents for assigned clients" ON documents;
DROP POLICY IF EXISTS "Team can update documents for assigned clients" ON documents;
DROP POLICY IF EXISTS "Attorney sees documents for their cases" ON documents;
DROP POLICY IF EXISTS "Client can see own documents" ON documents;
DROP POLICY IF EXISTS "Client can upload own documents" ON documents;

DROP POLICY IF EXISTS "Admin and management see cards" ON client_cards;
DROP POLICY IF EXISTS "Team can view cards for assigned clients" ON client_cards;
DROP POLICY IF EXISTS "Team can add cards for assigned clients" ON client_cards;

DROP POLICY IF EXISTS "Admin and management see all comms" ON communications;
DROP POLICY IF EXISTS "Team sees comms for assigned clients" ON communications;
DROP POLICY IF EXISTS "Team can log comms for assigned clients" ON communications;
DROP POLICY IF EXISTS "Attorney sees comms for their cases" ON communications;

DROP POLICY IF EXISTS "Staff can read comm templates" ON comm_templates;
DROP POLICY IF EXISTS "Admin and management manage comm templates insert" ON comm_templates;
DROP POLICY IF EXISTS "Admin and management manage comm templates update" ON comm_templates;
DROP POLICY IF EXISTS "Admin and management manage comm templates delete" ON comm_templates;

DROP POLICY IF EXISTS "Staff can read internal hub communications" ON communications;
DROP POLICY IF EXISTS "Staff can insert internal hub communications" ON communications;

DROP POLICY IF EXISTS "Staff see messages for their clients" ON portal_messages;
DROP POLICY IF EXISTS "Can send portal messages" ON portal_messages;

DROP POLICY IF EXISTS "Admin and management see audit log" ON audit_log;
DROP POLICY IF EXISTS "Admin and management can insert audit log" ON audit_log;

DROP POLICY IF EXISTS "Staff can see checklists" ON onboarding_checklist;
DROP POLICY IF EXISTS "Team can update checklists for assigned clients" ON onboarding_checklist;

DROP POLICY IF EXISTS "Staff can see and manage reminders" ON reminders;

-- ========== Recreate policies with new roles ==========

CREATE POLICY "Leadership can view all profiles"
  ON profiles FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Dev and admin manage profiles"
  ON profiles FOR ALL
  USING (current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Manager can update non-leadership profiles"
  ON profiles FOR UPDATE
  USING (
    current_user_role() = 'manager'
    AND role NOT IN ('dev'::user_role, 'admin'::user_role)
  )
  WITH CHECK (
    current_user_role() = 'manager'
    AND role NOT IN ('dev'::user_role, 'admin'::user_role)
  );

CREATE POLICY "Staff can view teams"
  ON teams FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service', 'attorney')
  );

CREATE POLICY "Dev and admin manage teams"
  ON teams FOR ALL
  USING (current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Leadership sees all clients"
  ON clients FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Sales and service see assigned clients"
  ON clients FOR SELECT
  USING (
    current_user_role() IN ('sales', 'service')
    AND assigned_to = auth.uid()
  );

CREATE POLICY "Sales and service update assigned clients"
  ON clients FOR UPDATE
  USING (
    current_user_role() IN ('sales', 'service')
    AND assigned_to = auth.uid()
  );

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
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Sales and service see documents for assigned clients"
  ON documents FOR SELECT
  USING (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Sales and service upload documents for assigned clients"
  ON documents FOR INSERT
  WITH CHECK (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Sales and service update documents for assigned clients"
  ON documents FOR UPDATE
  USING (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

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
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Sales and service view cards for assigned clients"
  ON client_cards FOR SELECT
  USING (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Sales and service add cards for assigned clients"
  ON client_cards FOR INSERT
  WITH CHECK (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Leadership see all comms"
  ON communications FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Sales and service see comms for assigned clients"
  ON communications FOR SELECT
  USING (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Sales and service log comms for assigned clients"
  ON communications FOR INSERT
  WITH CHECK (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

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
    current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service', 'attorney')
  );

CREATE POLICY "Leadership manage comm templates insert"
  ON comm_templates FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Leadership manage comm templates update"
  ON comm_templates FOR UPDATE
  USING (current_user_role() IN ('dev', 'admin', 'manager'))
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Leadership manage comm templates delete"
  ON comm_templates FOR DELETE
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Staff can read internal hub communications"
  ON communications FOR SELECT
  USING (
    client_id IS NULL
    AND type = 'note'
    AND direction = 'internal'
    AND (
      (
        subject LIKE 'dept:%'
        AND current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service', 'attorney')
      )
      OR (
        subject LIKE 'team:%'
        AND current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service', 'attorney')
        AND (
          current_user_role() IN ('dev', 'admin', 'manager')
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
        AND current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service', 'attorney')
      )
      OR (
        subject LIKE 'team:%'
        AND current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service', 'attorney')
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
    current_user_role() IN ('dev', 'admin', 'manager')
    OR (
      current_user_role() IN ('sales', 'service')
      AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
    )
    OR (
      current_user_role() = 'attorney'
      AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
    )
    OR client_id = current_client_id()
  );

CREATE POLICY "Can send portal messages"
  ON portal_messages FOR INSERT
  WITH CHECK (
    current_user_role() IN ('dev', 'admin', 'manager')
    OR (
      current_user_role() IN ('sales', 'service')
      AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
    )
    OR (
      current_user_role() = 'attorney'
      AND client_id IN (SELECT id FROM clients WHERE attorney_id = auth.uid())
    )
    OR client_id = current_client_id()
  );

CREATE POLICY "Leadership see audit log"
  ON audit_log FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Leadership insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Staff see checklists"
  ON onboarding_checklist FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service')
  );

CREATE POLICY "Staff update checklists for assigned clients"
  ON onboarding_checklist FOR UPDATE
  USING (
    current_user_role() IN ('dev', 'admin', 'manager')
    OR (
      current_user_role() IN ('sales', 'service')
      AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
    )
  );

CREATE POLICY "Staff see and manage reminders"
  ON reminders FOR ALL
  USING (
    current_user_role() IN ('dev', 'admin', 'manager')
    OR assigned_to = auth.uid()
  );

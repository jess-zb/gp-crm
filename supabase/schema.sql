-- ============================================================
-- GOLDEN PATHWAY CRM — SUPABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- Baseline: run this file first, then `pnpm migrate`.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('dev', 'admin', 'manager', 'sales', 'service', 'attorney', 'client');

CREATE TYPE case_stage AS ENUM (
  'lead',
  'client_services',
  'welcome_packet',
  'awaiting_collection_letter',
  'case_sent_to_attorneys',
  'closed'
);

CREATE TYPE card_type AS ENUM ('visa', 'mastercard', 'amex', 'discover', 'other');

CREATE TYPE communication_type AS ENUM ('call', 'sms', 'email', 'note');

CREATE TYPE communication_direction AS ENUM ('inbound', 'outbound', 'internal');

CREATE TYPE document_type AS ENUM (
  'government_id',
  'utility_bill',
  'social_security_card',
  'collection_letter',
  'poa_signed',
  'client_agreement',
  'correspondence',
  'audio_recording',
  'screenshot',
  'other'
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  full_name TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  team_id UUID,
  avatar_url TEXT,
  signature_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default_attorney BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TEAMS
-- ============================================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_team
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================================
-- CLIENTS (core record)
-- ============================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  first_name TEXT NOT NULL,
  middle_initial TEXT,
  last_name TEXT NOT NULL,
  nickname TEXT,
  date_of_birth DATE,
  -- SSN stored encrypted — never plaintext
  ssn_encrypted TEXT,
  drivers_license TEXT,

  -- Contact
  email TEXT,
  phone TEXT,
  preferred_contact TEXT DEFAULT 'email',
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,

  -- Case
  stage case_stage NOT NULL DEFAULT 'lead',
  stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  referred_by TEXT,
  client_notes TEXT,
  call_notes TEXT,

  -- Welcome packet (e-signature only)
  poa_signed_at TIMESTAMPTZ,
  poa_document_url TEXT,

  -- Collection letter trigger
  collection_letter_received_at TIMESTAMPTZ,
  case_sent_to_attorney_at TIMESTAMPTZ,
  attorney_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Status flags
  is_active BOOLEAN DEFAULT true,
  portal_access BOOLEAN DEFAULT false,
  notifications_enabled BOOLEAN DEFAULT true,

  portal_invite_token TEXT,
  portal_invite_sent_at TIMESTAMPTZ,
  portal_password_set BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CREDIT CARDS ON FILE (minimal — no raw numbers)
-- ============================================================

CREATE TABLE client_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  creditor_name TEXT NOT NULL,
  card_type card_type NOT NULL,
  last_four CHAR(4) NOT NULL,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,         -- Supabase Storage path
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  is_collection_letter BOOLEAN DEFAULT false,  -- triggers attorney automation
  attorney_notified_at TIMESTAMPTZ,
  attorney_notify_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMUNICATIONS LOG
-- ============================================================

CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  type communication_type NOT NULL,
  direction communication_direction NOT NULL,
  subject TEXT,
  body TEXT,
  from_number TEXT,
  to_number TEXT,
  ringcentral_call_id TEXT,           -- RingCentral call/SMS reference
  duration_seconds INTEGER,           -- for calls
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMUNICATION TEMPLATES (reusable email / text for logging)
-- ============================================================

CREATE TABLE comm_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('email', 'text')),
  subject TEXT,
  body TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comm_templates_type ON comm_templates(template_type);

-- ============================================================
-- REMINDERS / TODOS
-- ============================================================

CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG (immutable — tracks every status change)
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ONBOARDING CHECKLIST (per client)
-- ============================================================

CREATE TABLE onboarding_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  bypassed BOOLEAN DEFAULT false,
  bypass_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PORTAL MESSAGES (client <-> team/attorney chat)
-- ============================================================

CREATE TABLE portal_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name TEXT,
  sender_role user_role,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER comm_templates_updated_at
  BEFORE UPDATE ON comm_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON AUTH SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- COLLECTION LETTER AUTO-TRIGGER
-- When a document is inserted with is_collection_letter = true,
-- automatically advance client to stage 6 and record timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION handle_collection_letter_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_collection_letter = true THEN
    UPDATE clients
    SET
      stage = 'case_sent_to_attorneys',
      collection_letter_received_at = NOW(),
      case_sent_to_attorney_at = NOW(),
      stage_entered_at = NOW()
    WHERE id = NEW.client_id
      AND stage = 'awaiting_collection_letter';

    -- Audit log entry
    INSERT INTO audit_log (client_id, action, new_value, performed_by_name)
    VALUES (
      NEW.client_id,
      'stage_auto_advanced',
      jsonb_build_object(
        'stage', 'case_sent_to_attorneys',
        'trigger', 'collection_letter_upload',
        'document_id', NEW.id
      ),
      'System'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_collection_letter_upload
  AFTER INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION handle_collection_letter_upload();

-- ============================================================
-- AUTO ONBOARDING CHECKLIST on new client
-- ============================================================

CREATE OR REPLACE FUNCTION create_default_checklist()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO onboarding_checklist (client_id, item) VALUES
    (NEW.id, 'Government ID uploaded'),
    (NEW.id, 'Social Security card uploaded'),
    (NEW.id, 'Utility bill uploaded'),
    (NEW.id, 'Client agreement signed'),
    (NEW.id, 'POA signed and received'),
    (NEW.id, 'Payment / card on file'),
    (NEW.id, 'Portal access enabled'),
    (NEW.id, 'Collection letter received');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_client_created
  AFTER INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION create_default_checklist();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get current user's client_id (portal users — email match on clients)
CREATE OR REPLACE FUNCTION current_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM clients c
  INNER JOIN profiles p ON p.id = auth.uid()
  WHERE p.role = 'client'
    AND c.email IS NOT NULL
    AND p.email IS NOT NULL
    AND lower(trim(c.email)) = lower(trim(p.email))
  LIMIT 1;
$$;

-- PROFILES policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admin and management can view all profiles"
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

-- TEAMS policies
CREATE POLICY "Staff can view teams"
  ON teams FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service', 'attorney'));

CREATE POLICY "Dev and admin manage teams"
  ON teams FOR ALL
  USING (current_user_role() IN ('dev', 'admin'));

-- CLIENTS policies
CREATE POLICY "Admin and management see all clients"
  ON clients FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Team sees assigned clients"
  ON clients FOR SELECT
  USING (
    current_user_role() IN ('sales', 'service')
    AND assigned_to = auth.uid()
  );

CREATE POLICY "Team can update assigned clients"
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
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'client'
        AND clients.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(clients.email)) = lower(trim(p.email))
    )
  );

-- DOCUMENTS policies
CREATE POLICY "Admin and management see all documents"
  ON documents FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Team sees documents for assigned clients"
  ON documents FOR SELECT
  USING (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Team can upload documents for assigned clients"
  ON documents FOR INSERT
  WITH CHECK (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Team can update documents for assigned clients"
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

-- CLIENT CARDS policies (no attorney or client access)
CREATE POLICY "Admin and management see cards"
  ON client_cards FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Team can view cards for assigned clients"
  ON client_cards FOR SELECT
  USING (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Team can add cards for assigned clients"
  ON client_cards FOR INSERT
  WITH CHECK (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

-- COMMUNICATIONS policies
CREATE POLICY "Admin and management see all comms"
  ON communications FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Team sees comms for assigned clients"
  ON communications FOR SELECT
  USING (
    current_user_role() IN ('sales', 'service')
    AND client_id IN (
      SELECT id FROM clients WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Team can log comms for assigned clients"
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

-- COMMUNICATION TEMPLATES policies
CREATE POLICY "Staff can read comm templates"
  ON comm_templates FOR SELECT
  USING (
    current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service', 'attorney')
  );

CREATE POLICY "Admin and management manage comm templates insert"
  ON comm_templates FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Admin and management manage comm templates update"
  ON comm_templates FOR UPDATE
  USING (current_user_role() IN ('dev', 'admin', 'manager'))
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Admin and management manage comm templates delete"
  ON comm_templates FOR DELETE
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

-- Internal messaging hub (team DM + department channels; client_id NULL)
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

-- PORTAL MESSAGES policies
CREATE POLICY "Staff see messages for their clients"
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

-- AUDIT LOG (read-only for all, written by system/triggers)
CREATE POLICY "Admin and management see audit log"
  ON audit_log FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'manager'));

CREATE POLICY "Admin and management can insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'manager'));

-- ONBOARDING CHECKLIST policies
CREATE POLICY "Staff can see checklists"
  ON onboarding_checklist FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'manager', 'sales', 'service'));

CREATE POLICY "Team can update checklists for assigned clients"
  ON onboarding_checklist FOR UPDATE
  USING (
    current_user_role() IN ('dev', 'admin', 'manager')
    OR (
      current_user_role() IN ('sales', 'service')
      AND client_id IN (SELECT id FROM clients WHERE assigned_to = auth.uid())
    )
  );

-- REMINDERS policies
CREATE POLICY "Staff can see and manage reminders"
  ON reminders FOR ALL
  USING (
    current_user_role() IN ('dev', 'admin', 'manager')
    OR assigned_to = auth.uid()
  );

-- ============================================================
-- STORAGE BUCKETS
-- Run separately in Supabase Dashboard > Storage
-- Or use the Supabase client in your app
-- ============================================================

-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('client-documents', 'client-documents', false),
--   ('avatars', 'avatars', true);

-- ============================================================
-- SEED: Default teams
-- ============================================================

INSERT INTO teams (name) VALUES
  ('Account Managers'),
  ('Client Services'),
  ('Legal / Attorneys'),
  ('Leadership');

-- ============================================================
-- INDEXES for performance
-- ============================================================

CREATE INDEX idx_clients_stage ON clients(stage);
CREATE INDEX idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX idx_clients_attorney_id ON clients(attorney_id);
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_documents_is_collection_letter ON documents(is_collection_letter);
CREATE INDEX idx_communications_client_id ON communications(client_id);
CREATE INDEX idx_audit_log_client_id ON audit_log(client_id);
CREATE INDEX idx_portal_messages_client_id ON portal_messages(client_id);

-- ------------------------------------------------------------
-- Upgrade existing databases (run once in Supabase SQL Editor):
-- ALTER TABLE documents ADD COLUMN IF NOT EXISTS attorney_notified_at TIMESTAMPTZ;
-- ALTER TABLE documents ADD COLUMN IF NOT EXISTS attorney_notify_error TEXT;
-- CREATE POLICY "Team can update documents for assigned clients"
--   ON documents FOR UPDATE
--   USING (
--     current_user_role() IN ('sales', 'service')
--     AND client_id IN (
--       SELECT id FROM clients WHERE assigned_to = auth.uid()
--     )
--   )
--   WITH CHECK (
--     current_user_role() IN ('sales', 'service')
--     AND client_id IN (
--       SELECT id FROM clients WHERE assigned_to = auth.uid()
--     )
--   );
-- CREATE POLICY "Admin and management can insert audit log"
--   ON audit_log FOR INSERT
--   WITH CHECK (current_user_role() IN ('dev', 'admin', 'manager'));
-- ------------------------------------------------------------

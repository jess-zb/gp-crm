-- MIDs (merchant IDs).
--
-- A MID is a label, never a tenancy or visibility boundary: every staff member
-- sees every client regardless of MID. Do not add MID-scoped RLS.
--
-- This replaces the source project's arrangement, where a MID was a free string
-- living in three places at once — a hardcoded array in code, a JSON blob in
-- crm_settings, and a per-client column named after the shipping vendor
-- (clients.fedex_merchant) that was back-filled by a majority-vote heuristic.

CREATE TABLE mids (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 100,
  notes       text,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mids_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT mids_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX mids_name_key ON mids (lower(btrim(name)));
CREATE UNIQUE INDEX mids_slug_key ON mids (slug);
CREATE INDEX mids_active_order_idx ON mids (sort_order, name) WHERE is_active;

CREATE TRIGGER mids_updated_at
  BEFORE UPDATE ON mids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ON DELETE RESTRICT: MIDs are deactivated, never deleted out from under a
-- client. The admin UI only offers delete when nothing references the row.
ALTER TABLE clients
  ADD COLUMN mid_id uuid REFERENCES mids(id) ON DELETE RESTRICT;

CREATE INDEX idx_clients_mid_id ON clients (mid_id) WHERE mid_id IS NOT NULL;

COMMENT ON COLUMN clients.mid_id IS
  'Chosen at creation and carried through to attorney hand-off. Read it by join; never re-infer it.';

ALTER TABLE mids ENABLE ROW LEVEL SECURITY;

-- Everyone who can see a client can see its MID, including attorneys reading a
-- case. Writes are leadership only.
CREATE POLICY "Staff read mids"
  ON mids FOR SELECT
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager', 'attorney'));

CREATE POLICY "Leadership manage mids"
  ON mids FOR ALL
  TO authenticated
  USING (current_user_role() IN ('dev', 'admin'))
  WITH CHECK (current_user_role() IN ('dev', 'admin'));

GRANT SELECT ON mids TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mids TO service_role;

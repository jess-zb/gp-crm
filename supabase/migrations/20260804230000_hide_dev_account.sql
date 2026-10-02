-- Hide the developer account from every user except the developer itself.
--
-- `lib/constants/hidden-accounts.ts` already filters it out of most CRM lists,
-- but that is per-call-site and anything that forgets the helper (the chat DM
-- picker, for one) leaks it. Enforce it in the database so a missed call site
-- cannot expose the account.

-- ---------------------------------------------------------------------------
-- profiles SELECT
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Permissive policies OR together, so the blanket "true" read has to go or it
-- overrides everything below.
DROP POLICY IF EXISTS "All staff see profiles" ON profiles;
DROP POLICY IF EXISTS "Dev and admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_visible" ON profiles;

CREATE POLICY "profiles_select_visible"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR current_user_role() = 'dev'
    OR role IS DISTINCT FROM 'dev'
  );

-- ---------------------------------------------------------------------------
-- profiles writes
-- ---------------------------------------------------------------------------

-- Replaces the catch-all ALL policy, whose USING clause also granted SELECT
-- and would have re-exposed the dev row to admins.
DROP POLICY IF EXISTS "Dev and admin can manage profiles" ON profiles;

DROP POLICY IF EXISTS "profiles_insert_leadership" ON profiles;
CREATE POLICY "profiles_insert_leadership"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_role() = 'dev'
    OR (current_user_role() = 'admin' AND role IS DISTINCT FROM 'dev')
  );

DROP POLICY IF EXISTS "profiles_update_leadership" ON profiles;
CREATE POLICY "profiles_update_leadership"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    current_user_role() = 'dev'
    OR (current_user_role() = 'admin' AND role IS DISTINCT FROM 'dev')
  )
  WITH CHECK (
    current_user_role() = 'dev'
    OR (current_user_role() = 'admin' AND role IS DISTINCT FROM 'dev')
  );

DROP POLICY IF EXISTS "profiles_delete_leadership" ON profiles;
CREATE POLICY "profiles_delete_leadership"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    current_user_role() = 'dev'
    OR (current_user_role() = 'admin' AND role IS DISTINCT FROM 'dev')
  );

-- ---------------------------------------------------------------------------
-- Scrub the developer name already denormalized into audit history
-- ---------------------------------------------------------------------------

-- audit_log.performed_by_name is a stored string, so RLS on profiles cannot
-- hide it from the dashboard "team activity" feed.
UPDATE audit_log
SET performed_by_name = 'System'
WHERE performed_by IN (SELECT id FROM profiles WHERE role = 'dev')
   OR performed_by_name ILIKE 'developer';

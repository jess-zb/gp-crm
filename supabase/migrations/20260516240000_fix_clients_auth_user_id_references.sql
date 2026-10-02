-- clients.auth_user_id was removed; portal users link by matching profile email to clients.email.

ALTER TABLE clients DROP COLUMN IF EXISTS auth_user_id;

DROP INDEX IF EXISTS idx_clients_auth_user_id;

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

DROP POLICY IF EXISTS "Client sees own record" ON clients;
CREATE POLICY "Client sees own record"
  ON clients FOR SELECT
  TO authenticated
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

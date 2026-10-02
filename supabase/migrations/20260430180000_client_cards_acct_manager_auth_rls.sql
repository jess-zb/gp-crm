-- Split client_cards RLS: acct_manager may UPDATE authorization_status only (enforced by trigger).
-- Dev/admin retain full SELECT / INSERT / UPDATE / DELETE.

DROP POLICY IF EXISTS "Leadership see cards" ON client_cards;

CREATE POLICY "Leadership select cards"
  ON client_cards FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Dev admin insert cards"
  ON client_cards FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Dev admin update cards"
  ON client_cards FOR UPDATE
  USING (current_user_role() IN ('dev', 'admin'))
  WITH CHECK (current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Acct manager update cards"
  ON client_cards FOR UPDATE
  USING (current_user_role() = 'acct_manager')
  WITH CHECK (current_user_role() = 'acct_manager');

CREATE POLICY "Dev admin delete cards"
  ON client_cards FOR DELETE
  USING (current_user_role() IN ('dev', 'admin'));

CREATE OR REPLACE FUNCTION enforce_client_cards_acct_manager_auth_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user_role() = 'acct_manager' THEN
    IF (to_jsonb(NEW) - 'authorization_status')
       IS DISTINCT FROM (to_jsonb(OLD) - 'authorization_status') THEN
      RAISE EXCEPTION 'Account managers may only change authorization_status'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_cards_acct_manager_auth_only ON client_cards;
CREATE TRIGGER trg_client_cards_acct_manager_auth_only
  BEFORE UPDATE ON client_cards
  FOR EACH ROW
  EXECUTE FUNCTION enforce_client_cards_acct_manager_auth_only();

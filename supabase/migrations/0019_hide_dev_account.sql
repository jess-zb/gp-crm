-- Hide dev@goldenpathway.io from every role except the developer.
--
-- profiles_select_visible was already present, but two older permissive
-- policies OR with it and let admins and account managers read the row:
--   "Leadership can view all profiles" (SELECT)
--   "Dev and admin manage profiles" (ALL, whose USING also grants SELECT)

DROP POLICY IF EXISTS "Leadership can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Dev and admin manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "All staff see profiles" ON public.profiles;
DROP POLICY IF EXISTS "Dev and admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Dev and admin can manage profiles" ON public.profiles;

DROP POLICY IF EXISTS "profiles_select_visible" ON public.profiles;
CREATE POLICY "profiles_select_visible"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_user_role() = 'dev'
    OR role IS DISTINCT FROM 'dev'
  );

-- Names already copied into other tables are not covered by profile RLS.
CREATE OR REPLACE FUNCTION public.redact_hidden_actor_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hidden boolean := false;
  actor uuid;
BEGIN
  IF TG_TABLE_NAME = 'portal_messages' THEN
    actor := NEW.sender_id;
  ELSE
    actor := NEW.performed_by;
  END IF;

  IF actor IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = actor
        AND (
          p.role = 'dev'
          OR lower(p.email) = 'dev@goldenpathway.io'
        )
    )
    INTO hidden;
  END IF;

  IF hidden THEN
    IF TG_TABLE_NAME = 'portal_messages' THEN
      NEW.sender_name := 'System';
    ELSE
      NEW.performed_by_name := 'System';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_redact_hidden_actor ON public.audit_log;
CREATE TRIGGER audit_log_redact_hidden_actor
  BEFORE INSERT OR UPDATE OF performed_by, performed_by_name
  ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.redact_hidden_actor_name();

DROP TRIGGER IF EXISTS portal_messages_redact_hidden_actor ON public.portal_messages;
CREATE TRIGGER portal_messages_redact_hidden_actor
  BEFORE INSERT OR UPDATE OF sender_id, sender_name
  ON public.portal_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.redact_hidden_actor_name();

UPDATE public.audit_log
SET performed_by_name = 'System'
WHERE performed_by IN (
    SELECT id FROM public.profiles
    WHERE role = 'dev' OR lower(email) = 'dev@goldenpathway.io'
  )
  OR lower(btrim(performed_by_name)) IN (
    SELECT lower(btrim(full_name))
    FROM public.profiles
    WHERE role = 'dev' OR lower(email) = 'dev@goldenpathway.io'
  )
  OR lower(btrim(performed_by_name)) = 'dev@goldenpathway.io'
  OR performed_by_name ILIKE 'developer';

UPDATE public.portal_messages
SET sender_name = 'System'
WHERE sender_id IN (
    SELECT id FROM public.profiles
    WHERE role = 'dev' OR lower(email) = 'dev@goldenpathway.io'
  )
  OR lower(btrim(sender_name)) IN (
    SELECT lower(btrim(full_name))
    FROM public.profiles
    WHERE role = 'dev' OR lower(email) = 'dev@goldenpathway.io'
  )
  OR lower(btrim(sender_name)) = 'dev@goldenpathway.io';

UPDATE public.clients
SET reviewed_by_name = 'System'
WHERE lower(btrim(reviewed_by_name)) IN (
    SELECT lower(btrim(full_name))
    FROM public.profiles
    WHERE role = 'dev' OR lower(email) = 'dev@goldenpathway.io'
  )
  OR lower(btrim(reviewed_by_name)) = 'dev@goldenpathway.io';

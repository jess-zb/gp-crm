-- Staff can hide the client Documents → E-Sign section until the business is ready.
-- Dev flips the row. Everyone else only sees the section when it is visible.

CREATE TABLE public.staff_feature_flags (
  key text PRIMARY KEY,
  visible boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_feature_flags_key_not_blank CHECK (btrim(key) <> '')
);

CREATE TRIGGER staff_feature_flags_updated_at
  BEFORE UPDATE ON public.staff_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.staff_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read feature flags"
  ON public.staff_feature_flags
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Dev updates feature flags"
  ON public.staff_feature_flags
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'dev')
  WITH CHECK (public.current_user_role() = 'dev');

GRANT SELECT, UPDATE ON public.staff_feature_flags TO authenticated;
GRANT ALL ON public.staff_feature_flags TO service_role;

INSERT INTO public.staff_feature_flags (key, visible)
VALUES ('client_esign_section', false);

-- The onboarding and Client Services checklists are no longer shown.
-- Stage changes read documents and poa_signed_at, not these rows.
-- New clients must not grow a fresh set of hidden rows.

DELETE FROM public.onboarding_checklist;

CREATE OR REPLACE FUNCTION public.create_default_checklist() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN NEW;
END;
$$;

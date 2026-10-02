-- Permanently replace legacy Zero Balance contact info with DebtSupportPros (DSP).
-- Phone: 888-885-6042 | Email: support@debtsupportpros.com

CREATE OR REPLACE FUNCTION public.scrub_legacy_zb_contact(t text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF t IS NULL THEN
    RETURN NULL;
  END IF;

  t := replace(t, '888-805-4221', '888-885-6042');
  t := replace(t, '888-807-4221', '888-885-6042');
  t := replace(t, '(888) 805-4221', '888-885-6042');
  t := replace(t, '(888) 807-4221', '888-885-6042');
  t := replace(t, 'support@zerobalance.info', 'support@debtsupportpros.com');
  t := replace(t, 'emile@zerobalance.info', 'emile@debtsupportpros.com');
  t := replace(t, 'https://zerobalance.info/', 'https://debtsupportpros.com/');
  t := replace(t, 'https://zerobalance.info', 'https://debtsupportpros.com/');
  t := replace(t, 'Welcome to Zero Balance!', 'Welcome to DebtSupportPros!');
  t := replace(t, 'Welcome to Your Next Step with Zero Balance!', 'Welcome to Your Next Step with DebtSupportPros!');
  t := replace(t, '90 Days Strong—Thank You for Trusting Zero Balance', '90 Days Strong—Thank You for Trusting DebtSupportPros');
  t := replace(t, 'Welcome again to Zero Balance', 'Welcome again to DebtSupportPros');
  t := replace(t, 'At Zero Balance,', 'At DebtSupportPros,');
  t := replace(t, 'with Zero Balance.', 'with DebtSupportPros.');
  t := replace(t, 'The Zero Balance Team', 'The DebtSupportPros Team');

  RETURN t;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'email_message_templates'
  ) THEN
    UPDATE public.email_message_templates
       SET default_subject = public.scrub_legacy_zb_contact(default_subject),
           default_body = public.scrub_legacy_zb_contact(default_body),
           is_overridden = false
     WHERE default_subject ILIKE '%zero balance%'
        OR default_body ILIKE '%zero balance%'
        OR default_body ILIKE '%zerobalance%'
        OR default_body ILIKE '%805-4221%'
        OR default_body ILIKE '%807-4221%'
        OR default_subject ILIKE '%805-4221%'
        OR default_subject ILIKE '%807-4221%';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'comm_templates'
  ) THEN
    UPDATE public.comm_templates
       SET subject = public.scrub_legacy_zb_contact(subject),
           body = public.scrub_legacy_zb_contact(body),
           is_overridden = false
     WHERE coalesce(subject, '') ILIKE '%zero balance%'
        OR coalesce(body, '') ILIKE '%zero balance%'
        OR coalesce(body, '') ILIKE '%zerobalance%'
        OR coalesce(body, '') ILIKE '%805-4221%'
        OR coalesce(body, '') ILIKE '%807-4221%'
        OR coalesce(subject, '') ILIKE '%805-4221%'
        OR coalesce(subject, '') ILIKE '%807-4221%';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'email_sequence_steps'
  ) THEN
    UPDATE public.email_sequence_steps
       SET subject = public.scrub_legacy_zb_contact(subject)
     WHERE subject ILIKE '%zero balance%'
        OR subject ILIKE '%805-4221%'
        OR subject ILIKE '%807-4221%';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.scrub_legacy_zb_contact(text);

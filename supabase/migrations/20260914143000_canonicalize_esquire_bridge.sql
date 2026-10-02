-- "Esquirebridge" (any spacing/case) is a misspelling of "Esquire Bridge".
-- Skip tables that were never created in this database (e.g. sunset_lookup).

DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    UPDATE clients
    SET fedex_merchant = 'Esquire Bridge'
    WHERE fedex_merchant IS NOT NULL
      AND regexp_replace(lower(trim(fedex_merchant)), '[\s_-]+', '', 'g') = 'esquirebridge'
      AND trim(fedex_merchant) IS DISTINCT FROM 'Esquire Bridge';
  END IF;

  IF to_regclass('public.client_cards') IS NOT NULL THEN
    UPDATE client_cards
    SET merchant_name = 'Esquire Bridge'
    WHERE merchant_name IS NOT NULL
      AND regexp_replace(lower(trim(merchant_name)), '[\s_-]+', '', 'g') = 'esquirebridge'
      AND trim(merchant_name) IS DISTINCT FROM 'Esquire Bridge';
  END IF;

  IF to_regclass('public.client_fedex_shipments') IS NOT NULL THEN
    UPDATE client_fedex_shipments
    SET merchant = 'Esquire Bridge'
    WHERE merchant IS NOT NULL
      AND regexp_replace(lower(trim(merchant)), '[\s_-]+', '', 'g') = 'esquirebridge'
      AND trim(merchant) IS DISTINCT FROM 'Esquire Bridge';
  END IF;

  IF to_regclass('public.sunset_lookup') IS NOT NULL THEN
    UPDATE sunset_lookup
    SET merchant = 'Esquire Bridge'
    WHERE merchant IS NOT NULL
      AND regexp_replace(lower(trim(merchant)), '[\s_-]+', '', 'g') = 'esquirebridge'
      AND trim(merchant) IS DISTINCT FROM 'Esquire Bridge';
  END IF;

  IF to_regclass('public.refunds') IS NOT NULL THEN
    UPDATE refunds
    SET processor_mid = 'Esquire Bridge'
    WHERE processor_mid IS NOT NULL
      AND regexp_replace(lower(trim(processor_mid)), '[\s_-]+', '', 'g') = 'esquirebridge'
      AND trim(processor_mid) IS DISTINCT FROM 'Esquire Bridge';
  END IF;
END $$;

-- Drop the misspelling (and the now-built-in canonical name) from Dev extras.
DO $$
DECLARE
  raw text;
  arr jsonb;
  cleaned jsonb;
BEGIN
  IF to_regclass('public.crm_settings') IS NULL THEN
    RETURN;
  END IF;

  SELECT value INTO raw
  FROM crm_settings
  WHERE key = 'packet_mid_extra_options';

  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN;
  END IF;

  BEGIN
    arr := raw::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  IF jsonb_typeof(arr) IS DISTINCT FROM 'array' THEN
    RETURN;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(name)), '[]'::jsonb)
  INTO cleaned
  FROM (
    SELECT DISTINCT btrim(elem) AS name
    FROM jsonb_array_elements_text(arr) AS elem
    WHERE btrim(elem) <> ''
      AND regexp_replace(lower(btrim(elem)), '[\s_-]+', '', 'g') <> 'esquirebridge'
  ) s;

  UPDATE crm_settings
  SET value = cleaned::text
  WHERE key = 'packet_mid_extra_options';
END $$;

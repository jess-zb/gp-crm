-- Caps partner lead intake. Only the service role may call the function.
-- The API key is not stored here.

CREATE TABLE public.lead_intake_rate (
  id integer PRIMARY KEY DEFAULT 1,
  minute_start timestamp with time zone NOT NULL DEFAULT now(),
  minute_hits integer NOT NULL DEFAULT 0,
  day_start timestamp with time zone NOT NULL DEFAULT now(),
  day_hits integer NOT NULL DEFAULT 0,
  CONSTRAINT lead_intake_rate_singleton CHECK (id = 1)
);

INSERT INTO public.lead_intake_rate (id) VALUES (1);

ALTER TABLE public.lead_intake_rate ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lead_intake_rate FROM PUBLIC;
REVOKE ALL ON public.lead_intake_rate FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_lead_intake_slot()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean;
BEGIN
  PERFORM 1 FROM public.lead_intake_rate WHERE id = 1 FOR UPDATE;

  UPDATE public.lead_intake_rate
  SET
    minute_start = CASE
      WHEN minute_start < now() - interval '1 minute' THEN now()
      ELSE minute_start
    END,
    minute_hits = CASE
      WHEN minute_start < now() - interval '1 minute' THEN 1
      ELSE minute_hits + 1
    END,
    day_start = CASE
      WHEN day_start < now() - interval '1 day' THEN now()
      ELSE day_start
    END,
    day_hits = CASE
      WHEN day_start < now() - interval '1 day' THEN 1
      ELSE day_hits + 1
    END
  WHERE id = 1
  RETURNING (minute_hits <= 60 AND day_hits <= 2000)
  INTO allowed;

  RETURN COALESCE(allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_lead_intake_slot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_lead_intake_slot() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_lead_intake_slot() TO service_role;

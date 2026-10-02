-- sunset_lookup: nightly sync from Google Sheets for Tier 2 merchant name matching
CREATE TABLE IF NOT EXISTS public.sunset_lookup (
  name_key   TEXT NOT NULL PRIMARY KEY,   -- lower(first_name)||'|'||lower(last_name)
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  merchant   TEXT NOT NULL,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- fedex_merchant: persisted merchant resolution on the client record
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS fedex_merchant TEXT;

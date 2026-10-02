-- Confirmed values that will stamp on the signed PDF for this request.
ALTER TABLE esign_requests
  ADD COLUMN IF NOT EXISTS prefill_snapshot JSONB;

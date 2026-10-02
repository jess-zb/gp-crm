-- Audit reference minted when the client opens the emailed link (no typed OTP).
ALTER TABLE esign_requests
  ADD COLUMN IF NOT EXISTS cert_ref TEXT;

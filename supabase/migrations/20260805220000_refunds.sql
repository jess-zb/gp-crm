-- Refund lifecycle tracking.
--
-- Requesting a refund already cancels the client and sets DNC; that behavior is
-- unchanged. This table adds the part that was missing: what happened after the
-- request, and when. Refunds are rarely processed the same day they are asked
-- for, so `requested_at` and `refunded_at` are tracked separately.
--
-- processor_mid is its own column rather than a reference to
-- client_cards.merchant_name. That column drives FedEx/packet routing, and
-- reusing it would couple two unrelated concerns; the picker is seeded from the
-- same MERCHANT_OPTIONS list instead.

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,

  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  processor_mid TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'refunded', 'denied')),

  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  requested_by_name TEXT,

  refunded_at TIMESTAMPTZ,
  refunded_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  refunded_by_name TEXT,

  -- When a refund exceeds the processor float, the fee is avoided by billing
  -- another client on the same MID the same day. Recorded, never enforced.
  offset_billed_at TIMESTAMPTZ,
  offset_amount_cents INTEGER CHECK (offset_amount_cents IS NULL OR offset_amount_cents >= 0),

  notes TEXT,
  -- Set on backfilled rows, where the amount and processor were inferred rather
  -- than entered by a person.
  needs_review BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN refunds.processor_mid IS
  'Payment processor / MID the original charge ran on. Free text, populated from MERCHANT_OPTIONS.';
COMMENT ON COLUMN refunds.needs_review IS
  'True when the row was inferred by a backfill and a human has not confirmed the amount or processor.';

CREATE INDEX IF NOT EXISTS idx_refunds_status_requested_at
  ON refunds (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_processor_status
  ON refunds (processor_mid, status);
CREATE INDEX IF NOT EXISTS idx_refunds_client_id
  ON refunds (client_id);

DROP TRIGGER IF EXISTS refunds_updated_at ON refunds;
CREATE TRIGGER refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS
-- ============================================================
-- Anyone who can cancel a client can request a refund, matching
-- canCancelClientToDnc. Only dev and admin can settle one, matching
-- canAccessRefundQueue. SELECT covers all three staff roles so the insert can
-- return its row; queue visibility is enforced by the Refunds tab gate.

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read refunds" ON refunds;
CREATE POLICY "Staff can read refunds"
  ON refunds FOR SELECT
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Staff can request refunds" ON refunds;
CREATE POLICY "Staff can request refunds"
  ON refunds FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Leadership can settle refunds" ON refunds;
CREATE POLICY "Leadership can settle refunds"
  ON refunds FOR UPDATE
  USING (current_user_role() IN ('dev', 'admin'));

DROP POLICY IF EXISTS "Leadership can delete refunds" ON refunds;
CREATE POLICY "Leadership can delete refunds"
  ON refunds FOR DELETE
  USING (current_user_role() IN ('dev', 'admin'));

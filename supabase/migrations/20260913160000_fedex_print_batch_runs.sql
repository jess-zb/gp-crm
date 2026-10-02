-- One row per Pacific print-window date (YYYY-MM-DD).
-- skipped = cron fired while Dev dispatch toggle was off.
-- sent    = packets reached PostLogic that day.
-- empty   = cron fired with dispatch on, but nothing was ready.
CREATE TABLE IF NOT EXISTS fedex_print_batch_runs (
  batch_id      TEXT PRIMARY KEY,
  status        TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'empty')),
  queued_count  INT NOT NULL DEFAULT 0,
  sent_count    INT NOT NULL DEFAULT 0,
  reason        TEXT,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fedex_print_batch_runs_recorded_at_idx
  ON fedex_print_batch_runs (recorded_at DESC);

ALTER TABLE fedex_print_batch_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE fedex_print_batch_runs TO authenticated;
GRANT ALL ON TABLE fedex_print_batch_runs TO service_role;

DROP POLICY IF EXISTS "Staff can read print batch runs" ON fedex_print_batch_runs;
CREATE POLICY "Staff can read print batch runs"
  ON fedex_print_batch_runs FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- RUN AFTER dedupe.js succeeds and verification queries look clean.
-- Prevents future duplicate imports keyed by shape_lead_id.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_shape_lead_id_unique
  ON clients (shape_lead_id)
  WHERE shape_lead_id IS NOT NULL;

COMMENT ON INDEX idx_clients_shape_lead_id_unique IS
  'One CRM row per Shape lead id; nullable duplicates allowed only before backfill.';

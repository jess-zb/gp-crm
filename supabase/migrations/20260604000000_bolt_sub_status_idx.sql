-- ⚡ Bolt: Optimized dashboard alerts with sub_status index

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_sub_status
  ON clients (sub_status)
  WHERE sub_status IS NOT NULL;

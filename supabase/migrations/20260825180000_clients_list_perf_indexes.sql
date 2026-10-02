-- Client list: indexes that match the Active / All / Archives / Priority filters.
-- Not CONCURRENTLY — migrate.mjs runs each file in a transaction.

CREATE INDEX IF NOT EXISTS idx_clients_active_pipeline_created
  ON clients (created_at DESC)
  WHERE is_active = true
    AND stage NOT IN ('dnc', 'not_interested', 'dnq', 'mortgage', 'closed');

CREATE INDEX IF NOT EXISTS idx_clients_inactive_created
  ON clients (created_at DESC)
  WHERE is_active = false;

CREATE INDEX IF NOT EXISTS idx_clients_created_at_desc
  ON clients (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clients_assigned_created
  ON clients (assigned_to, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clients_active_client_services
  ON clients (created_at)
  WHERE is_active = true AND stage = 'client_services';

-- One round-trip for Clients tab badges. SECURITY INVOKER keeps RLS.
-- Filters must stay identical to lib/clients/tab-counts.ts.
CREATE OR REPLACE FUNCTION public.crm_client_tab_counts(p_assigned_to uuid DEFAULT NULL)
RETURNS TABLE (
  all_count bigint,
  active_count bigint,
  archives_count bigint,
  priority_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE created_at >= TIMESTAMPTZ '2026-06-02 00:00:00+00'
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS all_count,
    COUNT(*) FILTER (
      WHERE is_active = true
        AND stage NOT IN ('dnc', 'not_interested', 'dnq', 'mortgage', 'closed')
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS active_count,
    COUNT(*) FILTER (
      WHERE is_active = false
        AND created_at >= TIMESTAMPTZ '2026-06-02 00:00:00+00'
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS archives_count,
    COUNT(*) FILTER (
      WHERE is_active = true
        AND stage = 'client_services'
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS priority_count
  FROM clients;
$$;

GRANT EXECUTE ON FUNCTION public.crm_client_tab_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_client_tab_counts(uuid) TO service_role;

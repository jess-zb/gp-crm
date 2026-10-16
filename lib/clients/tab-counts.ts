import type { SupabaseClient } from "@supabase/supabase-js";

const CLIENT_LIST_CUTOFF = "2026-06-02T00:00:00+00:00";

export type TabCounts = {
  all: number;
  active: number;
  archives: number;
  /** Refunds requested but not yet marked refunded. */
  refunds?: number;
};

/**
 * Tab totals without search filter; respects team scope (assigned_to). Each
 * flag turns off a count query for a tab this role cannot open, so nobody pays
 * for a number they will never see.
 */
export async function fetchTabCounts(
  supabase: SupabaseClient,
  teamUserId: string | null,
  options: { includeAll?: boolean } = {}
): Promise<TabCounts> {
  const { includeAll = true } = options;
  const startedAt = Date.now();

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "crm_client_tab_counts",
    { p_assigned_to: teamUserId }
  );

  const rpcRow = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (!rpcError && rpcRow && typeof rpcRow === "object") {
    const row = rpcRow as {
      all_count?: number | string | null;
      active_count?: number | string | null;
      archives_count?: number | string | null;
    };
    const toN = (v: number | string | null | undefined) => Number(v ?? 0);
    console.info(`[perf] fetchTabCounts rpc ${Date.now() - startedAt}ms`);
    return {
      all: includeAll ? toN(row.all_count) : 0,
      active: toN(row.active_count),
      archives: toN(row.archives_count),
    };
  }

  if (rpcError) {
    console.warn("[fetchTabCounts] rpc fallback:", rpcError.message);
  }

  const scopedHead = () => {
    let q = supabase.from("clients").select("id", { count: "exact", head: true });
    if (teamUserId) {
      q = q.eq("assigned_to", teamUserId);
    }
    return q;
  };

  const [allRes, activeRes, archivesRes] = await Promise.all([
    includeAll
      ? scopedHead().gte("created_at", CLIENT_LIST_CUTOFF)
      : Promise.resolve({ count: 0 }),
    (() => {
      let q = scopedHead();
      q = q.eq("is_active", true);
      return q;
    })(),
    (() => {
      let q = scopedHead();
      q = q.eq("is_active", false).gte("created_at", CLIENT_LIST_CUTOFF);
      return q;
    })(),
  ]);

  console.info(`[perf] fetchTabCounts fallback ${Date.now() - startedAt}ms`);
  return {
    all: allRes.count ?? 0,
    active: activeRes.count ?? 0,
    archives: archivesRes.count ?? 0,
  };
}

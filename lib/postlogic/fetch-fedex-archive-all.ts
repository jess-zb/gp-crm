import type { SupabaseClient } from "@supabase/supabase-js";

const ARCHIVE_SELECT =
  "id, first_name, last_name, phone_mobile, fedex_tracking_number, postlogic_status, fedex_queued_at, pod_delivered_at, stage, assigned_user:profiles!assigned_to(full_name)";

export type FedexArchiveClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_mobile: string | null;
  fedex_tracking_number: string | null;
  postlogic_status: string | null;
  fedex_queued_at: string | null;
  pod_delivered_at?: string | null;
  stage: string | null;
  assigned_user:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null;
};

/**
 * FedEx archive can exceed PostgREST’s default 1000-row cap; page in 1000-row chunks.
 */
export async function fetchAllFedexArchiveClients(
  supabase: SupabaseClient
): Promise<FedexArchiveClientRow[]> {
  const pageSize = 1000;
  let page = 0;
  const all: FedexArchiveClientRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("clients")
      .select(ARCHIVE_SELECT)
      .not("fedex_tracking_number", "is", null)
      .neq("fedex_tracking_number", "")
      .order("fedex_queued_at", { ascending: false, nullsFirst: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...(data as FedexArchiveClientRow[]));

    if (data.length < pageSize) break;
    page++;
  }

  return all;
}

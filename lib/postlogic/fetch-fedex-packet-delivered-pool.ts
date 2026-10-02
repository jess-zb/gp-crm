import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * All active clients with a FedEx tracking number (Packet Delivered tab source).
 * Paginated — PostgREST caps at 1000 rows per request.
 */
export async function fetchAllActiveClientsWithFedexTracking<
  T extends Record<string, unknown> = Record<string, unknown>,
>(supabase: SupabaseClient, select: string): Promise<T[]> {
  const pageSize = 1000;
  let page = 0;
  const all: T[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("clients")
      .select(select)
      .not("fedex_tracking_number", "is", null)
      .neq("fedex_tracking_number", "")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("[fetchAllActiveClientsWithFedexTracking]", error.message);
      return [];
    }
    if (!data || data.length === 0) break;

    all.push(...(data as unknown as T[]));

    if (data.length < pageSize) break;
    page++;
  }

  return all;
}

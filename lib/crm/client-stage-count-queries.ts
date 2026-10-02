import type { SupabaseClient } from "@supabase/supabase-js";

/** Exact active-client count per stage (no row cap — uses PostgREST count). */
export async function countActiveClientsByStages(
  supabase: SupabaseClient,
  stages: readonly string[]
): Promise<Record<string, number>> {
  const pairs = await Promise.all(
    stages.map(async (stage) => {
      const { count, error } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("stage", stage)
        .eq("is_active", true);
      return [stage, error ? 0 : (count ?? 0)] as const;
    })
  );
  return Object.fromEntries(pairs) as Record<string, number>;
}

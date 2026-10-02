import type { SupabaseClient } from "@supabase/supabase-js";

export type AssignmentMethod = "default" | "round_robin" | "manual";

export async function getNextAttorney(
  supabase: SupabaseClient,
  method: AssignmentMethod = "default"
): Promise<{ id: string; full_name: string | null } | null> {
  if (method === "default") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "attorney")
      .eq("is_default_attorney", true)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[getNextAttorney] default fetch error:", error.message);
      throw new Error("Failed to fetch default attorney");
    }
    return data ?? null;
  }

  if (method === "round_robin") {
    // TODO: implement round robin based on least recently assigned
    // For now falls through to default
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "attorney")
      .eq("is_active", true)
      .order("last_seen_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[getNextAttorney] round_robin fetch error:", error.message);
      throw new Error("Failed to fetch attorney for round robin");
    }
    return data ?? null;
  }

  return null;
}

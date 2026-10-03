import type { SupabaseClient } from "@supabase/supabase-js";

export type MidRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
};

export const MID_SELECT = "id, name, slug, is_active, sort_order";

/** Lowercase, hyphenated, stable. Stored, because it appears in storage paths. */
export function midSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pickers only ever offer active MIDs. */
export async function loadActiveMids(
  supabase: SupabaseClient
): Promise<MidRow[]> {
  const { data, error } = await supabase
    .from("mids")
    .select(MID_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[mids] loadActiveMids:", error.message);
    return [];
  }
  return (data ?? []) as MidRow[];
}

/** Settings list shows inactive MIDs too, so they can be reactivated. */
export async function loadAllMids(
  supabase: SupabaseClient
): Promise<MidRow[]> {
  const { data, error } = await supabase
    .from("mids")
    .select(MID_SELECT)
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[mids] loadAllMids:", error.message);
    return [];
  }
  return (data ?? []) as MidRow[];
}

export async function loadMidById(
  supabase: SupabaseClient,
  midId: string
): Promise<MidRow | null> {
  const { data, error } = await supabase
    .from("mids")
    .select(MID_SELECT)
    .eq("id", midId)
    .maybeSingle();

  if (error) {
    console.error("[mids] loadMidById:", error.message);
    return null;
  }
  return (data as MidRow | null) ?? null;
}

/** Shape returned by a `mids(name)` embed on a clients query. */
export type EmbeddedMid = { name: string | null } | { name: string | null }[] | null;

export function midNameFromEmbed(embed: unknown): string | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  const name = (row as { name?: string | null } | undefined)?.name;
  return name?.trim() || null;
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ESIGN_TEMPLATE_SELECT,
  type EsignTemplateCard,
  type EsignTemplateRow,
} from "./types";

/** Documents belonging to one MID, in the order staff arranged them. */
export async function loadTemplatesForMid(
  supabase: SupabaseClient,
  midId: string,
  opts: { includeInactive?: boolean } = {}
): Promise<EsignTemplateRow[]> {
  let query = supabase
    .from("esign_templates")
    .select(ESIGN_TEMPLATE_SELECT)
    .eq("mid_id", midId);

  if (!opts.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[esign templates] loadTemplatesForMid:", error.message);
    return [];
  }
  return (data ?? []) as EsignTemplateRow[];
}

/**
 * The documents a given client may be sent — i.e. the ones owned by their MID.
 * A client with no MID has no documents, which the UI states plainly rather
 * than falling back to some default set.
 */
export async function loadTemplatesForClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<{ midId: string | null; midName: string | null; templates: EsignTemplateCard[] }> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("mid_id, mids(name)")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client?.mid_id) {
    if (error) console.error("[esign templates] client lookup:", error.message);
    return { midId: null, midName: null, templates: [] };
  }

  const embed = client.mids as { name: string | null } | { name: string | null }[] | null;
  const midRow = Array.isArray(embed) ? embed[0] : embed;

  const rows = await loadTemplatesForMid(supabase, client.mid_id as string);
  return {
    midId: client.mid_id as string,
    midName: midRow?.name?.trim() || null,
    templates: rows.map((t) => ({
      id: t.id,
      name: t.name,
      hint: t.hint,
      behavior: t.behavior,
    })),
  };
}

export async function loadTemplateById(
  supabase: SupabaseClient,
  templateId: string
): Promise<EsignTemplateRow | null> {
  const { data, error } = await supabase
    .from("esign_templates")
    .select(ESIGN_TEMPLATE_SELECT)
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    console.error("[esign templates] loadTemplateById:", error.message);
    return null;
  }
  return (data as EsignTemplateRow | null) ?? null;
}

/**
 * Authorization, not convenience: a template may only be sent to a client whose
 * MID owns it. Without this a crafted templateId could send one MID's paperwork
 * to another MID's client.
 */
export async function templateBelongsToClient(
  supabase: SupabaseClient,
  templateId: string,
  clientId: string
): Promise<boolean> {
  const [{ data: template }, { data: client }] = await Promise.all([
    supabase.from("esign_templates").select("mid_id, is_active").eq("id", templateId).maybeSingle(),
    supabase.from("clients").select("mid_id").eq("id", clientId).maybeSingle(),
  ]);
  if (!template?.mid_id || !client?.mid_id) return false;
  if (template.is_active === false) return false;
  return template.mid_id === client.mid_id;
}

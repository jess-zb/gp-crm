import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultLayoutForKind,
  parseLayoutFields,
  type EsignLayoutField,
} from "./layout";
import type { EsignKind } from "./types";

export async function loadEsignLayout(
  admin: SupabaseClient,
  kind: EsignKind
): Promise<EsignLayoutField[]> {
  const { data } = await admin.from("esign_layouts").select("fields").eq("kind", kind).maybeSingle();
  const parsed = parseLayoutFields(data?.fields);
  if (parsed && parsed.length > 0) return parsed;
  return defaultLayoutForKind(kind);
}

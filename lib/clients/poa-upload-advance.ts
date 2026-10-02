import type { SupabaseClient } from "@supabase/supabase-js";

const POA_DOCUMENT_TYPES = new Set([
  "poa",
  "poa_document",
  "poa_signed",
  "power_of_attorney",
]);

export function isPoaDocumentType(documentType: string): boolean {
  return POA_DOCUMENT_TYPES.has(documentType.trim().toLowerCase());
}

/** Same signal the checklist uses — POA document on file or explicit poa_signed_at. */
export function hasSignedPoaOnRecord(opts: {
  poaSignedAt?: string | null;
  hasPoaDocument?: boolean;
}): boolean {
  return !!opts.hasPoaDocument || !!opts.poaSignedAt?.trim();
}

/** Sets poa_signed_at when a POA document lands; preserves an existing timestamp. */
export async function markPoaSignedOnClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({ poa_signed_at: new Date().toISOString() })
    .eq("id", clientId)
    .is("poa_signed_at", null);

  if (error) {
    console.warn("[markPoaSignedOnClient]", error.message);
  }
}

export const POA_STAGE_ADVANCE_TOAST =
  "POA saved — client advanced to Awaiting Collection Letter";

export const POA_AUTO_ADVANCE_FROM = ["welcome_packet", "client_services"] as const;

export function poaAdvanceAlreadyApplied(
  stageBefore: string,
  stageNow: string
): boolean {
  return (
    (POA_AUTO_ADVANCE_FROM as readonly string[]).includes(stageBefore) &&
    stageNow === "awaiting_collection_letter"
  );
}

export function shouldAttemptPoaAdvance(stageNow: string): boolean {
  return (POA_AUTO_ADVANCE_FROM as readonly string[]).includes(stageNow);
}

/** After a POA lands on Uploads: Account Manager or Client Services → Awaiting Collection Letter. */
export async function advanceClientAfterPoaUpload(
  supabase: SupabaseClient,
  clientId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("clients")
    .update({
      stage: "awaiting_collection_letter",
      stage_entered_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .in("stage", [...POA_AUTO_ADVANCE_FROM])
    .select("id")
    .maybeSingle();

  return !error && !!data;
}

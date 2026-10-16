import type { SupabaseClient } from "@supabase/supabase-js";
import {
  stageAfterCcAuthorizationUpload,
  stageAfterWelcomePacketUpload,
  WAITING_COLLECTION_STAGE,
} from "@/lib/workflow/document-stage-advance";

const POA_DOCUMENT_TYPES = new Set([
  "poa",
  "poa_document",
  "poa_signed",
  "power_of_attorney",
]);

export function isPoaDocumentType(documentType: string): boolean {
  return POA_DOCUMENT_TYPES.has(documentType.trim().toLowerCase());
}

/** POA document on file, or an explicit poa_signed_at. */
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
  "Welcome Packet saved — client advanced to Awaiting Collection Letter";

export const POA_AUTO_ADVANCE_FROM = ["lead", "account_manager", "client_services"] as const;

export function poaAdvanceAlreadyApplied(
  stageBefore: string,
  stageNow: string
): boolean {
  const from = stageBefore.trim();
  const now = stageNow.trim();
  if (from === "lead" && (now === "account_manager" || now === "awaiting_collection_letter")) {
    return true;
  }
  return (
    (from === "account_manager" || from === "client_services") &&
    now === "awaiting_collection_letter"
  );
}

export function shouldAttemptPoaAdvance(stageNow: string): boolean {
  return (POA_AUTO_ADVANCE_FROM as readonly string[]).includes(stageNow);
}

async function hasActiveDocumentType(
  supabase: SupabaseClient,
  clientId: string,
  documentType: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("client_id", clientId)
    .eq("document_type", documentType)
    .is("archived_at", null)
    .limit(1);
  if (error) {
    console.warn("[hasActiveDocumentType]", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

async function hasActiveWelcomePacket(
  supabase: SupabaseClient,
  clientId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("client_id", clientId)
    .in("document_type", Array.from(POA_DOCUMENT_TYPES))
    .is("archived_at", null)
    .limit(1);
  if (error) {
    console.warn("[hasActiveWelcomePacket]", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

async function moveClientStage(
  supabase: SupabaseClient,
  clientId: string,
  fromStage: string,
  toStage: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("clients")
    .update({
      stage: toStage,
      stage_entered_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("stage", fromStage)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

/**
 * Welcome Packet on file.
 * Client Services → Awaiting Collections.
 * Account Manager moves only when the credit card form is already on file.
 */
export async function advanceClientAfterPoaUpload(
  supabase: SupabaseClient,
  clientId: string
): Promise<boolean> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("stage")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !client) return false;
  const stage = String(client.stage ?? "");
  if (!shouldAttemptPoaAdvance(stage)) return false;

  const hasCc =
    stage === "client_services" ||
    (await hasActiveDocumentType(supabase, clientId, "cc_authorization"));
  const next = stageAfterWelcomePacketUpload(stage, hasCc);
  if (next !== WAITING_COLLECTION_STAGE) return false;
  return moveClientStage(supabase, clientId, stage, next);
}

/**
 * Credit card form on file, from Account Manager only.
 * Awaiting Collections when the Welcome Packet is already there.
 * Otherwise Client Services.
 */
export async function advanceClientAfterCcAuthUpload(
  supabase: SupabaseClient,
  clientId: string
): Promise<boolean> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("stage")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !client) return false;
  const stage = String(client.stage ?? "");
  const next = stageAfterCcAuthorizationUpload(
    stage,
    await hasActiveWelcomePacket(supabase, clientId)
  );
  if (!next) return false;
  return moveClientStage(supabase, clientId, stage, next);
}

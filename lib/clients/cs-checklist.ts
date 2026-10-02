import type { SupabaseClient } from "@supabase/supabase-js";
import { POA_DOCUMENT_TYPES } from "@/lib/clients/checklist-auto-state";
import { hasSignedPoaOnRecord } from "@/lib/clients/poa-upload-advance";

/**
 * Client Services checklist — the four steps behind the admin/services Priority
 * board. Stored in `onboarding_checklist` under `phase = 'client_services'`,
 * separate from the legacy onboarding rows that the DB triggers drive.
 *
 * A "1 Month Followup" item was retired here: services reps already have
 * appointments for that contact, so tracking it twice only invited the two to
 * disagree. Retired rows are dropped in 20260811060000_cs_checklist_drop_one_month.
 */
export const CS_CHECKLIST_PHASE = "client_services";

export type CsChecklistItemKey =
  | "cs_intro"
  | "tracking_update"
  | "packet_update"
  | "poa_on_file";

/** Workflow order. The board renders columns in exactly this sequence. */
export const CS_CHECKLIST_ITEMS = [
  { key: "cs_intro", label: "CS Intro" },
  { key: "tracking_update", label: "Tracking Update" },
  { key: "packet_update", label: "Packet Update" },
  { key: "poa_on_file", label: "POA on File" },
] as const satisfies readonly { key: CsChecklistItemKey; label: string }[];

export const CS_CHECKLIST_ITEM_KEYS = CS_CHECKLIST_ITEMS.map((i) => i.key);

export const CS_CHECKLIST_TOTAL = CS_CHECKLIST_ITEMS.length;

export function csChecklistItemLabel(key: string): string {
  return CS_CHECKLIST_ITEMS.find((i) => i.key === key)?.label ?? key;
}

/** Signals that satisfy an item without anyone ticking it. */
export type CsChecklistAutoContext = {
  hasPoaDocument: boolean;
  poa_signed_at: string | null;
};

/**
 * Only POA on File derives itself, from the same signals the legacy
 * "Signed POA Received" item uses, so the two can never disagree. The other
 * three are manual by design.
 */
export function isCsItemAutoChecked(
  key: CsChecklistItemKey,
  ctx: CsChecklistAutoContext
): boolean {
  if (key !== "poa_on_file") return false;
  return hasSignedPoaOnRecord({
    hasPoaDocument: ctx.hasPoaDocument,
    poaSignedAt: ctx.poa_signed_at,
  });
}

/**
 * The POA values that actually exist on the Postgres `document_type` enum, so
 * they are safe to pass to a `.in()` filter. `poa` and `power_of_attorney` are
 * recognized by POA_DOCUMENT_TYPES for reading legacy strings, but no row can
 * hold them — the column is an enum, and filtering on a non-member raises
 * "invalid input value for enum document_type".
 */
export const POA_DOCUMENT_TYPES_IN_ENUM = ["poa_document", "poa_signed"] as const;

export function isPoaDocumentTypeForCs(documentType: string | null | undefined): boolean {
  return POA_DOCUMENT_TYPES.has((documentType ?? "").trim().toLowerCase());
}

export type CsChecklistRow = {
  completed: boolean | null;
  bypassed: boolean | null;
};

export type CsItemState = {
  key: CsChecklistItemKey;
  label: string;
  complete: boolean;
  autoChecked: boolean;
  manualChecked: boolean;
  bypassed: boolean;
};

/** Mirrors getChecklistItemVisualState so both checklists read the same way. */
export function getCsItemState(
  key: CsChecklistItemKey,
  row: CsChecklistRow | undefined,
  ctx: CsChecklistAutoContext
): CsItemState {
  const bypassed = !!row?.bypassed;
  const manualChecked = !!row?.completed && !bypassed;
  const autoChecked =
    !bypassed && !manualChecked && isCsItemAutoChecked(key, ctx);

  return {
    key,
    label: csChecklistItemLabel(key),
    complete: bypassed || manualChecked || autoChecked,
    autoChecked,
    manualChecked,
    bypassed,
  };
}

export type CsChecklistSummary = {
  states: CsItemState[];
  completeCount: number;
  incompleteCount: number;
  /** First outstanding item in workflow order — the actual next action. */
  nextUp: CsItemState | null;
};

export function summarizeCsChecklist(
  rowsByKey: Partial<Record<CsChecklistItemKey, CsChecklistRow>>,
  ctx: CsChecklistAutoContext
): CsChecklistSummary {
  const states = CS_CHECKLIST_ITEMS.map((item) =>
    getCsItemState(item.key, rowsByKey[item.key], ctx)
  );
  const completeCount = states.filter((s) => s.complete).length;

  return {
    states,
    completeCount,
    incompleteCount: states.length - completeCount,
    nextUp: states.find((s) => !s.complete) ?? null,
  };
}

/**
 * Inserts any missing client_services rows for this client. Follows
 * ensureChecklistItems, but relies on the unique index on
 * (client_id, item_key) rather than a read-then-write race.
 *
 * Pass a service-role client when calling outside a staff request context.
 */
export async function ensureCsChecklistItems(
  supabase: SupabaseClient,
  clientId: string
): Promise<void> {
  const { error } = await supabase.from("onboarding_checklist").upsert(
    CS_CHECKLIST_ITEMS.map((item) => ({
      client_id: clientId,
      item: item.label,
      item_key: item.key,
      phase: CS_CHECKLIST_PHASE,
    })),
    { onConflict: "client_id,item_key", ignoreDuplicates: true }
  );

  if (error) {
    console.error("[ensureCsChecklistItems]", error.message);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { PIPELINE_STAGE_ORDER } from "@/lib/constants/stages";
import {
  CS_CHECKLIST_PHASE,
  summarizeCsChecklist,
  type CsChecklistItemKey,
  type CsChecklistRow,
  type CsItemState,
} from "@/lib/clients/cs-checklist";

/** A checklist item plus the "who and when" the profile card shows. */
export type CsChecklistCardItem = CsItemState & {
  completedAt: string | null;
  completedByName: string | null;
};

export type CsChecklistCardData = {
  items: CsChecklistCardItem[];
  completeCount: number;
  nextUpLabel: string | null;
  /** False for a client who has never had a client_services row written. */
  hasAnyRow: boolean;
};

const CS_STAGE_INDEX = PIPELINE_STAGE_ORDER.indexOf("client_services");

/**
 * Whether the client profile should carry the Client Services card.
 *
 * The card stays on after the client leaves the stage: POA on File usually
 * lands during Awaiting Collections and the one month followup is later still,
 * so hiding it at stage exit would hide exactly the items that finish last.
 * Clients who never reached Services have nothing to show, so leads and the
 * earlier stages get no card unless a row already exists (a client bounced back
 * to Retention keeps their progress visible).
 */
export function shouldShowCsChecklistCard(
  stage: string | null,
  hasAnyRow: boolean
): boolean {
  if (hasAnyRow) return true;
  const index = (PIPELINE_STAGE_ORDER as readonly string[]).indexOf(stage ?? "");
  return index >= 0 && index >= CS_STAGE_INDEX;
}

/**
 * Client Services checklist state for one client, shaped for the profile
 * sidebar. Mirrors fetchPriorityBoard so a client reads the same in both
 * places; the POA signals are passed in because the profile page has already
 * loaded the documents it needs to derive them.
 */
export async function fetchCsChecklistForClient(
  supabase: SupabaseClient,
  params: {
    clientId: string;
    poaSignedAt: string | null;
    hasPoaDocument: boolean;
  }
): Promise<CsChecklistCardData> {
  const { data, error } = await supabase
    .from("onboarding_checklist")
    .select("item_key, completed, bypassed, completed_at, completed_by")
    .eq("client_id", params.clientId)
    .eq("phase", CS_CHECKLIST_PHASE);

  if (error) {
    console.error("[fetchCsChecklistForClient]", error.message);
  }

  const rows = data ?? [];
  const rowsByKey: Partial<Record<CsChecklistItemKey, CsChecklistRow>> = {};
  const detailByKey = new Map<
    string,
    { completedAt: string | null; completedBy: string | null }
  >();

  for (const row of rows) {
    const key = row.item_key as CsChecklistItemKey | null;
    if (!key) continue;
    rowsByKey[key] = {
      completed: row.completed as boolean | null,
      bypassed: row.bypassed as boolean | null,
    };
    detailByKey.set(key, {
      completedAt: (row.completed_at as string | null) ?? null,
      completedBy: (row.completed_by as string | null) ?? null,
    });
  }

  const summary = summarizeCsChecklist(rowsByKey, {
    hasPoaDocument: params.hasPoaDocument,
    poa_signed_at: params.poaSignedAt,
  });

  const completerIds = Array.from(
    new Set(
      Array.from(detailByKey.values())
        .map((d) => d.completedBy)
        .filter((v): v is string => !!v)
    )
  );

  const nameById = new Map<string, string>();
  if (completerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", completerIds);
    for (const p of profiles ?? []) {
      const name = (p.full_name as string | null)?.trim();
      if (name) nameById.set(p.id as string, name);
    }
  }

  const items: CsChecklistCardItem[] = summary.states.map((state) => {
    const detail = detailByKey.get(state.key);
    const completedBy = detail?.completedBy ?? null;

    // Only a hand-ticked item has a meaningful actor and timestamp; an
    // auto-filled POA was never ticked by anyone.
    return {
      ...state,
      completedAt: state.manualChecked ? detail?.completedAt ?? null : null,
      completedByName:
        state.manualChecked && completedBy
          ? nameById.get(completedBy) ?? null
          : null,
    };
  });

  return {
    items,
    completeCount: summary.completeCount,
    nextUpLabel: summary.nextUp?.label ?? null,
    hasAnyRow: rows.length > 0,
  };
}

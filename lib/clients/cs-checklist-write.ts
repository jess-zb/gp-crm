import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CS_CHECKLIST_ITEM_KEYS,
  CS_CHECKLIST_PHASE,
  csChecklistItemLabel,
  type CsChecklistItemKey,
} from "@/lib/clients/cs-checklist";

export function isCsChecklistItemKey(value: string): value is CsChecklistItemKey {
  return (CS_CHECKLIST_ITEM_KEYS as readonly string[]).includes(value);
}

/**
 * Marks one Client Services item complete or incomplete across one or more
 * clients.
 *
 * Uses upsert rather than update so clients who reached Client Services after
 * the seeding migration still get a row on first tick. Each client gets its own
 * audit_log entry so per-client history stays accurate even for a bulk action.
 */
export async function writeCsChecklistItem(
  supabase: SupabaseClient,
  params: {
    clientIds: string[];
    itemKey: CsChecklistItemKey;
    complete: boolean;
    actorId: string;
    actorName: string;
  }
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { clientIds, itemKey, complete, actorId, actorName } = params;
  const ids = Array.from(new Set(clientIds.filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: "No clients selected." };

  const now = new Date().toISOString();
  const label = csChecklistItemLabel(itemKey);

  const { error } = await supabase.from("onboarding_checklist").upsert(
    ids.map((clientId) => ({
      client_id: clientId,
      item: label,
      item_key: itemKey,
      phase: CS_CHECKLIST_PHASE,
      completed: complete,
      completed_at: complete ? now : null,
      completed_by: complete ? actorId : null,
    })),
    { onConflict: "client_id,item_key" }
  );

  if (error) {
    console.error("[writeCsChecklistItem]", error.message);
    return { ok: false, error: error.message };
  }

  // The activity feed already renders `checklist_completed`; nothing emitted it
  // before this board existed.
  const { error: auditErr } = await supabase.from("audit_log").insert(
    ids.map((clientId) => ({
      client_id: clientId,
      action: complete ? "checklist_completed" : "checklist_uncompleted",
      new_value: { item: label, item_key: itemKey, phase: CS_CHECKLIST_PHASE },
      performed_by: actorId,
      performed_by_name: actorName,
    }))
  );

  if (auditErr) {
    // The tick itself succeeded; losing the audit row should not fail the action.
    console.error("[writeCsChecklistItem] audit", auditErr.message);
  }

  return { ok: true, count: ids.length };
}

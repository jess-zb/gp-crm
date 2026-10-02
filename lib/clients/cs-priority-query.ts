import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CS_CHECKLIST_PHASE,
  POA_DOCUMENT_TYPES_IN_ENUM,
  isPoaDocumentTypeForCs,
  summarizeCsChecklist,
  type CsChecklistItemKey,
  type CsChecklistRow,
  type CsItemState,
} from "@/lib/clients/cs-checklist";
import { comparePriority } from "@/lib/clients/cs-priority-sort";

/**
 * Guard rail rather than paging. The board is scoped to a single stage, so the
 * working set is small; if it ever exceeds this the count is surfaced so the
 * view can say so instead of silently truncating.
 */
const MAX_BOARD_ROWS = 1000;

export type PriorityBoardRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  displayName: string;
  stage_entered_at: string | null;
  daysInStage: number | null;
  assigneeName: string | null;
  servicesUserName: string | null;
  states: CsItemState[];
  completeCount: number;
  incompleteCount: number;
};

export type PriorityBoardResult = {
  rows: PriorityBoardRow[];
  truncated: boolean;
  error: string | null;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/**
 * Client Services clients with their checklist state, in the board's default
 * order: see `comparePriority`. The board can be re-sorted on screen, so this
 * is the starting point rather than the only order the rows are ever seen in.
 */
export async function fetchPriorityBoard(
  supabase: SupabaseClient
): Promise<PriorityBoardResult> {
  const { data: clientRows, error: clientErr } = await supabase
    .from("clients")
    .select(
      "id, first_name, last_name, stage_entered_at, poa_signed_at, assigned_to, assigned_services_id"
    )
    .eq("stage", "client_services")
    .eq("is_active", true)
    .limit(MAX_BOARD_ROWS + 1);

  if (clientErr) {
    console.error("[fetchPriorityBoard] clients", clientErr.message);
    return { rows: [], truncated: false, error: clientErr.message };
  }

  const truncated = (clientRows?.length ?? 0) > MAX_BOARD_ROWS;
  const clients = (clientRows ?? []).slice(0, MAX_BOARD_ROWS);
  if (clients.length === 0) {
    return { rows: [], truncated: false, error: null };
  }

  const clientIds = clients.map((c) => c.id as string);

  const [checklistRes, poaDocRes, profileRes] = await Promise.all([
    supabase
      .from("onboarding_checklist")
      .select("client_id, item_key, completed, bypassed")
      .eq("phase", CS_CHECKLIST_PHASE)
      .in("client_id", clientIds),
    supabase
      .from("documents")
      .select("client_id, document_type")
      .in("client_id", clientIds)
      .in("document_type", POA_DOCUMENT_TYPES_IN_ENUM),
    (async () => {
      const ids = Array.from(
        new Set(
          clients.flatMap((c) =>
            [c.assigned_to, c.assigned_services_id].filter(
              (v): v is string => typeof v === "string" && v.length > 0
            )
          )
        )
      );
      if (ids.length === 0) return { data: [], error: null };
      return supabase.from("profiles").select("id, full_name").in("id", ids);
    })(),
  ]);

  if (checklistRes.error) {
    console.error("[fetchPriorityBoard] checklist", checklistRes.error.message);
    return { rows: [], truncated, error: checklistRes.error.message };
  }

  const rowsByClient = new Map<
    string,
    Partial<Record<CsChecklistItemKey, CsChecklistRow>>
  >();
  for (const row of checklistRes.data ?? []) {
    const clientId = row.client_id as string;
    const key = row.item_key as CsChecklistItemKey | null;
    if (!key) continue;
    const bucket = rowsByClient.get(clientId) ?? {};
    bucket[key] = {
      completed: row.completed as boolean | null,
      bypassed: row.bypassed as boolean | null,
    };
    rowsByClient.set(clientId, bucket);
  }

  const poaClientIds = new Set<string>();
  for (const doc of poaDocRes.data ?? []) {
    if (isPoaDocumentTypeForCs(doc.document_type as string | null)) {
      poaClientIds.add(doc.client_id as string);
    }
  }

  const nameById = new Map<string, string>();
  for (const p of profileRes.data ?? []) {
    const name = (p.full_name as string | null)?.trim();
    if (name) nameById.set(p.id as string, name);
  }

  const rows: PriorityBoardRow[] = clients.map((c) => {
    const clientId = c.id as string;
    const summary = summarizeCsChecklist(rowsByClient.get(clientId) ?? {}, {
      hasPoaDocument: poaClientIds.has(clientId),
      poa_signed_at: (c.poa_signed_at as string | null) ?? null,
    });
    const first = (c.first_name as string | null) ?? "";
    const last = (c.last_name as string | null) ?? "";

    return {
      id: clientId,
      first_name: first || null,
      last_name: last || null,
      displayName: `${first} ${last}`.trim() || "—",
      stage_entered_at: (c.stage_entered_at as string | null) ?? null,
      daysInStage: daysSince((c.stage_entered_at as string | null) ?? null),
      assigneeName: c.assigned_to
        ? nameById.get(c.assigned_to as string) ?? null
        : null,
      servicesUserName: c.assigned_services_id
        ? nameById.get(c.assigned_services_id as string) ?? null
        : null,
      states: summary.states,
      completeCount: summary.completeCount,
      incompleteCount: summary.incompleteCount,
    };
  });

  // The board arrives in priority order; the client component re-sorts in place
  // when someone picks a column, using this same comparator as its tie-break.
  rows.sort(comparePriority);

  return { rows, truncated, error: null };
}
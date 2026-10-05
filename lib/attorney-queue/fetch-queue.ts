import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attorneyBatchDocKind,
  isAttorneyBatchEligibleDocument,
} from "@/lib/attorney-queue/tokens";

export type AttorneyQueueDoc = {
  id: string;
  file_name: string;
  document_type: string | null;
  is_collection_letter: boolean;
  kind: "poa" | "collection_letter" | "other";
  created_at: string | null;
};

export type AttorneyQueueClient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  attorney_id: string | null;
  attorney_name: string | null;
  case_sent_to_attorney_at: string | null;
  documents: AttorneyQueueDoc[];
};

export type AttorneyOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type AttorneyAssignmentHistoryRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  attorney_name: string | null;
  assigned_at: string;
  assigned_by_name: string | null;
};

/**
 * Clients in case_sent_to_attorneys not yet released to the attorney portal.
 */
export async function fetchAttorneyQueue(
  supabase: SupabaseClient
): Promise<{ clients: AttorneyQueueClient[]; error: string | null }> {
  const { data: clients, error: clientErr } = await supabase
    .from("clients")
    .select(
      "id, first_name, last_name, email, attorney_id, case_sent_to_attorney_at, stage_entered_at"
    )
    .eq("stage", "case_sent_to_attorneys")
    .is("attorney_portal_assigned_at", null)
    .order("case_sent_to_attorney_at", { ascending: true, nullsFirst: false });

  if (clientErr) {
    return { clients: [], error: clientErr.message };
  }

  const ready = clients ?? [];
  if (ready.length === 0) {
    return { clients: [], error: null };
  }

  ready.sort((a, b) => {
    const aSent =
      (a.case_sent_to_attorney_at as string | null) ||
      (a.stage_entered_at as string | null) ||
      "";
    const bSent =
      (b.case_sent_to_attorney_at as string | null) ||
      (b.stage_entered_at as string | null) ||
      "";
    if (aSent !== bSent) return aSent.localeCompare(bSent);
    const aName = `${a.last_name ?? ""} ${a.first_name ?? ""}`.toLowerCase();
    const bName = `${b.last_name ?? ""} ${b.first_name ?? ""}`.toLowerCase();
    return aName.localeCompare(bName);
  });

  const clientIds = ready.map((c) => c.id as string);
  const attorneyIds = Array.from(
    new Set(
      ready
        .map((c) => c.attorney_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  );

  const attorneyNameById = new Map<string, string>();
  if (attorneyIds.length > 0) {
    const { data: attorneys, error: attyErr } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", attorneyIds);
    if (attyErr) {
      console.error("[attorney-queue] attorney names error:", attyErr.message);
    } else {
      for (const a of attorneys ?? []) {
        const name =
          (a.full_name as string | null)?.trim() ||
          (a.email as string | null)?.trim() ||
          "Attorney";
        attorneyNameById.set(a.id as string, name);
      }
    }
  }

  const { data: docs, error: docErr } = await supabase
    .from("documents")
    .select(
      "id, client_id, file_name, document_type, is_collection_letter, created_at"
    )
    .in("client_id", clientIds)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (docErr) {
    return { clients: [], error: docErr.message };
  }

  const docsByClient = new Map<string, AttorneyQueueDoc[]>();
  for (const d of docs ?? []) {
    if (
      !isAttorneyBatchEligibleDocument({
        document_type: d.document_type as string | null,
        is_collection_letter: d.is_collection_letter as boolean | null,
      })
    ) {
      continue;
    }
    const clientId = d.client_id as string;
    const list = docsByClient.get(clientId) ?? [];
    list.push({
      id: d.id as string,
      file_name: (d.file_name as string) || "file",
      document_type: (d.document_type as string | null) ?? null,
      is_collection_letter: Boolean(d.is_collection_letter),
      kind: attorneyBatchDocKind({
        document_type: d.document_type as string | null,
        is_collection_letter: d.is_collection_letter as boolean | null,
      }),
      created_at: (d.created_at as string | null) ?? null,
    });
    docsByClient.set(clientId, list);
  }

  const result: AttorneyQueueClient[] = ready.map((c) => {
    const id = c.id as string;
    const attorneyId = (c.attorney_id as string | null) ?? null;
    return {
      id,
      first_name: (c.first_name as string | null) ?? null,
      last_name: (c.last_name as string | null) ?? null,
      email: (c.email as string | null) ?? null,
      attorney_id: attorneyId,
      attorney_name: attorneyId
        ? attorneyNameById.get(attorneyId) ?? null
        : null,
      case_sent_to_attorney_at:
        (c.case_sent_to_attorney_at as string | null) ??
        (c.stage_entered_at as string | null) ??
        null,
      documents: docsByClient.get(id) ?? [],
    } satisfies AttorneyQueueClient;
  });

  return { clients: result, error: null };
}

export async function fetchAttorneyOptions(
  supabase: SupabaseClient
): Promise<{ attorneys: AttorneyOption[]; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "attorney")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    return { attorneys: [], error: error.message };
  }

  return {
    attorneys: (data ?? []).map((a) => ({
      id: a.id as string,
      full_name: (a.full_name as string | null) ?? null,
      email: (a.email as string | null) ?? null,
    })),
    error: null,
  };
}

export async function fetchAttorneyAssignmentHistory(
  supabase: SupabaseClient,
  limit = 25
): Promise<{ rows: AttorneyAssignmentHistoryRow[]; error: string | null }> {
  const { data: clients, error } = await supabase
    .from("clients")
    .select(
      `
      id,
      first_name,
      last_name,
      attorney_portal_assigned_at,
      attorney_portal_assigned_by,
      attorney_id,
      attorney_portal_attorney_name,
      attorney:profiles!clients_attorney_id_fkey(full_name, email),
      assigner:profiles!clients_attorney_portal_assigned_by_fkey(full_name, email)
    `
    )
    .not("attorney_portal_assigned_at", "is", null)
    .order("attorney_portal_assigned_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows = clients ?? [];
  if (rows.length === 0) return { rows: [], error: null };

  function profileLabel(
    profile:
      | { full_name?: string | null; email?: string | null }
      | { full_name?: string | null; email?: string | null }[]
      | null
      | undefined
  ): string | null {
    const row = Array.isArray(profile) ? profile[0] : profile;
    if (!row) return null;
    return row.full_name?.trim() || row.email?.trim() || null;
  }

  // Fallback for older rows that were stamped assigned without attorney_id /
  // attorney_portal_attorney_name (legacy batch backfill).
  const missingNameIds = rows
    .filter((r) => {
      const stamped = String(r.attorney_portal_attorney_name ?? "").trim();
      if (stamped) return false;
      return !profileLabel(
        r.attorney as
          | { full_name?: string | null; email?: string | null }
          | null
      );
    })
    .map((r) => r.id as string);

  const auditNameByClientId = new Map<string, string>();
  if (missingNameIds.length > 0) {
    const { data: audits, error: auditErr } = await supabase
      .from("audit_log")
      .select("client_id, new_value, created_at")
      .eq("action", "attorney_portal_assigned")
      .in("client_id", missingNameIds)
      .order("created_at", { ascending: false });

    if (auditErr) {
      console.error(
        "[attorney-queue] assignment audit fallback:",
        auditErr.message
      );
    } else {
      for (const a of audits ?? []) {
        const clientId = a.client_id as string | null;
        if (!clientId || auditNameByClientId.has(clientId)) continue;
        const raw = a.new_value as { attorney_name?: unknown } | null;
        const name =
          typeof raw?.attorney_name === "string"
            ? raw.attorney_name.trim()
            : "";
        if (name) auditNameByClientId.set(clientId, name);
      }
    }
  }

  return {
    rows: rows.map((r) => {
      const id = r.id as string;
      const stamped = String(r.attorney_portal_attorney_name ?? "").trim();
      const fromJoin = profileLabel(
        r.attorney as
          | { full_name?: string | null; email?: string | null }
          | null
      );
      return {
        id,
        first_name: (r.first_name as string | null) ?? null,
        last_name: (r.last_name as string | null) ?? null,
        attorney_name:
          stamped || fromJoin || auditNameByClientId.get(id) || null,
        assigned_at: r.attorney_portal_assigned_at as string,
        assigned_by_name:
          profileLabel(
            r.assigner as
              | { full_name?: string | null; email?: string | null }
              | null
          ) || "Staff",
      };
    }),
    error: null,
  };
}

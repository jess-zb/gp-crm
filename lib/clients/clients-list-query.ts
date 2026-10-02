import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSearchQuery } from "@/lib/clients/client-search";

/** Columns needed for the CRM clients table + search OR targets. */
export const CLIENT_LIST_SELECT =
  "id, first_name, last_name, nickname, secondary_first_name, spouse_first_name, spouse_last_name, spouse_name, email, phone, phone_mobile, phone_work, phone_home, street_address, city, zip_code, stage, is_active, created_at, stage_entered_at, assigned_to, assigned_compliance_id, assigned_services_id, dnc_reason";

const TERMINAL_STAGES = "(dnc,not_interested,dnq,mortgage,closed)";

export type ClientsListTab = "all" | "active" | "archives";

export type ClientsListSortField =
  | "active"
  | "created_at"
  | "last_name"
  | "phone_mobile"
  | "email"
  | "stage"
  | "assignee_name"
  | "days_in_stage";

/** Build `.or(...)` fragment for multi-column search (comma-separated OR conditions). */
export function clientsSearchOrFilter(searchTrimmed: string): string {
  return buildSearchQuery(searchTrimmed);
}

export interface ClientListRow extends Record<string, unknown> {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  secondary_first_name: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  spouse_name: string | null;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  phone_work: string | null;
  phone_home: string | null;
  street_address: string | null;
  city: string | null;
  zip_code: string | null;
  stage: string | null;
  is_active: boolean | null;
  created_at: string | null;
  stage_entered_at: string | null;
  assigned_to: string | null;
  assigned_compliance_id: string | null;
  assigned_services_id: string | null;
  dnc_reason: string | null;
}

export type FetchClientsListPageParams = {
  teamUserId: string | null;
  tab: ClientsListTab;
  search: string;
  page: number;
  pageSize: number;
  sortField: ClientsListSortField;
  sortDir: "asc" | "desc";
};

export async function fetchClientsListPage(
  supabase: SupabaseClient,
  params: FetchClientsListPageParams
): Promise<{
  rows: ClientListRow[];
  totalCount: number;
  error: string | null;
}> {
  const { teamUserId, tab, search, page, pageSize, sortField, sortDir } = params;
  const startedAt = Date.now();
  const pageSafe = Math.max(1, page);
  const sizeSafe = Math.min(500, Math.max(1, pageSize));
  const from = (pageSafe - 1) * sizeSafe;
  const to = from + sizeSafe - 1;

  let q = supabase.from("clients").select(CLIENT_LIST_SELECT, { count: "exact" });
  if (teamUserId) {
    q = q.eq("assigned_to", teamUserId);
  }

  const qSearch = search.trim();

  // A search spans every client regardless of tab, with no created-date floor.
  // The tab filters do not partition the client set: a client with
  // is_active = true in a terminal stage is excluded from both `active` and
  // `archives`, so scoping search to a tab would make those records
  // unreachable once the `all` tab is hidden.
  if (!qSearch) {
    if (tab === "all") {
      q = q.gte("created_at", "2026-06-02T00:00:00+00:00");
    } else if (tab === "active") {
      q = q.eq("is_active", true).not("stage", "in", TERMINAL_STAGES);
    } else if (tab === "archives") {
      q = q.eq("is_active", false).gte("created_at", "2026-06-02T00:00:00+00:00");
    }
  }

  if (qSearch) {
    const frag = clientsSearchOrFilter(qSearch);
    if (frag) {
      q = q.or(frag);
    }
  }

  const asc = sortDir === "asc";
  switch (sortField) {
    case "last_name":
      q = q
        .order("last_name", { ascending: asc, nullsFirst: false })
        .order("first_name", { ascending: asc, nullsFirst: false });
      break;
    case "created_at":
      q = q.order("created_at", { ascending: asc, nullsFirst: false });
      break;
    case "phone_mobile":
      q = q.order("phone_mobile", { ascending: asc, nullsFirst: false });
      break;
    case "email":
      q = q.order("email", { ascending: asc, nullsFirst: false });
      break;
    case "stage":
      q = q.order("stage", { ascending: asc, nullsFirst: false });
      break;
    case "assignee_name":
      q = q.order("assigned_to", { ascending: asc, nullsFirst: false });
      break;
    case "days_in_stage":
      q = q
        .order("stage_entered_at", { ascending: asc, nullsFirst: false })
        .order("created_at", { ascending: asc, nullsFirst: false });
      break;
    case "active":
      q = q.order("is_active", { ascending: asc, nullsFirst: false });
      break;
    default:
      q = q.order("created_at", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error, count } = await q.range(from, to);

  console.info(
    `[perf] fetchClientsListPage ${Date.now() - startedAt}ms ${error ? "error" : "ok"} tab=${tab} search=${qSearch ? "yes" : "no"} rows=${data?.length ?? 0} count=${count ?? 0}`
  );

  if (error) {
    console.error("[fetchClientsListPage]", error.message);
    return { rows: [], totalCount: 0, error: error.message };
  }

  return {
    rows: (data ?? []) as unknown as ClientListRow[],
    totalCount: count ?? 0,
    error: null,
  };
}

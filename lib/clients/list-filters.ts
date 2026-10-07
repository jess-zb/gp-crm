import { buildSearchQuery, normalizeStr } from "@/lib/clients/client-search";

export type ClientListOpts = {
  tab: string;
  q: string;
  teamUserId: string | null;
};

/** Supabase `.or()` fragment for tab/team only (no search). */
export function applyClientListFiltersWithoutSearch<
  Q extends {
    eq(column: string, value: unknown): Q;
    or(filter: string): Q;
  },
>(q: Q, opts: Pick<ClientListOpts, "tab" | "teamUserId">): Q {
  let query = q;
  if (opts.teamUserId) {
    query = query.eq("assigned_to", opts.teamUserId);
  }
  if (opts.tab === "active") {
    query = query.eq("is_active", true);
  } else if (opts.tab === "inactive") {
    query = query.eq("is_active", false);
  } else if (opts.tab === "archived") {
    query = query.eq("is_active", false);
  } else {
    query = query.eq("is_active", true);
  }
  return query;
}

/** Broader PostgREST search when full fuzzy matching is not applied (e.g. export-only). */
function applyClientSearchSqlOr<
  Q extends {
    or(filter: string): Q;
  },
>(query: Q, qRaw: string): Q {
  const raw = normalizeStr(qRaw);
  if (!raw) return query;
  const frag = buildSearchQuery(raw);
  if (!frag) return query;
  return query.or(frag);
}

/** Pipeline board: team assignment + active clients OR closed-stage (archived) cases. */
export function applyPipelineFilters<
  Q extends {
    eq(column: string, value: unknown): Q;
    or(filter: string): Q;
  },
>(q: Q, teamUserId: string | null): Q {
  let query = q;
  if (teamUserId) {
    query = query.eq("assigned_to", teamUserId);
  }
  query = query.or("is_active.eq.true,stage.eq.closed");
  return query;
}

/** Filter chain for `clients` list queries. */
export function applyClientListFilters<
  Q extends {
    eq(column: string, value: unknown): Q;
    or(filter: string): Q;
  },
>(q: Q, opts: ClientListOpts): Q {
  let query = applyClientListFiltersWithoutSearch(q, opts);
  if (opts.q?.trim()) {
    query = applyClientSearchSqlOr(query, opts.q.trim());
  }
  return query;
}

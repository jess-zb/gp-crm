import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import {
  fetchClientsListPage,
  type ClientsListSortField,
  type ClientsListTab,
} from "@/lib/clients/clients-list-query";
import { fetchTabCounts } from "@/lib/clients/tab-counts";
import {
  canAccessRefundQueue,
  canExportClientsCsv,
  canSeeAllClientsTab,
  isDev,
  scopedAssigneeUserId,
} from "@/lib/roles";
import {
  buildClientsHref,
  defaultClientsTab,
  isClientsListTab,
  parseClientsTab,
  type ClientsPageTab,
} from "@/lib/clients/clients-tabs";
import { ClientsListClient, type ClientsListItem } from "./ClientsListClient";
import {
  fetchPendingRefundCount,
  fetchRefundsQueue,
} from "@/lib/refunds/refunds-query";
import { RefundsQueueClient } from "./RefundsQueueClient";
import { toUserFacingError } from "@/lib/user-facing-error";
import { isHiddenProfile } from "@/lib/constants/hidden-accounts";
import { midNameFromEmbed } from "@/lib/mids/queries";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500] as const;

const SORT_FIELDS: ClientsListSortField[] = [
  "active",
  "created_at",
  "last_name",
  "phone_mobile",
  "email",
  "stage",
  "assignee_name",
  "days_in_stage",
];

type SearchParams = {
  tab?: string;
  page?: string;
  q?: string;
  size?: string;
  sort?: string;
  dir?: string;
};


function parsePageSize(raw: string | undefined): number {
  const n = parseInt(raw ?? "25", 10);
  return PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]) ? n : 25;
}

function parseSortField(raw: string | undefined): ClientsListSortField {
  const v = (raw ?? "created_at").trim();
  return SORT_FIELDS.includes(v as ClientsListSortField) ? (v as ClientsListSortField) : "created_at";
}

function parseSortDir(raw: string | undefined): "asc" | "desc" {
  return raw === "asc" ? "asc" : "desc";
}

/** Header and breadcrumb shared by every Clients tab. */
function ClientsPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Clients">
        <Link href="/clients/new" className="crm-btn-primary">
          Add New Client
        </Link>
      </CrmPageHeader>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-5">
        <nav className="text-[13px] text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                href="/dashboard"
                className="font-medium text-[#A87830] hover:text-[#8C6428] dark:text-[#A87830] dark:hover:text-[#C4A15A]"
              >
                Dashboard
              </Link>
            </li>
            <li className="text-slate-400" aria-hidden>
              /
            </li>
            <li className="font-medium text-slate-800 dark:text-slate-200">Clients</li>
          </ol>
        </nav>
        {children}
      </main>
    </div>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The (crm) layout has already ensured the profile row exists before this
  // page renders.
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  if (profile.role === "client") redirect("/portal");
  if (profile.role === "attorney") redirect("/attorney/cases");

  // The Priority tab is gone. Old bookmarks must not keep a dead query param.
  if (searchParams.tab === "priority") {
    redirect(buildClientsHref({ tab: defaultClientsTab(profile.role) }));
  }

  try {
    const requestedTab: ClientsPageTab = parseClientsTab(searchParams.tab, profile.role);
    const search = (searchParams.q ?? "").trim();
    const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
    const pageSize = parsePageSize(searchParams.size);
    const sortField = parseSortField(searchParams.sort);
    const sortDir = parseSortDir(searchParams.dir);

    const teamUserId = scopedAssigneeUserId(profile.role, user.id);

    // Same badges on every tab, so the row does not change shape as you move
    // across it; a tab this role cannot open costs no query.
    const countOptions = {
      includeAll: canSeeAllClientsTab(profile.role),
    };

    if (requestedTab === "refunds") {
      const [queue, counts] = await Promise.all([
        fetchRefundsQueue(supabase),
        fetchTabCounts(supabase, teamUserId, countOptions),
      ]);

      return (
        <ClientsPageShell>
          <ErrorBoundary>
            <RefundsQueueClient
              queue={queue}
              counts={{ ...counts, refunds: queue.pendingCount }}
              role={profile.role}
              isDevViewer={isDev(profile.role)}
            />
          </ErrorBoundary>
        </ClientsPageShell>
      );
    }

    // Only dev and admin see the Refunds tab, so the badge query is skipped for
    // everyone else.
    const pendingRefundCount = canAccessRefundQueue(profile.role)
      ? fetchPendingRefundCount(supabase)
      : Promise.resolve(undefined);

    const tab: ClientsListTab = isClientsListTab(requestedTab)
      ? requestedTab
      : "active";

    const [pageResult, baseTabCounts, refunds] = await Promise.all([
      fetchClientsListPage(supabase, {
        teamUserId,
        tab,
        search,
        page,
        pageSize,
        sortField,
        sortDir,
      }),
      fetchTabCounts(supabase, teamUserId, countOptions),
      pendingRefundCount,
    ]);

    const tabCounts = { ...baseTabCounts, refunds };

    if (pageResult.error) {
      return (
        <main className="mx-auto max-w-7xl px-6 py-8">
          <p className="text-sm text-red-600">{pageResult.error}</p>
        </main>
      );
    }

    const totalCount = pageResult.totalCount;
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (totalCount > 0 && page > maxPage) {
      const p = new URLSearchParams();
      if (tab !== "all") p.set("tab", tab);
      p.set("page", String(maxPage));
      if (search) p.set("q", search);
      if (pageSize !== 25) p.set("size", String(pageSize));
      if (sortField !== "created_at") p.set("sort", sortField);
      if (sortDir !== "desc") p.set("dir", sortDir);
      redirect(`/clients?${p.toString()}`);
    }

    const rawRows = pageResult.rows;

    const assigneeIds = Array.from(
      new Set(
        rawRows.flatMap((c) =>
          [c.assigned_to, c.assigned_services_id].filter(
            (id): id is string => Boolean(id)
          )
        )
      )
    );

    const nameByAssignee: Record<string, string> = {};
    const lineByAssignee: Record<string, string | null> = {};
    if (assigneeIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, direct_line")
        .in("id", assigneeIds);
      for (const p of profs ?? []) {
        nameByAssignee[p.id] = p.full_name?.trim() || "—";
        lineByAssignee[p.id] = p.direct_line?.trim() || null;
      }
    }

    const mapRowToItem = (c: Record<string, unknown>): ClientsListItem => ({
      id: c.id as string,
      first_name: c.first_name as string | null,
      last_name: c.last_name as string | null,
      email: c.email as string | null,
      nickname: (c.nickname as string | null) ?? null,
      secondary_first_name: (c.secondary_first_name as string | null) ?? null,
      phone: c.phone as string | null,
      phone_mobile: (c.phone_mobile as string | null) ?? null,
      phone_work: (c.phone_work as string | null) ?? null,
      phone_home: (c.phone_home as string | null) ?? null,
      stage: c.stage as string,
      is_active:
        c.is_active === null || c.is_active === undefined ? null : Boolean(c.is_active),
      created_at: (c.created_at as string | null) ?? null,
      assigned_to: (c.assigned_to as string | null) ?? null,
      assignee_name: c.assigned_to ? nameByAssignee[c.assigned_to as string] ?? null : null,
      assignee_direct_line: c.assigned_to
        ? lineByAssignee[c.assigned_to as string] ?? null
        : null,
      assigned_services_id: (c.assigned_services_id as string | null) ?? null,
      services_user_name: c.assigned_services_id
        ? nameByAssignee[c.assigned_services_id as string] ?? null
        : null,
      services_direct_line: c.assigned_services_id
        ? lineByAssignee[c.assigned_services_id as string] ?? null
        : null,
      dnc_reason: (c.dnc_reason as string | null) ?? null,
      spouse_first_name: (c.spouse_first_name as string | null) ?? null,
      spouse_last_name: (c.spouse_last_name as string | null) ?? null,
      spouse_name: (c.spouse_name as string | null) ?? null,
      city: (c.city as string | null) ?? null,
      zip_code: (c.zip_code as string | null) ?? null,
      street_address: (c.street_address as string | null) ?? null,
      stage_entered_at: (c.stage_entered_at as string | null) ?? null,
      mid_name: midNameFromEmbed(c.mids),
    });

    const clients = rawRows.map((c) => mapRowToItem(c));

    const { data: teamRows } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["dev", "admin", "acct_manager"])
      .order("full_name", { ascending: true });

    const staffMembers = (teamRows ?? []).filter(
      (row) => !isHiddenProfile(row as { email?: string | null; role?: string | null }, profile.role)
    );

    const currentUserName = profile.full_name?.trim() || user.email || "Unknown";

    return (
      <ClientsPageShell>
        <ErrorBoundary>
          <ClientsListClient
            tabCounts={tabCounts}
            tab={tab}
            search={search}
            currentPage={page}
            pageSize={pageSize}
            sortField={sortField}
            sortDir={sortDir}
            clients={clients}
            totalCount={totalCount}
            userRole={profile.role}
            staffMembers={staffMembers}
            currentUserName={currentUserName}
            currentUserId={user.id}
            canExportCsv={canExportClientsCsv(profile.role)}
          />
        </ErrorBoundary>
      </ClientsPageShell>
    );
  } catch (error) {
    console.error("Clients page error:", error);
    return (
      <div className="p-8">
        <h1 className="font-semibold text-red-600">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-600">{toUserFacingError(error)}</p>
      </div>
    );
  }
}

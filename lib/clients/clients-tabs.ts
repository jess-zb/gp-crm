import {
  canAccessPriorityBoard,
  canAccessRefundQueue,
  canSeeAllClientsTab,
} from "@/lib/roles";
import type { ClientsListTab } from "@/lib/clients/clients-list-query";

/**
 * Tabs under Clients. Three are client lists; Priority and Refunds are separate
 * views that live here so the left sidebar does not grow.
 */
export type ClientsPageTab = ClientsListTab | "priority" | "refunds";

/**
 * `group` drives the divider in the tab row: the client lists come first, then
 * the two working views. Order here is the order on screen.
 */
export type ClientsTabGroup = "list" | "board";

const TAB_DEFS: readonly {
  id: ClientsPageTab;
  label: string;
  group: ClientsTabGroup;
}[] = [
  { id: "all", label: "All Clients", group: "list" },
  { id: "active", label: "Active", group: "list" },
  { id: "archives", label: "Archives", group: "list" },
  { id: "priority", label: "Priority", group: "board" },
  { id: "refunds", label: "Refunds", group: "board" },
] as const;

export type ClientsTabAccess = {
  role: string;
  /** profiles.is_services — gates Priority for account managers. */
  isServices: boolean;
};

export function visibleClientsTabs(
  access: ClientsTabAccess
): { id: ClientsPageTab; label: string; group: ClientsTabGroup }[] {
  return TAB_DEFS.filter((t) => {
    if (t.id === "all") return canSeeAllClientsTab(access.role);
    if (t.id === "priority") {
      return canAccessPriorityBoard(access.role, access.isServices);
    }
    if (t.id === "refunds") return canAccessRefundQueue(access.role);
    return true;
  }).map((t) => ({ ...t }));
}

export function defaultClientsTab(access: ClientsTabAccess): ClientsPageTab {
  return canSeeAllClientsTab(access.role) ? "all" : "active";
}

/**
 * Coerces the `tab` param to something this role may actually open. Hiding the
 * link is not enough on its own — a hand-typed `?tab=all` or `?tab=refunds` has
 * to land somewhere valid too.
 */
export function parseClientsTab(
  raw: string | undefined,
  access: ClientsTabAccess
): ClientsPageTab {
  const fallback = defaultClientsTab(access);
  const normalized =
    raw === "archived" || raw === "inactive" ? "archives" : raw ?? fallback;
  return visibleClientsTabs(access).some((t) => t.id === normalized)
    ? (normalized as ClientsPageTab)
    : fallback;
}

export function isClientsListTab(tab: ClientsPageTab): tab is ClientsListTab {
  return tab === "all" || tab === "active" || tab === "archives";
}

export function buildClientsHref(parts: {
  tab?: string;
  page?: number | string;
  q?: string;
  size?: number | string;
  sort?: string;
  dir?: "asc" | "desc";
}) {
  const p = new URLSearchParams();
  if (parts.tab && parts.tab !== "all") p.set("tab", parts.tab);
  const pageStr = String(parts.page ?? "1");
  if (pageStr !== "1") p.set("page", pageStr);
  if (parts.q?.trim()) p.set("q", parts.q.trim());
  const sizeStr = String(parts.size ?? "25");
  if (sizeStr !== "25") p.set("size", sizeStr);
  if (parts.sort && parts.sort !== "created_at") p.set("sort", parts.sort);
  if (parts.dir && parts.dir !== "desc") p.set("dir", parts.dir);
  const s = p.toString();
  return s ? `/clients?${s}` : "/clients";
}

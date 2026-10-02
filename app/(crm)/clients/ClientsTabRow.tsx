"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { TabCounts } from "@/lib/clients/tab-counts";
import {
  buildClientsHref,
  visibleClientsTabs,
  type ClientsPageTab,
} from "@/lib/clients/clients-tabs";

function countForTab(tab: ClientsPageTab, counts: TabCounts): number | null {
  switch (tab) {
    case "all":
      return counts.all;
    case "active":
      return counts.active;
    case "archives":
      return counts.archives;
    case "priority":
      return counts.priority ?? null;
    case "refunds":
      return counts.refunds ?? null;
    default:
      return null;
  }
}

/**
 * The one tab row under Clients, shared by the client list, the Priority board,
 * and the Refunds queue so the three cannot drift out of sync.
 */
export function ClientsTabRow({
  activeTab,
  counts,
  role,
  isServices,
  search,
  pageSize,
  sortField,
  sortDir,
  suppressActive = false,
  trailing,
}: {
  activeTab: ClientsPageTab;
  counts: TabCounts;
  role: string;
  isServices: boolean;
  search?: string;
  pageSize?: number;
  sortField?: string;
  sortDir?: "asc" | "desc";
  /** Search spans every tab, so no tab is "current" while searching. */
  suppressActive?: boolean;
  trailing?: ReactNode;
}) {
  const tabs = visibleClientsTabs({ role, isServices });

  // While searching, every tab shows the same cross-tab results, so keeping `q`
  // would make tab clicks look broken. Dropping it turns a tab click into "stop
  // searching and browse this tab".
  const carriedSearch = suppressActive ? undefined : search?.trim() || undefined;

  return (
    <div className="crm-tab-row mt-5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center">
        {tabs.map((t, i) => {
          const active = !suppressActive && activeTab === t.id;
          const count = countForTab(t.id, counts);
          // Separates browsing the client list from the two working views.
          const startsBoardGroup =
            i > 0 && t.group === "board" && tabs[i - 1].group !== "board";
          return (
            <Fragment key={t.id}>
              {startsBoardGroup ? (
                <span
                  aria-hidden
                  className="mx-1.5 self-center text-slate-300 dark:text-slate-600"
                >
                  |
                </span>
              ) : null}
              <Link
                href={buildClientsHref({
                  tab: t.id,
                  page: 1,
                  q: carriedSearch,
                  size: pageSize,
                  sort: sortField,
                  dir: sortDir,
                })}
                className={`inline-flex items-center ${active ? "crm-tab-active" : "crm-tab"}`}
              >
                {t.label}
                {count === null ? null : (
                  <span
                    className={active ? "crm-tab-count-active" : "crm-tab-count"}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </Fragment>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUserFacingError } from "@/lib/user-facing-error";
import type { TabCounts } from "@/lib/clients/tab-counts";
import type { ClientsPageTab } from "@/lib/clients/clients-tabs";
import {
  CS_CHECKLIST_ITEMS,
  CS_CHECKLIST_TOTAL,
  csChecklistItemLabel,
  type CsChecklistItemKey,
} from "@/lib/clients/cs-checklist";
import type { PriorityBoardRow } from "@/lib/clients/cs-priority-query";
import {
  defaultDirFor,
  sortPriorityRows,
  type PrioritySortDir,
  type PrioritySortField,
} from "@/lib/clients/cs-priority-sort";
import { ModalOverlay } from "@/app/components/ModalOverlay";
import { BoardSearchInput } from "./BoardSearchInput";
import { ClientsTabRow } from "./ClientsTabRow";
import { setCsChecklistItem } from "./cs-checklist-actions";
import { bulkSetCsChecklistItem } from "./bulk-actions";

type CellKey = `${string}:${CsChecklistItemKey}`;

function daysLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Today";
  return `${days}d`;
}

/** Long-waiting clients get progressively louder, matching the sort order. */
function daysClass(days: number | null): string {
  if (days === null) return "text-slate-400 dark:text-slate-500";
  if (days >= 30) return "font-semibold text-red-700 dark:text-red-300";
  if (days >= 14) return "font-medium text-amber-700 dark:text-amber-300";
  return "text-slate-600 dark:text-slate-300";
}

/** Says what the board is ordered by in words, since arrows alone are cryptic. */
function describeSort(field: PrioritySortField, dir: PrioritySortDir): string {
  if (field === "priority") {
    return dir === "desc"
      ? "most outstanding first, then longest waiting"
      : "closest to done first";
  }
  if (field.startsWith("item:")) {
    const label = csChecklistItemLabel(
      field.slice("item:".length) as CsChecklistItemKey
    );
    return dir === "asc"
      ? `${label} outstanding first`
      : `${label} complete first`;
  }
  switch (field) {
    case "name":
      return dir === "asc" ? "client A–Z" : "client Z–A";
    case "done":
      return dir === "asc" ? "fewest items done first" : "most items done first";
    case "days":
      return dir === "desc" ? "longest in stage first" : "newest in stage first";
    default:
      return "";
  }
}

/**
 * A column header that reorders the board. Same arrows as the client list, but
 * it sorts what is already on screen rather than navigating: the whole stage is
 * loaded, so there is nothing to fetch.
 */
function SortHeader({
  field,
  label,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  field: PrioritySortField;
  label: string;
  sort: { field: PrioritySortField; dir: PrioritySortDir };
  onSort: (field: PrioritySortField) => void;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const active = sort.field === field;
  const justify =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "justify-start";

  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`py-2.5 text-xs font-semibold uppercase tracking-wide ${
        active
          ? "text-slate-700 dark:text-slate-200"
          : "text-slate-500 dark:text-slate-400"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        title={`Sort by ${label}`}
        className={`group inline-flex w-full items-center gap-1 rounded uppercase tracking-wide hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:hover:text-white ${justify}`}
      >
        <span>{label}</span>
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[#A87830]" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#A87830]" aria-hidden />
          )
        ) : (
          // Kept in the layout so the header does not jump when it becomes the
          // sorted column.
          <ChevronsUpDown
            className="h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
            aria-hidden
          />
        )}
      </button>
    </th>
  );
}

export function PriorityBoardClient({
  rows,
  truncated,
  counts,
  role,
  isServices,
}: {
  rows: PriorityBoardRow[];
  truncated: boolean;
  counts: TabCounts;
  role: string;
  isServices: boolean;
}) {
  const router = useRouter();
  const [pendingCells, setPendingCells] = useState<Set<CellKey>>(() => new Set());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkItem, setBulkItem] = useState<CsChecklistItemKey>(
    CS_CHECKLIST_ITEMS[0].key
  );
  const [bulkPending, startBulk] = useTransition();
  const [untickTarget, setUntickTarget] = useState<{
    clientId: string;
    displayName: string;
    itemKey: CsChecklistItemKey;
  } | null>(null);

  const [query, setQuery] = useState("");

  // The rows arrive in priority order, so this starts as a description of what
  // is already on screen rather than a re-sort.
  const [sort, setSort] = useState<{
    field: PrioritySortField;
    dir: PrioritySortDir;
  }>({ field: "priority", dir: "desc" });

  const onSort = useCallback((field: PrioritySortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: defaultDirFor(field) }
    );
  }, []);

  // Filters the board in place rather than navigating: the whole stage is
  // already loaded, so there is nothing to fetch. Assignee and Services owner
  // are searchable too, since "show me my clients" is the common ask.
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.displayName, r.assigneeName, r.servicesUserName]
        .filter((v): v is string => !!v)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const sortedRows = useMemo(
    () => sortPriorityRows(visibleRows, sort.field, sort.dir),
    [visibleRows, sort]
  );

  const filtering = query.trim().length > 0;

  const outstanding = useMemo(
    () => visibleRows.filter((r) => r.incompleteCount > 0).length,
    [visibleRows]
  );

  // Everything the bulk bar does is scoped to rows the search left on screen, so
  // a filter can never hide a client that Apply is about to write to. Hidden
  // selections are kept, not dropped, and come back when the search is cleared.
  const selectedVisibleIds = useMemo(
    () => visibleRows.filter((r) => selected.has(r.id)).map((r) => r.id),
    [visibleRows, selected]
  );

  const allOnPageSelected =
    visibleRows.length > 0 && selectedVisibleIds.length === visibleRows.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const row of visibleRows) next.delete(row.id);
      } else {
        for (const row of visibleRows) next.add(row.id);
      }
      return next;
    });
  }

  async function onToggleCell(
    row: PriorityBoardRow,
    itemKey: CsChecklistItemKey,
    currentlyComplete: boolean,
    autoChecked: boolean
  ) {
    if (autoChecked) {
      toast.info(
        "POA on File is set automatically from the signed POA on this client."
      );
      return;
    }

    // Undoing a completed item is confirmed: it moves the client back up the
    // board and writes a checklist_uncompleted entry to their history.
    if (currentlyComplete) {
      setUntickTarget({
        clientId: row.id,
        displayName: row.displayName,
        itemKey,
      });
      return;
    }

    await applyToggle(row.id, itemKey, true);
  }

  async function applyToggle(
    clientId: string,
    itemKey: CsChecklistItemKey,
    complete: boolean
  ) {
    const cell: CellKey = `${clientId}:${itemKey}`;
    if (pendingCells.has(cell)) return;

    setPendingCells((prev) => new Set(prev).add(cell));
    try {
      const result = await setCsChecklistItem({
        clientId,
        itemKey,
        complete,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    } catch (error) {
      toast.error(toUserFacingError(error));
    } finally {
      setPendingCells((prev) => {
        const next = new Set(prev);
        next.delete(cell);
        return next;
      });
    }
  }

  function onBulkComplete() {
    const ids = selectedVisibleIds;
    if (ids.length === 0) return;

    startBulk(async () => {
      try {
        const result = await bulkSetCsChecklistItem(ids, bulkItem);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          `Marked complete for ${ids.length} ${ids.length === 1 ? "client" : "clients"}.`
        );
        setSelected(new Set());
        router.refresh();
      } catch (error) {
        toast.error(toUserFacingError(error));
      }
    });
  }

  return (
    <>
      <BoardSearchInput
        id="priority-search"
        label="Search Client Services clients"
        placeholder="Search name, account manager, Services owner…"
        value={query}
        onChange={setQuery}
      />

      <ClientsTabRow
        activeTab={"priority" as ClientsPageTab}
        counts={counts}
        role={role}
        isServices={isServices}
      />

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {filtering
            ? `${visibleRows.length} of ${rows.length} in Client Services`
            : `${rows.length} in Client Services`}{" "}
          · {outstanding} with outstanding items
        </p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">
          Sorted by {describeSort(sort.field, sort.dir)}. Click a column to
          change it.
          {sort.field === "priority" && sort.dir === "desc" ? null : (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setSort({ field: "priority", dir: "desc" })}
                className="font-semibold text-[#A87830] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830]"
              >
                Back to priority order
              </button>
            </>
          )}
        </p>
      </div>

      {truncated ? (
        <p className="mt-2 text-[13px] text-amber-700 dark:text-amber-300">
          Showing the first 1000 clients in Client Services.
        </p>
      ) : null}

      {selectedVisibleIds.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#A87830]/30 bg-[#A87830]/10 px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-[#3d5c3f] dark:bg-[#242424]/80">
          <p className="shrink-0 text-sm font-medium text-slate-800 dark:text-slate-200">
            {selectedVisibleIds.length} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-700 dark:text-slate-300" htmlFor="bulk-cs-item">
              Mark complete
            </label>
            <select
              id="bulk-cs-item"
              value={bulkItem}
              onChange={(e) => setBulkItem(e.target.value as CsChecklistItemKey)}
              className="crm-input h-9 py-0 text-sm"
            >
              {CS_CHECKLIST_ITEMS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onBulkComplete}
              disabled={bulkPending}
              className="crm-btn-primary inline-flex items-center gap-1.5"
            >
              {bulkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Apply
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="crm-btn-secondary"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-[#2E2E2E]">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-slate-50 text-left dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-[#A87830] focus:ring-[#A87830]"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  aria-label="Select all clients"
                />
              </th>
              <SortHeader
                field="name"
                label="Client"
                sort={sort}
                onSort={onSort}
                className="px-4"
              />
              {CS_CHECKLIST_ITEMS.map((item) => (
                <SortHeader
                  key={item.key}
                  field={`item:${item.key}`}
                  label={item.label}
                  sort={sort}
                  onSort={onSort}
                  align="center"
                  className="px-2"
                />
              ))}
              <SortHeader
                field="done"
                label="Done"
                sort={sort}
                onSort={onSort}
                align="center"
                className="px-3"
              />
              <SortHeader
                field="days"
                label="In stage"
                sort={sort}
                onSort={onSort}
                align="right"
                className="px-4"
              />
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={CS_CHECKLIST_TOTAL + 4}
                  className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {filtering
                    ? `No Client Services clients match "${query.trim()}".`
                    : "No active clients are in Client Services right now."}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-[#2E2E2E] dark:hover:bg-[#242424]/60"
                >
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-[#A87830] focus:ring-[#A87830]"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.displayName}`}
                    />
                  </td>
                  <td className="px-4 py-2 align-middle">
                    <Link
                      href={`/clients/${row.id}`}
                      className="text-sm font-medium text-[#A87830] hover:text-[#8C6428] dark:hover:text-[#C4A15A]"
                    >
                      {row.displayName}
                    </Link>
                    {row.servicesUserName || row.assigneeName ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {row.servicesUserName ?? row.assigneeName}
                      </p>
                    ) : null}
                  </td>
                  {row.states.map((state) => {
                    const cell: CellKey = `${row.id}:${state.key}`;
                    const busy = pendingCells.has(cell);
                    return (
                      <td key={state.key} className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCell(row, state.key, state.complete, state.autoChecked)
                          }
                          disabled={busy}
                          aria-pressed={state.complete}
                          aria-label={`${state.label} for ${row.displayName}`}
                          title={
                            state.autoChecked
                              ? `${state.label} — set automatically from the signed POA`
                              : state.complete
                                ? `${state.label} — complete, click to undo`
                                : `${state.label} — outstanding, click to complete`
                          }
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset transition-colors ${
                            state.complete
                              ? state.autoChecked
                                ? "bg-emerald-50 text-emerald-600 ring-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "bg-emerald-500 text-white ring-emerald-600/30 hover:bg-emerald-600"
                              : "bg-amber-100 text-transparent ring-amber-500/30 hover:bg-amber-200 dark:bg-amber-950/40"
                          } ${busy ? "opacity-60" : ""}`}
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                          ) : state.complete ? (
                            <Check className="h-4 w-4" />
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center align-middle text-sm text-slate-600 dark:text-slate-300">
                    {row.completeCount} of {CS_CHECKLIST_TOTAL}
                  </td>
                  <td
                    className={`px-4 py-2 text-right align-middle text-sm ${daysClass(row.daysInStage)}`}
                  >
                    {daysLabel(row.daysInStage)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">
        POA on File fills in on its own once a signed POA is on the client, so it
        starts empty for most clients here — POAs usually arrive later, around
        Awaiting Collections. The other three are ticked here.
      </p>

      {untickTarget ? (
        <ModalOverlay
          labelledBy="untick-cs-item-title"
          className="z-50 bg-black/40"
          onBackdropClick={() => setUntickTarget(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-[#0d2138]">
            <h3
              id="untick-cs-item-title"
              className="text-lg font-bold text-gray-900 dark:text-slate-100"
            >
              Undo this item?
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {csChecklistItemLabel(untickTarget.itemKey)} will be marked
              outstanding again for {untickTarget.displayName}, moving them back
              up the board. The change is recorded in their history.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setUntickTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#1f3520]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = untickTarget;
                  setUntickTarget(null);
                  void applyToggle(target.clientId, target.itemKey, false);
                }}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                Undo item
              </button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </>
  );
}

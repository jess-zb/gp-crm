"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue, memo } from "react";
import { Columns, Search } from "lucide-react";
import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import { type PipelinePageStage } from "@/lib/crm/pipeline-stage-counts";
import { searchFilter } from "@/lib/clients/client-search";
import { getStageConfig } from "@/lib/constants/stages";

const SALES_TABS: { id: PipelinePageStage; label: string }[] = [
  { id: "lead", label: "New Leads" },
  { id: "welcome_packet", label: "Account Manager" },
  { id: "retention", label: "Retention" },
];

const SERVICE_TABS: { id: PipelinePageStage; label: string }[] = [
  { id: "client_services", label: "Client Services" },
  { id: "awaiting_collection_letter", label: "Awaiting Collection Letter" },
  { id: "case_sent_to_attorneys", label: "Case Sent to Attorneys" },
];

export type PipelinePageRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_mobile: string | null;
  email: string | null;
  stage: string;
  created_at: string | null;
  stage_entered_at: string | null;
  assigned_user: { full_name: string | null } | null;
  compliance_manager: { full_name: string | null } | null;
  services_manager: { full_name: string | null } | null;
};

const COLUMN_STORAGE_KEY = "zb-pipeline-visible-columns";

const AVAILABLE_COLUMNS = [
  { id: "name", label: "Client Name", required: true as const },
  { id: "phone", label: "Phone" },
  { id: "accounts", label: "Accounts" },
  { id: "compliance", label: "Compliance" },
  { id: "services", label: "Services" },
  { id: "created_at", label: "Date Added" },
  { id: "days", label: "Days in Stage" },
] as const;

const DEFAULT_VISIBLE_COLUMNS: string[] = [
  "name",
  "phone",
  "accounts",
  "compliance",
  "created_at",
  "days",
];

function loadVisibleColumnsFromStorage(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_VISIBLE_COLUMNS];
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return [...DEFAULT_VISIBLE_COLUMNS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_COLUMNS];
    const allowed = new Set<string>(AVAILABLE_COLUMNS.map((c) => c.id));
    const next = parsed.filter((id): id is string => typeof id === "string" && allowed.has(id));
    if (!next.includes("name")) next.unshift("name");
    return next.length ? next : [...DEFAULT_VISIBLE_COLUMNS];
  } catch {
    return [...DEFAULT_VISIBLE_COLUMNS];
  }
}

function daysInStage(entered: string | null, fallback: string | null): number {
  const iso = entered?.trim() || fallback?.trim();
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function daysColorClass(days: number): string {
  if (days <= 7) return "text-emerald-600 dark:text-emerald-400";
  if (days <= 30) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function displayPhone(mobile: string | null): string {
  const v = (mobile ?? "").trim();
  return v || "—";
}

function embedName(
  raw:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null
    | undefined
): string {
  if (!raw) return "—";
  const u = Array.isArray(raw) ? raw[0] : raw;
  return u?.full_name?.trim() || "—";
}

type Props = {
  rows: PipelinePageRow[];
  stageCounts: Record<string, number>;
  activeStage: PipelinePageStage;
};

const SERVICE_STAGES = new Set<string>([
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
]);

const PipelineRow = memo(({
  c,
  orderedVisibleColumns
}: {
  c: PipelinePageRow;
  orderedVisibleColumns: string[];
}) => {
  const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
  const days = daysInStage(c.stage_entered_at, c.created_at);

  return (
    <tr className="crm-table-row">
      {orderedVisibleColumns.map((colId) => {
        switch (colId) {
          case "name":
            return (
              <td key={colId} className="crm-table-td">
                <Link
                  href={`/clients/${c.id}`}
                  prefetch={false}
                  className="crm-link-accent block max-w-[180px] truncate"
                  title={name}
                >
                  {name}
                </Link>
              </td>
            );
          case "phone":
            return (
              <td key={colId} className="crm-table-td">
                {displayPhone(c.phone_mobile)}
              </td>
            );
          case "accounts":
            return (
              <td
                key={colId}
                className="crm-table-td hidden max-w-[160px] truncate md:table-cell"
              >
                {embedName(c.assigned_user)}
              </td>
            );
          case "compliance":
            return (
              <td
                key={colId}
                className="crm-table-td hidden max-w-[160px] truncate lg:table-cell"
              >
                {embedName(c.compliance_manager)}
              </td>
            );
          case "services":
            return (
              <td
                key={colId}
                className="crm-table-td hidden max-w-[160px] truncate lg:table-cell"
              >
                {embedName(c.services_manager)}
              </td>
            );
          case "created_at":
            return (
              <td
                key={colId}
                className="crm-table-td hidden whitespace-nowrap text-slate-600 md:table-cell dark:text-slate-300"
              >
                <ClientFormattedDate iso={c.created_at} pattern="MMM d, yyyy" />
              </td>
            );
          case "days":
            return (
              <td
                key={colId}
                className={`crm-table-td font-medium tabular-nums ${daysColorClass(days)}`}
              >
                {days}
              </td>
            );
          default:
            return null;
        }
      })}
    </tr>
  );
});

PipelineRow.displayName = "PipelineRow";

export const PipelinePageClient = memo(function PipelinePageClient({
  rows,
  stageCounts,
  activeStage,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => [...DEFAULT_VISIBLE_COLUMNS]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleColumns(loadVisibleColumnsFromStorage());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      /* ignore */
    }
  }, [visibleColumns]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    if (showColumnPicker) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showColumnPicker]);

  const pipelineType: "sales" | "service" = SERVICE_STAGES.has(activeStage) ? "service" : "sales";

  const activeTabs = pipelineType === "sales" ? SALES_TABS : SERVICE_TABS;

  const orderedVisibleColumns = useMemo(
    () => visibleColumns.filter((id) => AVAILABLE_COLUMNS.some((c) => c.id === id)),
    [visibleColumns]
  );

  const filteredRows = useMemo(() => {
    const q = deferredSearch.trim();
    if (!q) return rows;
    return rows.filter((c) =>
      searchFilter(
        {
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          phone_mobile: c.phone_mobile,
          spouse_first_name: null,
          spouse_last_name: null,
          phone: null,
          phone_work: null,
          phone_home: null,
          city: null,
          zip_code: null,
          street_address: null,
        },
        q
      )
    );
  }, [rows, deferredSearch]);

  const goStage = useCallback(
    (stage: PipelinePageStage) => {
      router.push(`/pipeline?stage=${encodeURIComponent(stage)}`);
    },
    [router]
  );

  const colSpan = Math.max(1, orderedVisibleColumns.length);

  return (
    <div className="mx-auto min-w-0 max-w-6xl overflow-x-hidden">
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            goStage("lead");
          }}
          className={
            pipelineType === "sales"
              ? "crm-btn-primary"
              : "crm-btn-secondary"
          }
          aria-label="Switch to Sales Pipeline"
          aria-pressed={pipelineType === "sales"}
          title="Sales Pipeline"
        >
          Sales
        </button>
        <button
          type="button"
          onClick={() => {
            goStage("client_services");
          }}
          className={
            pipelineType === "service"
              ? "crm-btn-primary"
              : "crm-btn-secondary"
          }
          aria-label="Switch to Service Pipeline"
          aria-pressed={pipelineType === "service"}
          title="Service Pipeline"
        >
          Service
        </button>
      </div>

      <div className="relative mb-5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Search name, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="crm-input pl-9"
          aria-label="Search clients in this stage"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-y-1 border-b border-slate-200 dark:border-[#1a3550]">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {activeTabs.map((tab) => {
            const count = stageCounts[tab.id] ?? 0;
            const tabCfg = getStageConfig(tab.id);
            const isActive = activeStage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => goStage(tab.id)}
                className={`crm-tab !px-2.5 !py-2 ${
                  isActive ? "border-current" : ""
                }`}
                style={
                  isActive ? { color: tabCfg.hex, borderBottomColor: tabCfg.hex } : undefined
                }
                aria-pressed={isActive}
                aria-label={`Show ${tab.label} stage (${count} clients)`}
              >
                {tab.label}
                <span
                  className={
                    isActive
                      ? `ml-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${tabCfg.color} ${tabCfg.border}`
                      : "crm-tab-count"
                  }
                >
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative ml-4 shrink-0" ref={columnPickerRef}>
          <button
            type="button"
            onClick={() => setShowColumnPicker((p) => !p)}
            className="crm-btn-secondary py-2 text-xs"
          >
            <Columns className="h-3.5 w-3.5" />
            Columns
          </button>
          {showColumnPicker ? (
            <div className="absolute right-0 top-10 z-20 w-52 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Show columns
              </p>
              {AVAILABLE_COLUMNS.map((col) => (
                <label key={col.id} className="flex cursor-pointer items-center gap-2.5 py-1.5">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.id)}
                    disabled={"required" in col && col.required === true}
                    onChange={() => {
                      setVisibleColumns((prev) =>
                        prev.includes(col.id)
                          ? "required" in col && col.required
                            ? prev
                            : prev.filter((c) => c !== col.id)
                          : [...prev, col.id]
                      );
                    }}
                    className="rounded accent-[#8DE3B5]"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-200">{col.label}</span>
                  {"required" in col && col.required ? (
                    <span className="ml-auto text-xs text-gray-400">always</span>
                  ) : null}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="crm-table-wrap">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left dark:divide-[#1a3550]">
          <thead>
            <tr className="crm-table-head-row">
              {orderedVisibleColumns.map((colId) => {
                switch (colId) {
                  case "name":
                    return (
                      <th key={colId} className="crm-table-th w-[200px]">
                        Client Name
                      </th>
                    );
                  case "phone":
                    return (
                      <th key={colId} className="crm-table-th w-[140px]">
                        Phone
                      </th>
                    );
                  case "accounts":
                    return (
                      <th
                        key={colId}
                        className="crm-table-th hidden w-[160px] md:table-cell"
                      >
                        Accounts
                      </th>
                    );
                  case "compliance":
                    return (
                      <th
                        key={colId}
                        className="crm-table-th hidden w-[160px] lg:table-cell"
                      >
                        Compliance
                      </th>
                    );
                  case "services":
                    return (
                      <th
                        key={colId}
                        className="crm-table-th hidden w-[160px] lg:table-cell"
                      >
                        Services
                      </th>
                    );
                  case "created_at":
                    return (
                      <th
                        key={colId}
                        className="crm-table-th hidden w-[120px] md:table-cell"
                      >
                        Date Added
                      </th>
                    );
                  case "days":
                    return (
                      <th key={colId} className="crm-table-th w-[100px]">
                        Days in Stage
                      </th>
                    );
                  default:
                    return null;
                }
              })}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="crm-table-td py-12 text-center"
                >
                  <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                    No clients in this stage{search.trim() ? " match your search" : ""}.
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {search.trim()
                      ? "Try searching for a different name or checking another stage."
                      : "New clients will appear here as they move into this stage. Check other stages or search to find specific clients."}
                  </p>
                </td>
              </tr>
            ) : (
              filteredRows.map((c) => (
                <PipelineRow key={c.id} c={c} orderedVisibleColumns={orderedVisibleColumns} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

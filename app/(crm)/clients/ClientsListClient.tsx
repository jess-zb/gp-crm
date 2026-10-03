"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  memo,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  Columns,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { toUserFacingError } from "@/lib/user-facing-error";
import { createClient } from "@/lib/supabase/client";

import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import { StagePill } from "@/app/components/StagePill";
import { formatDate } from "@/lib/utils/date";
import type { TabCounts } from "@/lib/clients/tab-counts";
import { softDeleteClient } from "./actions";
import {
  bulkAssign,
  bulkChangeStage,
  bulkSoftDelete,
} from "./bulk-actions";
import type { ClientsListSortField } from "@/lib/clients/clients-list-query";
import {
  canBulkDeleteClients,
  canDeleteClientRecord,
} from "@/lib/roles";
import { ClientsTabRow } from "./ClientsTabRow";
import {
  buildClientsHref,
  type ClientsPageTab,
} from "@/lib/clients/clients-tabs";
import {
  ALL_STAGE_ORDER,
  getStageLabel,
  isPipelineStageHidden,
  STAGE_LABELS,
} from "@/lib/constants/stages";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

export type ClientsListItem = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  nickname: string | null;
  secondary_first_name: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  spouse_name: string | null;
  phone: string | null;
  phone_mobile: string | null;
  phone_work: string | null;
  phone_home: string | null;
  city: string | null;
  zip_code: string | null;
  street_address: string | null;
  stage: string;
  is_active: boolean | null;
  created_at: string | null;
  stage_entered_at: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  assigned_services_id: string | null;
  services_user_name: string | null;
  dnc_reason: string | null;
  mid_name: string | null;
};

function listDisplayPhone(c: ClientsListItem): string {
  const v =
    c.phone_mobile?.trim() ||
    c.phone?.trim() ||
    c.phone_work?.trim() ||
    c.phone_home?.trim() ||
    "";
  return v || "—";
}

function daysInClientStage(c: ClientsListItem): number {
  const iso = c.stage_entered_at?.trim() || c.created_at?.trim();
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

const STAGE_OPTIONS = ALL_STAGE_ORDER.filter(
  (value) => !isPipelineStageHidden(value)
).map((value) => ({
  value,
  label: STAGE_LABELS[value] ?? value,
}));

const COLUMN_STORAGE_KEY = "gp-clients-visible-columns";

const AVAILABLE_COLUMNS = [
  { id: "client_status", label: "Row status" },
  { id: "name", label: "Client Name", required: true },
  { id: "stage", label: "Stage" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "sales_user", label: "Account Manager" },
  { id: "services", label: "Client Services" },
  { id: "created_at", label: "Date Added" },
  { id: "days_in_stage", label: "Days in Stage" },
] as const;

const DEFAULT_VISIBLE_COLUMNS: string[] = [
  "client_status",
  "name",
  "stage",
  "phone",
  "sales_user",
  "created_at",
];

const COLUMN_WIDTHS: Record<string, number> = {
  client_status: 72,
  name: 220,
  stage: 140,
  phone: 140,
  email: 200,
  sales_user: 140,
  services: 140,
  created_at: 120,
  days_in_stage: 110,
  /** View + Edit + optional Reactivate + Delete in one row (4×32px + gaps + padding). */
  actions: 140,
};

const CHECKBOX_COL_WIDTH = 40;
const MOBILE_CHECKBOX_COL_WIDTH = 36;
const MOBILE_ACTIONS_COL_WIDTH = 80;

/** Matches `hidden md:table-cell` on column cells — still in DOM but must not steal width on mobile. */
const COLUMNS_HIDDEN_BELOW_MD = new Set([
  "client_status",
  "phone",
  "email",
  "sales_user",
  "services",
  "created_at",
  "days_in_stage",
]);

const MOBILE_COLUMN_WIDTHS: Record<string, number> = {
  name: 200,
  stage: 108,
};

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

const buildListHref = buildClientsHref;

/**
 * DNC row pills: dead → chargeback → refund → cancelled → dnc → default DNC.
 * `compact`: search-corpus pill sizing; otherwise table Stage column.
 */
function clientListDncStageBadge(client: ClientsListItem, compact: boolean) {
  if (client.stage !== "dnc") return null;
  const r = (client.dnc_reason ?? "").trim().toLowerCase();

  if (compact) {
    const wrap = (cls: string, label: string) => (
      <span
        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${cls}`}
      >
        {label}
      </span>
    );
    if (r === "dead") {
      return wrap(
        "bg-gray-800 text-gray-100 ring-gray-600/40 dark:bg-gray-900 dark:text-gray-100",
        "Dead"
      );
    }
    if (r === "chargeback") {
      return wrap(
        "bg-orange-100 text-orange-900 ring-orange-500/25 dark:bg-orange-950/40 dark:text-orange-100",
        "Chargeback"
      );
    }
    if (r === "refund") {
      return wrap(
        "bg-purple-100 text-purple-900 ring-purple-500/25 dark:bg-purple-950/40 dark:text-purple-100",
        "Refund"
      );
    }
    if (r === "cancelled") {
      return wrap(
        "bg-gray-100 text-gray-800 ring-gray-400/25 dark:bg-slate-700 dark:text-slate-200",
        "Cancelled"
      );
    }
    if (r === "dnc") {
      return wrap(
        "bg-red-100 text-red-900 ring-red-600/25 dark:bg-red-950/50 dark:text-red-100",
        "DNC"
      );
    }
    return wrap(
      "bg-red-100 text-red-900 ring-red-600/25 dark:bg-red-950/50 dark:text-red-100",
      "DNC"
    );
  }

  if (r === "dead") {
    return (
      <span className="inline-flex rounded-full border border-gray-700 bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
        Dead
      </span>
    );
  }
  if (r === "chargeback") {
    return (
      <span className="inline-flex rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-100">
        Chargeback
      </span>
    );
  }
  if (r === "refund") {
    return (
      <span className="inline-flex rounded-full border border-purple-200 bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-100">
        Refund
      </span>
    );
  }
  if (r === "cancelled") {
    return (
      <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-500 dark:bg-slate-700 dark:text-slate-200">
        Cancelled
      </span>
    );
  }
  if (r === "dnc") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-900 ring-1 ring-inset ring-red-600/20 dark:bg-red-950/40 dark:text-red-200">
        DNC
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-900 ring-1 ring-inset ring-red-600/20 dark:bg-red-950/40 dark:text-red-200">
      DNC
    </span>
  );
}

function statusBadge(stage: string, isActive: boolean | null) {
  if (stage === "closed") {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-600/20 dark:bg-red-950/40 dark:text-red-200">
        Archived
      </span>
    );
  }
  if (isActive === true) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/15 dark:bg-[#1C1C1C] dark:text-slate-300">
      Inactive
    </span>
  );
}

/**
 * Search results span active and archived clients at once, so the row needs to
 * say which side it came from. Kept narrower than `statusBadge` because it sits
 * inline next to the name.
 */
function searchScopeBadge(isActive: boolean | null) {
  if (isActive === true) {
    return (
      <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-500/15 dark:bg-[#1C1C1C] dark:text-slate-300">
      Archived
    </span>
  );
}

const SortableHeader = memo(({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className = "",
}: {
  field: ClientsListSortField;
  label: string;
  sortField: ClientsListSortField;
  sortDir: "asc" | "desc";
  onSort: (field: ClientsListSortField, dir: "asc" | "desc") => void;
  className?: string;
}) => (
  <th
    scope="col"
    title={`Sort by ${label}`}
    onClick={() => {
      const nextDir =
        sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
      onSort(field, nextDir);
    }}
    className={`group cursor-pointer px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 select-none hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 ${className}`}
  >
    <span className="flex items-center gap-1">
      {label}
      <span className="flex flex-col">
        <ChevronUp
          className={`-mb-1 h-4 w-4 ${
            sortField === field && sortDir === "asc"
              ? "text-[#A87830]"
              : "text-gray-300 group-hover:text-gray-400 dark:text-slate-600 dark:group-hover:text-slate-500"
          }`}
          aria-label="Sort ascending"
        />
        <ChevronDown
          className={`h-4 w-4 ${
            sortField === field && sortDir === "desc"
              ? "text-[#A87830]"
              : "text-gray-300 group-hover:text-gray-400 dark:text-slate-600 dark:group-hover:text-slate-500"
          }`}
          aria-label="Sort descending"
        />
      </span>
    </span>
  </th>
));
SortableHeader.displayName = "SortableHeader";

const ClientCell = memo(({
  client,
  colId,
  searchActive = false,
}: {
  client: ClientsListItem;
  colId: string;
  /** Search spans every client, so each row states which bucket it belongs to. */
  searchActive?: boolean;
}) => {
  switch (colId) {
    case "client_status":
      return (
        <td className="hidden whitespace-nowrap px-4 py-2.5 md:table-cell">
          {statusBadge(client.stage, client.is_active)}
        </td>
      );
    case "name": {
      const displayName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "—";
      const nick = client.nickname?.trim();
      const secondary = client.secondary_first_name?.trim();
      const titleExtra = [nick ? `"${nick}"` : null, secondary || null].filter(Boolean).join(" · ");
      return (
        <td className="min-w-0 px-2 py-2.5 max-md:max-w-none md:max-w-[220px] md:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className="text-sm font-medium text-gray-900 max-md:whitespace-normal max-md:break-words md:truncate dark:text-slate-100"
              title={titleExtra ? `${displayName} (${titleExtra})` : displayName}
            >
              {displayName}
            </p>
            {searchActive ? searchScopeBadge(client.is_active) : null}
          </div>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {client.mid_name?.trim() || "No MID"}
          </p>
        </td>
      );
    }
    case "phone": {
      const displayPhone = listDisplayPhone(client);
      return (
        <td className="hidden max-w-[140px] px-4 py-2.5 text-sm text-slate-700 md:table-cell dark:text-slate-300">
          <span className="block truncate" title={displayPhone !== "—" ? displayPhone : undefined}>
            {displayPhone}
          </span>
        </td>
      );
    }
    case "email":
      return (
        <td className="hidden max-w-[180px] px-4 py-2.5 text-sm text-slate-700 md:table-cell dark:text-slate-300">
          <span className="block truncate" title={client.email?.trim() || undefined}>
            {client.email?.trim() || "—"}
          </span>
        </td>
      );
    case "stage":
      return (
        <td className="whitespace-nowrap px-2 py-2.5 md:px-4">
          {clientListDncStageBadge(client, false) ?? (
            <StagePill stage={client.stage} className="max-md:max-w-full max-md:text-[10px] max-md:px-1.5" />
          )}
        </td>
      );
    case "sales_user":
      return (
        <td className="hidden max-w-[130px] px-4 py-2.5 text-sm text-slate-700 md:table-cell dark:text-slate-300">
          <span className="block truncate">{client.assignee_name?.trim() || "—"}</span>
        </td>
      );
    case "services":
      return (
        <td className="hidden max-w-[130px] px-4 py-2.5 text-sm text-slate-700 md:table-cell dark:text-slate-300">
          <span className="block truncate" title={client.services_user_name?.trim() || undefined}>
            {client.services_user_name?.trim() || "—"}
          </span>
        </td>
      );
    case "created_at":
      return (
        <td className="hidden whitespace-nowrap px-4 py-2.5 text-sm text-slate-600 md:table-cell dark:text-slate-400">
          <ClientFormattedDate iso={client.created_at} pattern="MMM d, yyyy" />
        </td>
      );
    case "days_in_stage":
      return (
        <td className="hidden px-4 py-2.5 text-sm tabular-nums text-slate-700 md:table-cell dark:text-slate-300">
          {daysInClientStage(client)}
        </td>
      );
    default:
      return null;
  }
});
ClientCell.displayName = "ClientCell";

const ClientRow = memo(
  ({
    client,
    isSelected,
    toggleOne,
    goView,
    onEdit,
    onReactivate,
    canReactivateClient,
    canDeleteOne,
    onDeleteOne,
    orderedVisibleColumns,
    searchActive,
  }: {
    client: ClientsListItem;
    isSelected: boolean;
    toggleOne: (id: string) => void;
    goView: (id: string) => void;
    onEdit: (id: string) => void;
    onReactivate: (client: ClientsListItem) => void;
    canReactivateClient: boolean;
    canDeleteOne: boolean;
    onDeleteOne: (id: string) => void;
    orderedVisibleColumns: string[];
    searchActive: boolean;
  }) => {
    const displayName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "—";
    return (
      <tr
        role="button"
        tabIndex={0}
        onClick={() => goView(client.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goView(client.id);
          }
        }}
        className="crm-table-row cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-[#2E2E2E] dark:hover:bg-[#242424]/40"
      >
        <td className="px-3 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-[#A87830] focus:ring-[#A87830]"
            checked={isSelected}
            onChange={() => toggleOne(client.id)}
            aria-label={`Select ${displayName}`}
          />
        </td>
        {orderedVisibleColumns.map((colId) => (
          <ClientCell
            key={colId}
            client={client}
            colId={colId}
            searchActive={searchActive}
          />
        ))}
        <td
          className="whitespace-nowrap px-2 py-2.5 text-right align-middle md:px-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-nowrap items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goView(client.id);
              }}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-slate-400 dark:hover:bg-[#1f3520] dark:hover:text-slate-200"
              title="View"
              aria-label="View client"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(client.id);
              }}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] sm:inline-flex dark:text-slate-400 dark:hover:bg-[#1f3520] dark:hover:text-slate-200"
              title="Edit"
              aria-label="Edit client"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {client.is_active === false && canReactivateClient ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReactivate(client);
                }}
                title="Reactivate client"
                aria-label="Reactivate client"
                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] sm:inline-flex dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            ) : null}
            {canDeleteOne ? (
              <button
                type="button"
                title="Delete"
                aria-label="Delete client"
                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] sm:inline-flex dark:text-red-400 dark:hover:bg-red-950/30"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!window.confirm("Deactivate this client?")) return;
                  onDeleteOne(client.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </td>
      </tr>
    );
  }
);
ClientRow.displayName = "ClientRow";

type Props = {
  tabCounts: TabCounts;
  tab: string;
  /** Current URL search string (server). */
  search: string;
  currentPage: number;
  pageSize: number;
  sortField: ClientsListSortField;
  sortDir: "asc" | "desc";
  clients: ClientsListItem[];
  totalCount: number;
  userRole: string;
  staffMembers: { id: string; full_name: string | null; email?: string | null }[];
  currentUserName: string;
  currentUserId: string;
  canExportCsv: boolean;
};

export function ClientsListClient({
  tabCounts,
  tab,
  search,
  currentPage,
  pageSize,
  sortField,
  sortDir,
  clients,
  totalCount,
  userRole,
  staffMembers,
  currentUserName,
  currentUserId,
  canExportCsv,
}: Props) {
  const router = useRouter();
  const searchActive = search.trim().length > 0;
  const [bulkPending, startTransition] = useTransition();
  const [navPending, startNav] = useTransition();
  const [localSearch, setLocalSearch] = useState(search ?? "");
  const lastNavigatedQRef = useRef(search.trim());
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [stageOpen, setStageOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [pickStage, setPickStage] = useState<string>("lead");
  const [pickAssign, setPickAssign] = useState<string>("");
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivateClient, setReactivateClient] = useState<ClientsListItem | null>(null);
  const [reactivateStage, setReactivateStage] = useState("lead");
  const [isReactivating, setIsReactivating] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => [...DEFAULT_VISIBLE_COLUMNS]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  const canDeleteOne = canDeleteClientRecord(userRole);
  const canReactivateClient = userRole === "dev" || userRole === "admin";
  const canBulkDelete = canBulkDeleteClients(userRole);

  const onDeleteOne = useCallback((id: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("clientId", id);
      const res = await softDeleteClient(fd);
      if (res.ok) {
        toast.success("Client deactivated.");
        router.refresh();
      } else {
        toast.error(toUserFacingError(res.error));
      }
    });
  }, [router]);

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
    if (!showColumnPicker) return;
    const onDown = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showColumnPicker]);

  const navigate = useCallback(
    (href: string) => {
      startNav(() => {
        router.push(href);
      });
    },
    [router, startNav]
  );

  useEffect(() => {
    const fromUrl = search.trim();
    if (fromUrl === lastNavigatedQRef.current) return;
    lastNavigatedQRef.current = fromUrl;
    setLocalSearch(search);
  }, [search]);

  const orderedVisibleColumns = useMemo(
    () => visibleColumns.filter((id) => AVAILABLE_COLUMNS.some((c) => c.id === id)),
    [visibleColumns]
  );

  const isMdUp = useMediaQuery("(min-width: 768px)");

  /** Columns that participate in width layout (excludes md-hidden cols on mobile). */
  const layoutColumns = useMemo(() => {
    if (isMdUp) return orderedVisibleColumns;
    return orderedVisibleColumns.filter((id) => !COLUMNS_HIDDEN_BELOW_MD.has(id));
  }, [orderedVisibleColumns, isMdUp]);

  const tableMinWidth = useMemo(() => {
    if (!isMdUp) return undefined;
    const cols = orderedVisibleColumns.concat(["actions"]);
    return (
      CHECKBOX_COL_WIDTH +
      cols.reduce((sum, col) => sum + (COLUMN_WIDTHS[col] ?? 120), 0)
    );
  }, [orderedVisibleColumns, isMdUp]);

  const getLayoutColWidth = useCallback(
    (colId: string) => {
      if (!isMdUp) {
        return MOBILE_COLUMN_WIDTHS[colId] ?? 0;
      }
      return COLUMN_WIDTHS[colId] ?? 120;
    },
    [isMdUp]
  );

  const onHeaderSort = useCallback((f: ClientsListSortField, d: "asc" | "desc") => {
    navigate(
      buildListHref({
        tab,
        page: 1,
        q: search.trim() || undefined,
        size: pageSize,
        sort: f,
        dir: d,
      })
    );
  }, [navigate, tab, search, pageSize]);

  const renderColumnHeader = (colId: string) => {
    switch (colId) {
      case "client_status":
        return (
          <SortableHeader
            key={colId}
            field="active"
            label="Status"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onHeaderSort}
            className="hidden w-[72px] whitespace-nowrap md:table-cell"
          />
        );
      case "name":
        return (
          <SortableHeader
            key={colId}
            field="last_name"
            label="Client"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onHeaderSort}
            className="min-w-0 px-2 max-md:w-auto md:w-[220px] md:px-4"
          />
        );
      case "phone":
        return (
          <SortableHeader
            key={colId}
            field="phone_mobile"
            label="Phone"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onHeaderSort}
            className="hidden w-[140px] md:table-cell"
          />
        );
      case "email":
        return (
          <SortableHeader
            key={colId}
            field="email"
            label="Email"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onHeaderSort}
            className="hidden w-[180px] md:table-cell"
          />
        );
      case "stage":
        return (
          <SortableHeader
            key={colId}
            field="stage"
            label="Stage"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onHeaderSort}
            className="w-[108px] px-2 max-md:whitespace-normal md:w-[140px] md:px-4"
          />
        );
      case "sales_user":
        return (
          <SortableHeader
            key={colId}
            field="assignee_name"
            label="Accounts"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onHeaderSort}
            className="hidden w-[130px] md:table-cell"
          />
        );
      case "services":
        return (
          <th
            key={colId}
            scope="col"
            className="hidden w-[130px] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 md:table-cell dark:text-slate-400"
          >
            Services
          </th>
        );
      case "created_at":
        return (
          <SortableHeader
            key={colId}
            field="created_at"
            label="Date added"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onHeaderSort}
            className="hidden w-[110px] whitespace-nowrap md:table-cell"
          />
        );
      case "days_in_stage":
        return (
          <SortableHeader
            key={colId}
            field="days_in_stage"
            label="Days in stage"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onHeaderSort}
            className="hidden w-[90px] md:table-cell"
          />
        );
      default:
        return null;
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageClamped = Math.min(currentPage, totalPages);
  const displayRows = clients;

  const idsOnPage = useMemo(() => displayRows.map((c) => c.id), [displayRows]);
  const allOnPageSelected =
    idsOnPage.length > 0 && idsOnPage.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of idsOnPage) next.delete(id);
      } else {
        for (const id of idsOnPage) next.add(id);
      }
      return next;
    });
  }, [allOnPageSelected, idsOnPage]);

  const selectedList = useMemo(
    () => displayRows.filter((c) => selected.has(c.id)),
    [displayRows, selected]
  );

  const exportSelected = useCallback(() => {
    if (!canExportCsv) return;
    const rows = selectedList;
    if (rows.length === 0) return;
    const header = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Stage",
      "Status",
      "Date Added",
      "Accounts",
    ];
    const esc = (v: string) => {
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const lines = [
      header.join(","),
      ...rows.map((c) => {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
        const st =
          c.stage === "closed"
            ? "Archived"
            : c.is_active === true
              ? "Active"
              : "Inactive";
        const added = c.created_at
          ? formatDate(c.created_at, {
              month: "numeric",
              day: "numeric",
              year: "numeric",
            })
          : "";
        return [
          esc(c.first_name?.trim() || ""),
          esc(c.last_name?.trim() || ""),
          esc((c.email ?? "").trim()),
          esc(
            c.phone_mobile?.trim() ||
              c.phone?.trim() ||
              c.phone_work?.trim() ||
              c.phone_home?.trim() ||
              ""
          ),
          esc(getStageLabel(c.stage)),
          esc(st),
          esc(added),
          esc((c.assignee_name ?? "").trim()),
        ].join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clients-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Exported ${rows.length} client(s).`);
  }, [canExportCsv, selectedList]);

  const goView = useCallback(
    (id: string) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("clientListUrl", window.location.href);
      }
      router.push(`/clients/${id}`);
    },
    [router]
  );

  const onEdit = useCallback(
    (id: string) => {
      router.push(`/clients/${id}/edit`);
    },
    [router]
  );

  const onReactivate = useCallback(
    (client: ClientsListItem) => {
      // Reactivating resets stage and clears dnc_reason, so it must never run on
      // a client who is already active.
      if (client.is_active !== false) {
        toast.error("That client is already active.");
        return;
      }
      setReactivateClient(client);
      setReactivateStage("lead");
      setShowReactivateModal(true);
    },
    []
  );

  const reactivateInFlight = useRef(false);

  const handleReactivate = useCallback(async () => {
    if (!reactivateClient || reactivateInFlight.current) return;
    reactivateInFlight.current = true;
    setIsReactivating(true);
    try {
      const supabase = createClient();
      // `.eq("is_active", false)` makes the write itself refuse to touch a live
      // client, even if the UI or a stale row got it wrong.
      const { data: updated, error } = await supabase
        .from("clients")
        .update({
          is_active: true,
          stage: reactivateStage,
          dnc_reason: null,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reactivateClient.id)
        .eq("is_active", false)
        .select("id")
        .maybeSingle();

      if (error) {
        toast.error("Failed to reactivate client");
        return;
      }
      if (!updated) {
        toast.error("That client is already active — nothing was changed.");
        setShowReactivateModal(false);
        setReactivateClient(null);
        router.refresh();
        return;
      }

      const { error: auditErr } = await supabase.from("audit_log").insert({
        client_id: reactivateClient.id,
        action: "client_reactivated",
        new_value: {
          stage: reactivateStage,
          reactivated_by: currentUserName,
          previous_stage: reactivateClient.stage,
          previous_dnc_reason: reactivateClient.dnc_reason,
        },
        performed_by: currentUserId,
        performed_by_name: currentUserName,
      });
      if (auditErr) {
        console.error("[ClientsList] audit_log insert:", auditErr);
      }

      const noteBody =
        `Client reactivated by ${currentUserName}. Returned to ${reactivateStage} stage. Previously: ${reactivateClient.stage}` +
        (reactivateClient.dnc_reason ? ` (${reactivateClient.dnc_reason})` : "");

      const { error: commErr } = await supabase.from("communications").insert({
        client_id: reactivateClient.id,
        type: "note",
        direction: "internal",
        body: noteBody,
        sent_at: new Date().toISOString(),
        recorded_by: currentUserId,
      });
      if (commErr) {
        console.error("[ClientsList] communications insert:", commErr);
      }

      toast.success(`${reactivateClient.first_name ?? "Client"} reactivated!`);
      setShowReactivateModal(false);
      setReactivateClient(null);
      router.refresh();
    } finally {
      reactivateInFlight.current = false;
      setIsReactivating(false);
    }
  }, [
    reactivateClient,
    reactivateStage,
    currentUserName,
    currentUserId,
    router,
  ]);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) {
      el.indeterminate = someSelected && !allOnPageSelected;
    }
  }, [someSelected, allOnPageSelected]);

  return (
    <>
      <div
        className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap"
        role="search"
      >
        <label className="sr-only" htmlFor="client-search">
          Search clients
        </label>
        <div className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-label="Search"
          />
          <input
            id="client-search"
            type="search"
            value={localSearch}
            onChange={(e) => {
              const v = e.target.value;
              setLocalSearch(v);
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
              if (!v.trim()) {
                lastNavigatedQRef.current = "";
                navigate(
                  buildListHref({
                    tab,
                    page: 1,
                    q: undefined,
                    size: pageSize,
                    sort: sortField,
                    dir: sortDir,
                  })
                );
                return;
              }
              searchDebounceRef.current = setTimeout(() => {
                const q = v.trim();
                lastNavigatedQRef.current = q;
                navigate(
                  buildListHref({
                    tab,
                    page: 1,
                    q,
                    size: pageSize,
                    sort: sortField,
                    dir: sortDir,
                  })
                );
              }, 400);
            }}
            placeholder="Search name, phone, or email…"
            autoComplete="off"
            className="crm-input w-full pl-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830]"
          />
        </div>
        {localSearch.trim() ? (
          <button
            type="button"
            onClick={() => {
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
              setLocalSearch("");
              lastNavigatedQRef.current = "";
              navigate(
                buildListHref({
                  tab,
                  page: 1,
                  q: undefined,
                  size: pageSize,
                  sort: sortField,
                  dir: sortDir,
                })
              );
            }}
            className="crm-btn-secondary"
          >
            Clear
          </button>
        ) : null}
      </div>

      {searchActive ? (
        <p className="mt-4 text-[13px] text-slate-500 dark:text-slate-400">
          Showing matches across all clients, active and archived.
        </p>
      ) : null}

      <ClientsTabRow
        activeTab={tab as ClientsPageTab}
        counts={tabCounts}
        role={userRole}
        search={search}
        pageSize={pageSize}
        sortField={sortField}
        sortDir={sortDir}
        suppressActive={searchActive}
        trailing={
          <div className="relative shrink-0" ref={columnPickerRef}>
          <button
            type="button"
            onClick={() => setShowColumnPicker((p) => !p)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-300 dark:hover:bg-[#1f3520]"
          >
            <Columns className="h-3.5 w-3.5" />
            Columns
          </button>
          {showColumnPicker ? (
            <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Show columns
              </p>
              {AVAILABLE_COLUMNS.map((col) => (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-2.5 py-1.5"
                >
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
                    className="rounded accent-[#A87830]"
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
        }
      />

      {someSelected ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#A87830]/30 bg-[#A87830]/10 px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-[#3d5c3f] dark:bg-[#242424]/80">
          <p className="shrink-0 text-sm font-medium text-slate-800 dark:text-slate-200">
            {selected.size} selected
          </p>
          <div className="-mx-4 flex min-w-0 gap-2 overflow-x-auto overflow-y-hidden px-4 pb-0.5 [-webkit-overflow-scrolling:touch] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
            <button
              type="button"
              disabled={bulkPending}
              onClick={() => setStageOpen(true)}
              className="crm-btn-secondary inline-flex items-center gap-2"
            >
              {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {bulkPending ? "Updating..." : "Change Stage"}
            </button>
            <button
              type="button"
              disabled={bulkPending}
              onClick={() => setAssignOpen(true)}
              className="crm-btn-secondary inline-flex items-center gap-2"
            >
              {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {bulkPending ? "Assigning..." : "Assign accounts"}
            </button>
            {canExportCsv ? (
              <button
                type="button"
                disabled={bulkPending}
                onClick={exportSelected}
                className="crm-btn-secondary inline-flex items-center"
              >
                Export Selected
              </button>
            ) : null}
            {canBulkDelete ? (
              <button
                type="button"
                disabled={bulkPending}
                onClick={() => {
                  if (!window.confirm(`Delete ${selected.size} client(s)?`)) return;
                  startTransition(async () => {
                    const res = await bulkSoftDelete(Array.from(selected));
                    if (res.ok) {
                      setSelected(new Set());
                      router.refresh();
                      toast.success("Clients deactivated.");
                    } else {
                      toast.error(toUserFacingError(res.error));
                    }
                  });
                }}
                className="inline-flex shrink-0 min-h-11 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-[#1C1C1C] dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {bulkPending ? "Deleting..." : "Delete Selected"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="crm-table-wrap mt-5 overflow-hidden">
        {!navPending && clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <p className="text-base font-medium text-slate-700 dark:text-slate-300">
              No clients match your filters.
            </p>
            <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Try another tab or clear your search.
            </p>
            <Link href="/clients/new" className="crm-btn-primary mt-6 inline-flex">
              Add new client
            </Link>
          </div>
        ) : (
          <>
            {/* ── Mobile card list (< md) ── */}
            <div className={`md:hidden transition-opacity duration-150 ${navPending ? "opacity-60" : "opacity-100"}`}>
              {navPending ? (
                <div className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
                  {Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-gray-100 dark:bg-[#2E2E2E]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-[60%] animate-pulse rounded-full bg-gray-100 dark:bg-[#2E2E2E]" />
                        <div className="h-3 w-[30%] animate-pulse rounded-full bg-gray-100 dark:bg-[#2E2E2E]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
                  {displayRows.map((client) => {
                    const displayName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "—";
                    return (
                      <div
                        key={client.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => goView(client.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            goView(client.id);
                          }
                        }}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 active:bg-slate-100 dark:hover:bg-[#242424]/40"
                      >
                        <div className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-[#A87830] focus:ring-[#A87830]"
                            checked={selected.has(client.id)}
                            onChange={() => toggleOne(client.id)}
                            aria-label={`Select ${displayName}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-semibold text-gray-900 dark:text-slate-100"
                            style={{ wordBreak: "normal", overflowWrap: "break-word", whiteSpace: "normal" }}
                          >
                            {displayName}
                          </p>
                          <div className="mt-1">
                            {clientListDncStageBadge(client, true) ?? (
                              <StagePill stage={client.stage} className="text-[10px] px-1.5" />
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); goView(client.id); }}
                          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-slate-400 dark:hover:bg-[#1f3520] dark:hover:text-slate-200"
                          title="View"
                          aria-label="View client"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Desktop table (≥ md) ── */}
            <div
              className={`hidden md:block overflow-x-auto transition-opacity duration-150 ${
                navPending ? "opacity-60" : "opacity-100"
              }`}
            >
              <table
                className="w-full border-collapse table-fixed divide-y divide-slate-200 text-left text-sm dark:divide-slate-700"
                style={
                  tableMinWidth != null
                    ? { width: "100%", minWidth: `${tableMinWidth}px` }
                    : { width: "100%" }
                }
              >
                <colgroup>
                  <col
                    style={{
                      width: isMdUp ? CHECKBOX_COL_WIDTH : MOBILE_CHECKBOX_COL_WIDTH,
                    }}
                  />
                  {orderedVisibleColumns.map((colId) => (
                    <col
                      key={colId}
                      style={{
                        width: layoutColumns.includes(colId)
                          ? getLayoutColWidth(colId)
                          : 0,
                      }}
                    />
                  ))}
                  <col
                    style={{
                      width: isMdUp ? COLUMN_WIDTHS.actions : MOBILE_ACTIONS_COL_WIDTH,
                    }}
                  />
                </colgroup>
                <thead>
                <tr className="crm-table-head-row">
                    <th scope="col" className="w-10 px-3 py-2.5 text-left align-middle">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-[#A87830] focus:ring-[#A87830]"
                        checked={allOnPageSelected}
                        onChange={toggleAllOnPage}
                        aria-label="Select all on this page"
                      />
                    </th>
                    {orderedVisibleColumns.map((colId) => renderColumnHeader(colId))}
                    <th
                      scope="col"
                      className="w-[80px] px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 max-md:sr-only md:w-[140px] md:px-3 dark:text-slate-400"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                {navPending ? (
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
                    {Array.from({ length: pageSize }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-[#2E2E2E]">
                        <td className="px-3 py-2.5">
                          <div className="h-4 w-4 animate-pulse rounded bg-gray-100 dark:bg-[#2E2E2E]" />
                        </td>
                        {orderedVisibleColumns.map((colId) => (
                          <td key={colId} className="px-4 py-2.5">
                            <div className="h-3.5 max-w-[12rem] w-[85%] animate-pulse rounded-full bg-gray-100 dark:bg-[#2E2E2E]" />
                          </td>
                        ))}
                        <td className="px-3 py-2.5">
                          <div className="h-3.5 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-[#2E2E2E]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ) : (
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
                    {displayRows.map((client) => (
                      <ClientRow
                        key={client.id}
                        client={client}
                        isSelected={selected.has(client.id)}
                        toggleOne={toggleOne}
                        goView={goView}
                        onEdit={onEdit}
                        onReactivate={onReactivate}
                        canReactivateClient={canReactivateClient}
                        canDeleteOne={canDeleteOne}
                        onDeleteOne={onDeleteOne}
                        orderedVisibleColumns={orderedVisibleColumns}
                        searchActive={searchActive}
                      />
                    ))}
                  </tbody>
                )}
              </table>
            </div>
          </>
        )}

        {!navPending && clients.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 px-4 py-4 md:flex-row dark:border-[#2E2E2E]">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Showing{" "}
              <span className="font-medium text-slate-900 dark:text-slate-200">
                {totalCount === 0
                  ? 0
                  : `${(pageClamped - 1) * pageSize + 1}–${Math.min(pageClamped * pageSize, totalCount)}`}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-900 dark:text-slate-200">
                {totalCount.toLocaleString()}
              </span>{" "}
              clients
              {search.trim() ? (
                <span className="text-slate-500 dark:text-slate-400">
                  {" "}
                  · {tabCounts.all.toLocaleString()} in your scope
                </span>
              ) : null}
            </p>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-slate-400">Show</span>
                {[25, 50, 100, 500].map((size) => (
                  <button
                    key={size}
                    type="button"
                    disabled={navPending}
                    onClick={() =>
                      navigate(
                        buildListHref({
                          tab,
                          page: 1,
                          q: search.trim() || undefined,
                          size,
                          sort: sortField,
                          dir: sortDir,
                        })
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                      pageSize === size
                        ? "border-[#A87830] bg-[#A87830] text-[#161616]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-[#2E2E2E] dark:text-slate-300 dark:hover:border-slate-500"
                    }`}
                  >
                    {size}
                  </button>
                ))}
                <span className="text-xs text-gray-500 dark:text-slate-400">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pageClamped <= 1 || navPending}
                  onClick={() =>
                    navigate(
                      buildListHref({
                        tab,
                        page: Math.max(1, pageClamped - 1),
                        q: search.trim() || undefined,
                        size: pageSize,
                        sort: sortField,
                        dir: sortDir,
                      })
                    )
                  }
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    pageClamped <= 1 || navPending
                      ? "cursor-not-allowed border-slate-100 text-slate-300 dark:border-[#2E2E2E] dark:text-slate-600"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
                  }`}
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Page {pageClamped} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={pageClamped >= totalPages || navPending}
                  onClick={() =>
                    navigate(
                      buildListHref({
                        tab,
                        page: Math.min(totalPages, pageClamped + 1),
                        q: search.trim() || undefined,
                        size: pageSize,
                        sort: sortField,
                        dir: sortDir,
                      })
                    )
                  }
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    pageClamped >= totalPages || navPending
                      ? "cursor-not-allowed border-slate-100 text-slate-300 dark:border-[#2E2E2E] dark:text-slate-600"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {showReactivateModal && reactivateClient ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reactivate-client-title"
        >
          <div className="crm-modal-panel">
            <h3
              id="reactivate-client-title"
              className="text-lg font-bold text-gray-900 dark:text-slate-100"
            >
              Reactivate Client
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {reactivateClient.first_name} {reactivateClient.last_name} will be reactivated and returned to the
              selected stage.
            </p>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Restart at Stage
            </label>
            <select
              value={reactivateStage}
              disabled={isReactivating}
              onChange={(e) => setReactivateStage(e.target.value)}
              className="mt-1 mb-5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#A87830] focus:outline-none dark:border-[#2E2E2E] dark:bg-[#242424] dark:text-slate-100"
            >
              <optgroup label="Sales Pipeline">
                <option value="lead">New Lead</option>
                <option value="account_manager">Account Manager</option>
                <option value="retention">Retention</option>
              </optgroup>
              <optgroup label="Service Pipeline">
                <option value="client_services">Client Services</option>
                <option value="awaiting_collection_letter">Awaiting Collection Letter</option>
              </optgroup>
            </select>

            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                {`⚠️ Heads up — bringing this client back will mark them as active again and remove any "do not contact" flags on their account. Your team will be able to see and work with them like normal. We'll save a note of who did this and when.`}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isReactivating}
                onClick={() => {
                  if (isReactivating) return;
                  setShowReactivateModal(false);
                  setReactivateClient(null);
                }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#1f3520]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReactivate()}
                disabled={isReactivating}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  isReactivating
                    ? "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-slate-700 dark:text-slate-500"
                    : "bg-[#A87830] text-[#161616] hover:bg-[#8C6428]"
                }`}
              >
                {isReactivating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Working on it...
                  </>
                ) : (
                  "Reactivate Client"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stageOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="crm-modal-panel">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Change stage
            </h3>
            <select
              value={pickStage}
              onChange={(e) => setPickStage(e.target.value)}
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-[#2E2E2E] dark:bg-[#242424] dark:text-slate-100"
            >
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStageOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-[#2E2E2E] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkPending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await bulkChangeStage(Array.from(selected), pickStage);
                    if (res.ok) {
                      setSelected(new Set());
                      setStageOpen(false);
                      router.refresh();
                      toast.success("Updated.");
                    } else {
                      toast.error(toUserFacingError(res.error));
                    }
                  });
                }}
                className="flex items-center gap-2 rounded-lg bg-[#A87830] px-4 py-2 text-sm font-semibold text-[#161616] disabled:opacity-50"
              >
                {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {bulkPending ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="crm-modal-panel">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Assign accounts
            </h3>
            <select
              value={pickAssign}
              onChange={(e) => setPickAssign(e.target.value)}
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-[#2E2E2E] dark:bg-[#242424] dark:text-slate-100"
            >
              <option value="">Unassigned</option>
              {staffMembers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name?.trim() || s.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-[#2E2E2E] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkPending}
                onClick={() => {
                  const assignee = pickAssign || null;
                  startTransition(async () => {
                    const res = await bulkAssign(Array.from(selected), assignee);
                    if (res.ok) {
                      setSelected(new Set());
                      setAssignOpen(false);
                      router.refresh();
                      toast.success("Updated.");
                    } else {
                      toast.error(toUserFacingError(res.error));
                    }
                  });
                }}
                className="flex items-center gap-2 rounded-lg bg-[#A87830] px-4 py-2 text-sm font-semibold text-[#161616] disabled:opacity-50"
              >
                {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {bulkPending ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

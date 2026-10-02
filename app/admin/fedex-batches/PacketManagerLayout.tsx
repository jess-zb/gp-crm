"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clipboard, Download, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toUserFacingError } from "@/lib/user-facing-error";
import { searchFilter } from "@/lib/clients/client-search";
import { getNextFedexBatchCountdownLabel, getNextFedexBatchDeadline } from "@/lib/utils/date";
import {
  buildPacketsNeededCsv,
  downloadPacketsNeededCsv,
  packetNeededRowToExportRow,
} from "@/lib/packets/packets-needed-export";
import { BatchCalendarModal } from "./BatchCalendarModal";
import { shipmentSearchFilter } from "@/lib/packets/shipment-search";
import {
  FedexPacketsDeliveredHeader,
  FedexPacketsSentHeader,
} from "./FedexBatchActions";
import { BatchSummarySection } from "./BatchSummarySection";
import { NeededPacketsTable } from "./NeededPacketsTable";
import { ManagePacketMidOptions } from "./ManagePacketMidOptions";
import { ShipmentTable } from "./ShipmentTable";
import type { PacketNeededRow, PacketShipmentRow } from "./packet-manager-types";
import {
  canonicalizeMerchantName,
  mergeMerchantOptions,
  PACKET_MID_EXTRAS_SETTING_KEY,
  parsePacketMidExtras,
} from "@/lib/constants/merchants";
import {
  FEDEX_PRINT_BATCH_ENABLED_KEY,
  isFedexPrintBatchEnabled,
} from "@/lib/packets/print-batch-setting";
import {
  sortNeededClients,
  sortShipments,
  type NeededSortField,
  type ShipmentSortField,
  type SortDir,
} from "@/lib/packets/shipment-sort";

const ARCHIVE_PAGE_SIZE = 100;


function fullName(c: {
  first_name: string | null;
  last_name: string | null;
  spouse_first_name?: string | null;
  spouse_last_name?: string | null;
  recipient_type?: "primary" | "secondary";
}) {
  if (c.recipient_type === "secondary") {
    return (
      `${c.spouse_first_name ?? ""} ${c.spouse_last_name ?? ""}`.trim() || "—"
    );
  }
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
}

function formatAddress(c: {
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}) {
  const parts = [
    c.street_address,
    [c.city, c.state].filter(Boolean).join(", "),
    c.zip_code,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function assignedFullName(
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

function dedupeShipments(rows: PacketShipmentRow[]): PacketShipmentRow[] {
  const byId = new Map<string, PacketShipmentRow>();
  for (const s of rows) byId.set(s.id, s);
  return Array.from(byId.values());
}

function formatBatchTabSubtitle(batchId: string | null): string | null {
  if (!batchId) return null;
  const d = new Date(`${batchId}T12:00:00`);
  if (Number.isNaN(d.getTime())) return batchId;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PacketManagerLayout({
  isAdmin,
  isDev,
  canExport,
  canExportCsv,
  canEditMid,
  canManualSend = false,
  packetsNeeded,
  packetsSent,
  packetsDelivered,
  archiveShipments,
  latestBatch,
  secondBatch,
}: {
  isAdmin: boolean;
  isDev: boolean;
  canExport: boolean;
  canExportCsv: boolean;
  canEditMid: boolean;
  canManualSend?: boolean;
  packetsNeeded: PacketNeededRow[];
  packetsSent: PacketShipmentRow[];
  packetsDelivered: PacketShipmentRow[];
  archiveShipments: PacketShipmentRow[];
  latestBatch: string | null;
  secondBatch: string | null;
}) {
  type TabId = "packet_needed" | "packet_sent" | "packet_delivered" | "archive";
  const [activeTab, setActiveTab] = useState<TabId>("packet_needed");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<ShipmentSortField>("batch_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [neededSortField, setNeededSortField] =
    useState<NeededSortField>("batch_date");
  const [neededSortDir, setNeededSortDir] = useState<SortDir>("asc");
  const [archivePage, setArchivePage] = useState(1);
  const [archiveRefreshLoading, setArchiveRefreshLoading] = useState(false);
  const [moveBatchLoading, setMoveBatchLoading] = useState<string | null>(null);
  const [rowActionLoading, setRowActionLoading] = useState<string | null>(null);
  const [manualSendLoadingKey, setManualSendLoadingKey] = useState<string | null>(
    null
  );
  const [countdownTick, setCountdownTick] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [merchantOverrides, setMerchantOverrides] = useState<Record<string, string>>({});
  const [midSaving, setMidSaving] = useState<Set<string>>(new Set());
  const [midExtras, setMidExtras] = useState<string[]>([]);
  const [printBatchEnabled, setPrintBatchEnabled] = useState(false);
  const [printBatchSettingLoaded, setPrintBatchSettingLoaded] = useState(false);
  const [printBatchToggling, setPrintBatchToggling] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const midOptions = useMemo(() => mergeMerchantOptions(midExtras), [midExtras]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase
      .from("crm_settings")
      .select("value")
      .eq("key", PACKET_MID_EXTRAS_SETTING_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("[PacketManager] mid extras load error:", error.message);
          return;
        }
        setMidExtras(parsePacketMidExtras(data?.value));
      });
    void supabase
      .from("crm_settings")
      .select("value")
      .eq("key", FEDEX_PRINT_BATCH_ENABLED_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("[PacketManager] print batch setting:", error.message);
        }
        setPrintBatchEnabled(isFedexPrintBatchEnabled(data?.value));
        setPrintBatchSettingLoaded(true);
      });
  }, []);

  const togglePrintBatch = useCallback(async () => {
    if (printBatchToggling) return;
    const next = !printBatchEnabled;
    setPrintBatchToggling(true);
    setPrintBatchEnabled(next);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("crm_settings").upsert({
      key: FEDEX_PRINT_BATCH_ENABLED_KEY,
      value: String(next),
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    setPrintBatchToggling(false);
    if (error) {
      setPrintBatchEnabled(!next);
      toast.error("Could not update printer dispatch");
      return;
    }
    toast.success(
      next
        ? "Printer cron is on — Sunday & Wednesday batches will send"
        : "Printer cron paused — nothing will go to print"
    );
  }, [printBatchEnabled, printBatchToggling, toast]);

  const searchActive = search.trim().length > 0;

  const handleSort = useCallback(
    (field: ShipmentSortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField]
  );

  const handleNeededSort = useCallback(
    (field: NeededSortField) => {
      if (neededSortField === field) {
        setNeededSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setNeededSortField(field);
        setNeededSortDir("asc");
      }
    },
    [neededSortField]
  );

  useEffect(() => {
    setArchivePage(1);
  }, [search, sortField, sortDir, neededSortField, neededSortDir]);

  useEffect(() => {
    const id = setInterval(() => setCountdownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Realtime: when a client profile changes (address, MIDs, spouse added, etc.),
  // refresh the Packets Needed tab so the queue always reflects the latest data.
  // Debounced so a rapid sequence of edits only triggers one router.refresh().
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const scheduleRefresh = () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => {
        router.refresh();
      }, 1500);
    };
    const channel = supabase
      .channel("packet-manager-clients")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clients" },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const batchBanner = useMemo(() => {
    void countdownTick;
    return getNextFedexBatchCountdownLabel(new Date());
  }, [countdownTick]);

  const nextBatchSubtitle = useMemo(() => {
    const next = getNextFedexBatchDeadline(new Date());
    return next.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, []);

  const allShipmentsForSearch = useMemo(
    () =>
      dedupeShipments([
        ...packetsSent,
        ...packetsDelivered,
        ...archiveShipments,
      ]),
    [packetsSent, packetsDelivered, archiveShipments]
  );

  const packetsNeededWithMerchants = useMemo(
    () =>
      packetsNeeded.map((c) => ({
        ...c,
        fedex_merchant: merchantOverrides[c.id] ?? c.fedex_merchant ?? null,
      })),
    [packetsNeeded, merchantOverrides]
  );

  const filteredNeeded = useMemo(() => {
    if (!searchActive) return packetsNeededWithMerchants;
    return packetsNeededWithMerchants.filter((c) =>
      searchFilter(
        {
          first_name: c.first_name,
          last_name: c.last_name,
          spouse_first_name: c.spouse_first_name,
          spouse_last_name: c.spouse_last_name,
          email: null,
          phone_mobile: c.phone_mobile,
          city: c.city,
          zip_code: c.zip_code,
          street_address: c.street_address,
        },
        search
      )
    );
  }, [packetsNeededWithMerchants, search, searchActive]);

  const filteredSent = useMemo(() => {
    const base = packetsSent;
    if (!searchActive) return base;
    return base.filter((s) => shipmentSearchFilter(s, search));
  }, [packetsSent, search, searchActive]);

  const filteredDelivered = useMemo(() => {
    const base = packetsDelivered;
    if (!searchActive) return base;
    return base.filter((s) => shipmentSearchFilter(s, search));
  }, [packetsDelivered, search, searchActive]);

  const filteredArchive = useMemo(() => {
    if (!searchActive) return archiveShipments;
    return archiveShipments.filter((s) => shipmentSearchFilter(s, search));
  }, [archiveShipments, search, searchActive]);

  const combinedSearchShipments = useMemo(() => {
    if (!searchActive) return [];
    return allShipmentsForSearch.filter((s) => shipmentSearchFilter(s, search));
  }, [allShipmentsForSearch, search, searchActive]);

  const sortedNeeded = useMemo(
    () => sortNeededClients(filteredNeeded, neededSortField, neededSortDir),
    [filteredNeeded, neededSortField, neededSortDir]
  );

  const sortedMainNeeded = useMemo(
    () => sortNeededClients(packetsNeededWithMerchants, neededSortField, neededSortDir),
    [packetsNeededWithMerchants, neededSortField, neededSortDir]
  );

  const sortedSent = useMemo(
    () => sortShipments(filteredSent, sortField, sortDir),
    [filteredSent, sortField, sortDir]
  );

  const sortedDelivered = useMemo(
    () => sortShipments(filteredDelivered, sortField, sortDir),
    [filteredDelivered, sortField, sortDir]
  );

  const sortedArchive = useMemo(
    () => sortShipments(filteredArchive, sortField, sortDir),
    [filteredArchive, sortField, sortDir]
  );

  const sortedSearchShipments = useMemo(
    () => sortShipments(combinedSearchShipments, sortField, sortDir),
    [combinedSearchShipments, sortField, sortDir]
  );

  const paginatedArchive = useMemo(() => {
    const start = (archivePage - 1) * ARCHIVE_PAGE_SIZE;
    return sortedArchive.slice(start, start + ARCHIVE_PAGE_SIZE);
  }, [sortedArchive, archivePage]);

  const totalArchivePages = Math.max(
    1,
    Math.ceil(sortedArchive.length / ARCHIVE_PAGE_SIZE)
  );

  const handleBatchAction = useCallback(
    async (action: string) => {
      setMoveBatchLoading(action);
      try {
        const r = await fetch("/api/packets/batch-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const j = (await r.json()) as {
          error?: string;
          updated?: number;
        };
        if (!r.ok) throw new Error(j.error ?? "Action failed");
        toast.success(`Done — ${j.updated ?? 0} record(s) updated`);
        router.refresh();
      } catch (e) {
        toast.error(toUserFacingError(e instanceof Error ? e.message : "Action failed"));
      } finally {
        setMoveBatchLoading(null);
      }
    },
    [router, toast]
  );

  const handleSendNeededToSent = useCallback(async () => {
    setMoveBatchLoading("needed_to_sent");
    try {
      const r = await fetch("/api/postlogic/send-batch", { method: "POST" });
      const j = (await r.json()) as { error?: string; count?: number; message?: string };
      if (!r.ok) throw new Error(j.error ?? "Send failed");
      toast.success(j.message ?? `Sent ${j.count ?? 0} client(s) to print`);
      router.refresh();
    } catch (e) {
      toast.error(toUserFacingError(e instanceof Error ? e.message : "Send failed"));
    } finally {
      setMoveBatchLoading(null);
    }
  }, [router, toast]);

  const handleMarkDelivered = useCallback(
    async (shipmentId: string) => {
      setRowActionLoading(shipmentId);
      try {
        const r = await fetch("/api/packets/batch-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_delivered", shipmentId }),
        });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Action failed");
        toast.success("Marked as Delivered");
        router.refresh();
      } catch (e) {
        toast.error(toUserFacingError(e instanceof Error ? e.message : "Action failed"));
      } finally {
        setRowActionLoading(null);
      }
    },
    [router, toast]
  );

  const handleReturnToQueue = useCallback(
    async (clientId: string) => {
      setRowActionLoading(clientId);
      try {
        const r = await fetch("/api/packets/batch-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset_to_needed", clientId }),
        });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Action failed");
        toast.success("Returned to Packets Needed");
        router.refresh();
      } catch (e) {
        toast.error(toUserFacingError(e instanceof Error ? e.message : "Action failed"));
      } finally {
        setRowActionLoading(null);
      }
    },
    [router, toast]
  );

  const handleArchiveRefreshAll = useCallback(async () => {
    setArchiveRefreshLoading(true);
    try {
      const r = await fetch("/api/postlogic/poll-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveRefreshAll: true }),
      });
      const j = (await r.json()) as {
        error?: string;
        polled?: number;
        updated?: number;
      };
      if (!r.ok) throw new Error(j.error ?? "Refresh failed");
      toast.success(
        `Refreshed ${j.polled ?? 0} shipment(s); ${j.updated ?? 0} update(s)`
      );
      router.refresh();
    } catch (e) {
      toast.error(
        toUserFacingError(e instanceof Error ? e.message : "Refresh failed")
      );
    } finally {
      setArchiveRefreshLoading(false);
    }
  }, [router, toast]);

  const resolveMerchant = useCallback(
    (c: PacketNeededRow) =>
      canonicalizeMerchantName(
        merchantOverrides[c.id]?.trim() ||
          c.fedex_merchant?.trim() ||
          c.card_merchant?.trim() ||
          ""
      ),
    [merchantOverrides]
  );

  const handleSaveMid = useCallback(
    async (clientId: string, merchant: string) => {
      setMidSaving((prev) => new Set(Array.from(prev).concat(clientId)));
      try {
        const r = await fetch("/api/packets/save-mid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, merchant }),
        });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Failed to save MID");
        setMerchantOverrides((prev) => ({ ...prev, [clientId]: merchant }));
        toast.success("MID updated");
        router.refresh();
      } catch (e) {
        toast.error(toUserFacingError(e instanceof Error ? e.message : "Failed to save"));
      } finally {
        setMidSaving((prev) => {
          const next = new Set(prev);
          next.delete(clientId);
          return next;
        });
      }
    },
    [router, toast]
  );

  const handleSkipSecondary = useCallback(
    async (clientId: string) => {
      const rowKey = `${clientId}-secondary`;
      setRowActionLoading(rowKey);
      try {
        const r = await fetch("/api/packets/skip-secondary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Failed to skip secondary");
        toast.success("Secondary recipient skipped");
        router.refresh();
      } catch (e) {
        toast.error(
          toUserFacingError(e instanceof Error ? e.message : "Failed to skip")
        );
      } finally {
        setRowActionLoading(null);
      }
    },
    [router, toast]
  );

  const handleManualSend = useCallback(
    async (clientId: string, recipientType: "primary" | "secondary") => {
      const rowKey = `${clientId}-${recipientType}`;
      setManualSendLoadingKey(rowKey);
      try {
        const r = await fetch("/api/packets/manual-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, recipientType }),
        });
        const j = (await r.json()) as { error?: string; message?: string };
        if (!r.ok) throw new Error(j.error ?? "Manual send failed");
        toast.success(j.message ?? "Sent to PostLogic");
        router.refresh();
      } catch (e) {
        toast.error(
          toUserFacingError(e instanceof Error ? e.message : "Manual send failed")
        );
      } finally {
        setManualSendLoadingKey(null);
      }
    },
    [router, toast]
  );

  const handleExportPackets = useCallback(() => {
    if (!canExportCsv) return;
    const exportRows = sortedMainNeeded.map((row) =>
      packetNeededRowToExportRow(row, {
        fullName,
        advisor: (r) => assignedFullName(r.assigned_user),
        merchant: resolveMerchant,
      })
    );
    downloadPacketsNeededCsv(buildPacketsNeededCsv(exportRows));
  }, [canExportCsv, sortedMainNeeded, resolveMerchant]);

  const [copiedSent, setCopiedSent] = useState(false);
  const handleCopySentCsv = useCallback(() => {
    if (!canExportCsv) return;
    function csvCell(v: string) {
      if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    }
    const header = "Name,Advisor,Merchant";
    const body = sortedSent
      .map((s) =>
        [
          csvCell(s.recipient_name ?? ""),
          csvCell(s.advisor?.trim() ?? ""),
          csvCell(s.merchant?.trim() ?? ""),
        ].join(",")
      )
      .join("\n");
    void navigator.clipboard.writeText(`${header}\n${body}`).then(() => {
      setCopiedSent(true);
      setTimeout(() => setCopiedSent(false), 2000);
    });
  }, [canExportCsv, sortedSent]);

  const tabs = [
    {
      id: "packet_needed" as const,
      label: "Packets Needed",
      count: searchActive ? filteredNeeded.length : packetsNeeded.length,
      subtitle: nextBatchSubtitle,
    },
    {
      id: "packet_sent" as const,
      label: "Packets Sent",
      count: searchActive ? filteredSent.length : packetsSent.length,
      subtitle: formatBatchTabSubtitle(latestBatch),
    },
    {
      id: "packet_delivered" as const,
      label: "Packets Delivered",
      count: searchActive ? filteredDelivered.length : packetsDelivered.length,
      subtitle: formatBatchTabSubtitle(secondBatch),
    },
    {
      id: "archive" as const,
      label: "Archive",
      count: searchActive ? filteredArchive.length : archiveShipments.length,
      subtitle: null as string | null,
    },
  ];

  const combinedSearchCount =
    combinedSearchShipments.length + filteredNeeded.length;

  const archiveBatchCount = useMemo(
    () =>
      new Set(
        archiveShipments.map((s) => s.batch_id).filter((id): id is string => !!id)
      ).size,
    [archiveShipments]
  );

  const shipmentPropTotal =
    packetsSent.length + packetsDelivered.length + archiveShipments.length;


  return (
    <>
      {process.env.NODE_ENV === "development" && packetsSent.length === 0 ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Debug: shipments prop has {shipmentPropTotal.toLocaleString()} records
          total (sent {packetsSent.length}, delivered {packetsDelivered.length},
          archive {archiveShipments.length})
        </div>
      ) : null}
      <div className="mb-6 rounded-xl border border-[#8DE3B5]/20 bg-[#8DE3B5]/10 px-4 py-3 dark:border-[#8DE3B5]/30 dark:bg-[#8DE3B5]/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8DE3B5]">
              Next Batch
            </p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {batchBanner.label}
            </p>
            <p className="mt-0.5 text-xs text-gray-600 dark:text-slate-400">
              Sundays & Wednesdays · 8:00 PM Pacific · {packetsNeeded.length}{" "}
              packet{packetsNeeded.length === 1 ? "" : "s"} in queue
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isDev ? (
              <div className="flex items-center gap-2">
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8DE3B5]">
                    Dev · Printer dispatch
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {printBatchSettingLoaded
                      ? printBatchEnabled
                        ? "On"
                        : "Off"
                      : "Loading…"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void togglePrintBatch()}
                  disabled={!printBatchSettingLoaded || printBatchToggling}
                  aria-pressed={printBatchEnabled}
                  aria-label={
                    printBatchEnabled
                      ? "Pause printer dispatch"
                      : "Enable printer dispatch"
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    printBatchEnabled ? "bg-[#8DE3B5]" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      printBatchEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ) : null}
            <div className="text-left sm:text-right">
              {printBatchEnabled ? (
                <>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Sending in</p>
                  <p className="text-lg font-bold text-[#8DE3B5]">{batchBanner.countdown}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Printer</p>
                  <p className="text-lg font-bold text-[#8DE3B5]">Dispatch Off</p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="flex items-center justify-center rounded-lg border border-[#8DE3B5]/40 bg-[#8DE3B5]/10 p-2 text-[#8DE3B5] transition-colors hover:bg-[#8DE3B5]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8DE3B5]"
              title="View batch calendar"
              aria-label="View batch calendar"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipients, tracking, advisor, merchant…"
          className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#8DE3B5] focus:outline-none dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
        />
      </div>

      {searchActive ? (
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">
            Search results
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {combinedSearchCount.toLocaleString()} match
            {combinedSearchCount === 1 ? "" : "es"} across all tabs
          </p>
          {filteredNeeded.length > 0 ? (
            <div className="mb-8">
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Packets needed ({filteredNeeded.length})
              </h3>
              <NeededPacketsTable
                rows={sortedNeeded}
                emptyMessage="No packets in queue."
                sortField={neededSortField}
                sortDir={neededSortDir}
                onSort={handleNeededSort}
                fullName={fullName}
                formatAddress={formatAddress}
                assignedFullName={assignedFullName}
                canExport={canExport}
                canEditMid={canEditMid}
                canManualSend={canManualSend && printBatchEnabled}
                resolveMerchant={resolveMerchant}
                onSaveMid={handleSaveMid}
                midSaving={midSaving}
                midOptions={midOptions}
                onSkipSecondary={handleSkipSecondary}
                onManualSend={handleManualSend}
                skipLoadingKey={rowActionLoading}
                manualSendLoadingKey={manualSendLoadingKey}
              />
            </div>
          ) : null}
          <ShipmentTable
            shipments={sortedSearchShipments}
            emptyMessage={
              filteredNeeded.length > 0
                ? "No shipment records match this search."
                : "No results match this search."
            }
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </section>
      ) : null}

      <div className="mb-6 flex flex-wrap border-b border-gray-200 dark:border-[#1a3550]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-[#8DE3B5] text-[#8DE3B5]"
                : "border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
            {tab.count > 0 ? (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-[#102840] dark:text-slate-300">
                {tab.count.toLocaleString()}
              </span>
            ) : null}
            {tab.subtitle ? (
              <span className="ml-1 text-[10px] text-slate-400">
                ({tab.subtitle})
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {!searchActive && activeTab === "packet_needed" ? (
        <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Packets Needed
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {canExportCsv ? (
                <button
                  type="button"
                  onClick={handleExportPackets}
                  className="crm-btn-secondary flex items-center gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export List
                </button>
              ) : null}
              {isDev ? (
                <ManagePacketMidOptions
                  extras={midExtras}
                  onExtrasChange={setMidExtras}
                />
              ) : null}
              {isDev ? (
                <button
                  type="button"
                  onClick={() => void handleSendNeededToSent()}
                  disabled={
                    !printBatchEnabled ||
                    moveBatchLoading === "needed_to_sent" ||
                    packetsNeeded.length === 0
                  }
                  title={
                    printBatchEnabled
                      ? undefined
                      : "Printer cron is paused — turn it on to send"
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                >
                  {moveBatchLoading === "needed_to_sent" ? "Sending…" : "Send to Printer →"}
                </button>
              ) : null}
            </div>
          </div>
          <NeededPacketsTable
            rows={sortedMainNeeded}
            emptyMessage="No packets in queue."
            sortField={neededSortField}
            sortDir={neededSortDir}
            onSort={handleNeededSort}
            fullName={fullName}
            formatAddress={formatAddress}
            assignedFullName={assignedFullName}
            canExport={canExport}
            canEditMid={canEditMid}
            canManualSend={canManualSend && printBatchEnabled}
            resolveMerchant={resolveMerchant}
            onSaveMid={handleSaveMid}
            midSaving={midSaving}
            midOptions={midOptions}
            onSkipSecondary={handleSkipSecondary}
            onManualSend={handleManualSend}
            skipLoadingKey={rowActionLoading}
            manualSendLoadingKey={manualSendLoadingKey}
          />
        </section>
      ) : null}

      {!searchActive && activeTab === "packet_sent" ? (
        <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          {canExportCsv ? (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={handleCopySentCsv}
              disabled={sortedSent.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-[#1a3550] dark:bg-[#071929] dark:text-slate-300 dark:hover:bg-[#0d2035]"
            >
              <Clipboard className="h-3.5 w-3.5" />
              {copiedSent ? "Copied!" : "Copy CSV"}
            </button>
          </div>
          ) : null}
          <FedexPacketsSentHeader latestBatch={latestBatch} />
          {!latestBatch ? (
            <p className="py-8 text-center text-slate-500 dark:text-slate-400">
              No batch has been sent yet.
            </p>
          ) : (
            <ShipmentTable
              shipments={sortedSent}
              emptyMessage="No in-flight shipments."
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              isDev={isDev}
              onMarkDelivered={handleMarkDelivered}
              onReturnToQueue={handleReturnToQueue}
              rowActionLoading={rowActionLoading}
            />
          )}
        </section>
      ) : null}

      {!searchActive && activeTab === "packet_delivered" ? (
        <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          {isDev ? (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => void handleBatchAction("delivered_to_archive")}
                disabled={moveBatchLoading === "delivered_to_archive" || packetsDelivered.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
              >
                {moveBatchLoading === "delivered_to_archive" ? "Archiving…" : "Archive Batch →"}
              </button>
            </div>
          ) : null}
          <FedexPacketsDeliveredHeader secondBatch={secondBatch} />
          {!secondBatch ? (
            <p className="py-8 text-center text-slate-500 dark:text-slate-400">
              The second batch has not been sent yet.
            </p>
          ) : (
            <ShipmentTable
              shipments={sortedDelivered}
              emptyMessage="No delivered shipments yet."
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              isDev={isDev}
              onMarkDelivered={handleMarkDelivered}
              onReturnToQueue={handleReturnToQueue}
              rowActionLoading={rowActionLoading}
            />
          )}
        </section>
      ) : null}

      {!searchActive && activeTab === "archive" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Archive</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleArchiveRefreshAll()}
                disabled={archiveRefreshLoading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#8DE3B5] px-4 py-2 text-sm font-semibold text-[#0A2540] transition-colors hover:bg-[#6BC99A] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 shrink-0 ${archiveRefreshLoading ? "animate-spin" : ""}`}
                />
                {archiveRefreshLoading ? "Refreshing…" : "Refresh Status"}
              </button>
            </div>
          </div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {archiveShipments.length.toLocaleString()} total records across{" "}
              {archiveBatchCount.toLocaleString()} batch
              {archiveBatchCount === 1 ? "" : "es"}
            </p>
          </div>
          {isAdmin ? (
            <>
              <BatchSummarySection archiveShipments={sortedArchive} />
              <div className="mb-4 border-t border-slate-100 dark:border-[#1a3550]" />
            </>
          ) : null}
          <ShipmentTable
            shipments={paginatedArchive}
            emptyMessage="No archived shipments."
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            isDev={isDev}
            onMarkDelivered={handleMarkDelivered}
            onReturnToQueue={handleReturnToQueue}
            rowActionLoading={rowActionLoading}
          />
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-[#1a3550]">
            <span className="text-xs text-slate-500">
              Showing{" "}
              {sortedArchive.length === 0
                ? 0
                : (archivePage - 1) * ARCHIVE_PAGE_SIZE + 1}
              –
              {Math.min(archivePage * ARCHIVE_PAGE_SIZE, sortedArchive.length)}{" "}
              of {sortedArchive.length.toLocaleString()} records
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setArchivePage((p) => p - 1)}
                disabled={archivePage === 1}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-[#1a3550] dark:hover:bg-[#102840]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setArchivePage((p) => p + 1)}
                disabled={archivePage >= totalArchivePages}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-[#1a3550] dark:hover:bg-[#102840]"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {calendarOpen ? (
        <BatchCalendarModal onClose={() => setCalendarOpen(false)} />
      ) : null}
    </>
  );
}

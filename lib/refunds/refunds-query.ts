import type { SupabaseClient } from "@supabase/supabase-js";
import { processorLabel, type RefundStatus } from "@/lib/refunds/constants";
import { computeProcessorFloat, type ProcessorFloatState } from "@/lib/refunds/float";

const MAX_ROWS = 1000;

/** Window for the dev-only usage panel. */
const USAGE_WINDOW_DAYS = 90;

const REFUND_SELECT =
  "id, client_id, amount_cents, processor_mid, status, requested_at, requested_by_name, refunded_at, refunded_by_name, offset_billed_at, offset_amount_cents, notes, needs_review";

type RawRefund = {
  id: string;
  client_id: string;
  amount_cents: number | null;
  processor_mid: string | null;
  status: string;
  requested_at: string | null;
  requested_by_name: string | null;
  refunded_at: string | null;
  refunded_by_name: string | null;
  offset_billed_at: string | null;
  offset_amount_cents: number | null;
  notes: string | null;
  needs_review: boolean | null;
};

export type RefundRow = {
  id: string;
  clientId: string;
  clientName: string;
  amountCents: number;
  processorMid: string | null;
  processorLabel: string;
  status: RefundStatus;
  requestedAt: string | null;
  requestedByName: string | null;
  refundedAt: string | null;
  refundedByName: string | null;
  offsetBilledAt: string | null;
  offsetAmountCents: number | null;
  notes: string | null;
  needsReview: boolean;
  /** Whole days since the request. Null when requested_at is missing. */
  daysPending: number | null;
};

export type RefundProcessorGroup = {
  processorLabel: string;
  rows: RefundRow[];
  float: ProcessorFloatState;
};

export type RefundUsageEntry = { name: string; count: number; totalCents: number };

export type RefundsQueueResult = {
  groups: RefundProcessorGroup[];
  refundedToday: RefundRow[];
  pendingCount: number;
  pendingCents: number;
  usage: {
    requestedBy: RefundUsageEntry[];
    refundedBy: RefundUsageEntry[];
    byProcessor: RefundUsageEntry[];
    windowDays: number;
  };
  error: string | null;
};

/**
 * Start of the current UTC day. The processor sweep happens at end of day, so
 * float math is per-day; UTC is close enough for an advisory panel and avoids a
 * server/client timezone mismatch.
 */
function startOfTodayIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function bump(
  map: Map<string, RefundUsageEntry>,
  name: string | null | undefined,
  cents: number
) {
  const key = (name ?? "").trim() || "Unknown";
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    existing.totalCents += cents;
  } else {
    map.set(key, { name: key, count: 1, totalCents: cents });
  }
}

function sortUsage(map: Map<string, RefundUsageEntry>): RefundUsageEntry[] {
  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
}

export async function fetchRefundsQueue(
  supabase: SupabaseClient
): Promise<RefundsQueueResult> {
  const todayStart = startOfTodayIso();
  const usageSince = new Date(
    Date.now() - USAGE_WINDOW_DAYS * 86_400_000
  ).toISOString();

  const empty: RefundsQueueResult = {
    groups: [],
    refundedToday: [],
    pendingCount: 0,
    pendingCents: 0,
    usage: {
      requestedBy: [],
      refundedBy: [],
      byProcessor: [],
      windowDays: USAGE_WINDOW_DAYS,
    },
    error: null,
  };

  const [pendingRes, todayRes, offsetRes, usageRes] = await Promise.all([
    supabase
      .from("refunds")
      .select(REFUND_SELECT)
      .eq("status", "requested")
      .order("requested_at", { ascending: true })
      .limit(MAX_ROWS),
    supabase
      .from("refunds")
      .select(REFUND_SELECT)
      .eq("status", "refunded")
      .gte("refunded_at", todayStart)
      .order("refunded_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from("refunds")
      .select("processor_mid, offset_amount_cents")
      .gte("offset_billed_at", todayStart)
      .limit(MAX_ROWS),
    supabase
      .from("refunds")
      .select(
        "amount_cents, processor_mid, status, requested_by_name, refunded_by_name"
      )
      .gte("requested_at", usageSince)
      .limit(MAX_ROWS),
  ]);

  const firstError =
    pendingRes.error ?? todayRes.error ?? offsetRes.error ?? usageRes.error;
  if (firstError) {
    console.error("[fetchRefundsQueue]", firstError.message);
    return { ...empty, error: firstError.message };
  }

  const pendingRaw = (pendingRes.data ?? []) as RawRefund[];
  const todayRaw = (todayRes.data ?? []) as RawRefund[];

  const clientIds = Array.from(
    new Set([...pendingRaw, ...todayRaw].map((r) => r.client_id))
  );

  const nameById = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .in("id", clientIds);
    for (const c of clientRows ?? []) {
      const name = `${(c.first_name as string | null) ?? ""} ${
        (c.last_name as string | null) ?? ""
      }`.trim();
      nameById.set(c.id as string, name || "—");
    }
  }

  const toRow = (r: RawRefund): RefundRow => ({
    id: r.id,
    clientId: r.client_id,
    clientName: nameById.get(r.client_id) ?? "—",
    amountCents: r.amount_cents ?? 0,
    processorMid: r.processor_mid,
    processorLabel: processorLabel(r.processor_mid),
    status: r.status as RefundStatus,
    requestedAt: r.requested_at,
    requestedByName: r.requested_by_name,
    refundedAt: r.refunded_at,
    refundedByName: r.refunded_by_name,
    offsetBilledAt: r.offset_billed_at,
    offsetAmountCents: r.offset_amount_cents,
    notes: r.notes,
    needsReview: !!r.needs_review,
    daysPending: daysSince(r.requested_at),
  });

  const pending = pendingRaw.map(toRow);
  const refundedToday = todayRaw.map(toRow);

  const processedTodayByProcessor = new Map<string, number>();
  for (const row of refundedToday) {
    processedTodayByProcessor.set(
      row.processorLabel,
      (processedTodayByProcessor.get(row.processorLabel) ?? 0) + row.amountCents
    );
  }

  const offsetTodayByProcessor = new Map<string, number>();
  for (const row of offsetRes.data ?? []) {
    const key = processorLabel(row.processor_mid as string | null);
    const cents = (row.offset_amount_cents as number | null) ?? 0;
    offsetTodayByProcessor.set(
      key,
      (offsetTodayByProcessor.get(key) ?? 0) + Math.max(0, cents)
    );
  }

  const byProcessor = new Map<string, RefundRow[]>();
  for (const row of pending) {
    const bucket = byProcessor.get(row.processorLabel) ?? [];
    bucket.push(row);
    byProcessor.set(row.processorLabel, bucket);
  }

  const groups: RefundProcessorGroup[] = Array.from(byProcessor.entries())
    .map(([label, rows]) => {
      const queuedCents = rows.reduce((sum, r) => sum + r.amountCents, 0);
      return {
        processorLabel: label,
        rows,
        float: computeProcessorFloat({
          queuedCents,
          processedTodayCents: processedTodayByProcessor.get(label) ?? 0,
          offsetTodayCents: offsetTodayByProcessor.get(label) ?? 0,
        }),
      };
    })
    // Worst exposure first, so anything at risk of a fee is at the top.
    .sort(
      (a, b) =>
        b.float.shortfallCents - a.float.shortfallCents ||
        b.float.exposureCents - a.float.exposureCents ||
        a.processorLabel.localeCompare(b.processorLabel)
    );

  const requestedByMap = new Map<string, RefundUsageEntry>();
  const refundedByMap = new Map<string, RefundUsageEntry>();
  const processorMap = new Map<string, RefundUsageEntry>();
  for (const row of usageRes.data ?? []) {
    const cents = (row.amount_cents as number | null) ?? 0;
    bump(requestedByMap, row.requested_by_name as string | null, cents);
    bump(processorMap, processorLabel(row.processor_mid as string | null), cents);
    if ((row.status as string) === "refunded") {
      bump(refundedByMap, row.refunded_by_name as string | null, cents);
    }
  }

  return {
    groups,
    refundedToday,
    pendingCount: pending.length,
    pendingCents: pending.reduce((sum, r) => sum + r.amountCents, 0),
    usage: {
      requestedBy: sortUsage(requestedByMap),
      refundedBy: sortUsage(refundedByMap),
      byProcessor: sortUsage(processorMap),
      windowDays: USAGE_WINDOW_DAYS,
    },
    error: null,
  };
}

/** Cheap count for the Refunds tab badge. */
export async function fetchPendingRefundCount(
  supabase: SupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from("refunds")
    .select("id", { count: "exact", head: true })
    .eq("status", "requested");
  if (error) {
    console.error("[fetchPendingRefundCount]", error.message);
    return 0;
  }
  return count ?? 0;
}

import { getTodayBatchId } from "@/lib/postlogic/batch-helpers";

type SettingsReader = {
  from: (table: string) => any;
};

export const PRINT_BATCH_RUNS_TABLE = "fedex_print_batch_runs";

export type PrintBatchRunStatus = "sent" | "skipped" | "empty";

export type PrintBatchRun = {
  batch_id: string;
  status: PrintBatchRunStatus;
  queued_count: number;
  sent_count: number;
  reason: string | null;
  recorded_at: string;
};

/**
 * A successful send for that Pacific date must not be overwritten by a later
 * skip (e.g. toggle flipped off after a manual send the same day).
 */
export function shouldPreserveExistingPrintBatchRun(
  existing: PrintBatchRunStatus,
  incoming: PrintBatchRunStatus
): boolean {
  return existing === "sent" && incoming !== "sent";
}

export async function recordPrintBatchRun(
  supabase: SettingsReader,
  input: {
    batchId?: string;
    status: PrintBatchRunStatus;
    queuedCount?: number;
    sentCount?: number;
    reason?: string | null;
  }
): Promise<PrintBatchRun | null> {
  const batchId = input.batchId ?? getTodayBatchId();
  const incoming = input.status;

  const { data: existing, error: readErr } = await supabase
    .from(PRINT_BATCH_RUNS_TABLE)
    .select("batch_id, status, queued_count, sent_count, reason, recorded_at")
    .eq("batch_id", batchId)
    .maybeSingle();

  if (readErr) {
    console.error("[print-batch-runs] read:", readErr.message);
    return null;
  }

  if (
    existing &&
    shouldPreserveExistingPrintBatchRun(
      existing.status as PrintBatchRunStatus,
      incoming
    )
  ) {
    return existing as PrintBatchRun;
  }

  const row = {
    batch_id: batchId,
    status: incoming,
    queued_count: input.queuedCount ?? existing?.queued_count ?? 0,
    sent_count:
      incoming === "sent"
        ? (input.sentCount ?? existing?.sent_count ?? 0)
        : (input.sentCount ?? 0),
    reason: input.reason ?? null,
    recorded_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(PRINT_BATCH_RUNS_TABLE)
    .upsert(row, { onConflict: "batch_id" })
    .select("batch_id, status, queued_count, sent_count, reason, recorded_at")
    .single();

  if (error) {
    console.error("[print-batch-runs] upsert:", error.message);
    return null;
  }
  return data as PrintBatchRun;
}

export async function fetchPrintBatchRuns(
  supabase: SettingsReader,
  limit = 12
): Promise<PrintBatchRun[]> {
  const { data, error } = await supabase
    .from(PRINT_BATCH_RUNS_TABLE)
    .select("batch_id, status, queued_count, sent_count, reason, recorded_at")
    .order("batch_id", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[print-batch-runs] list:", error.message);
    return [];
  }
  return (data ?? []) as PrintBatchRun[];
}

export function formatPrintBatchRunDate(batchId: string): string {
  const d = new Date(`${batchId}T12:00:00`);
  if (Number.isNaN(d.getTime())) return batchId;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

import { STAGE_ORDER, type StageKey } from "./constants";

type AuditRow = {
  client_id: string | null;
  created_at: string;
  old_value: unknown;
  new_value: unknown;
  action: string | null;
};

function stageFromJson(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const s = (v as { stage?: string }).stage;
  return typeof s === "string" ? s : null;
}

const MS_PER_DAY = 86_400_000;

export type StageVelocityRow = {
  stage: StageKey;
  label: string;
  avgDays: number | null;
  fastestDays: number | null;
  slowestDays: number | null;
  sampleCount: number;
};

/**
 * Estimates time spent in each stage using stage transitions in audit_log.
 * Only rows with action stage_advanced / stage_reverted and JSON old_value.stage are used.
 */
export function computeVelocityFromAudits(
  audits: AuditRow[],
  clientCreatedAt: Map<string, string>
): Map<string, number[]> {
  const buckets = new Map<string, number[]>();
  for (const s of STAGE_ORDER) {
    buckets.set(s, []);
  }

  const relevant = audits.filter(
    (a) =>
      a.client_id &&
      (a.action === "stage_advanced" || a.action === "stage_reverted")
  );

  const byClient = new Map<string, AuditRow[]>();
  for (const a of relevant) {
    const list = byClient.get(a.client_id!) ?? [];
    list.push(a);
    byClient.set(a.client_id!, list);
  }

  for (const [, rows] of Array.from(byClient.entries())) {
    rows.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let prevTime = Date.now();
    const created = clientCreatedAt.get(rows[0]!.client_id!);
    if (created) {
      prevTime = new Date(created).getTime();
    } else {
      prevTime = new Date(rows[0]!.created_at).getTime();
    }

    for (const row of rows) {
      const leftStage = stageFromJson(row.old_value);
      const t = new Date(row.created_at).getTime();
      if (leftStage && buckets.has(leftStage)) {
        const days = Math.max(0, (t - prevTime) / MS_PER_DAY);
        buckets.get(leftStage)!.push(days);
      }
      prevTime = t;
    }
  }

  return buckets;
}

function stats(nums: number[]): {
  avg: number | null;
  min: number | null;
  max: number | null;
} {
  if (!nums.length) return { avg: null, min: null, max: null };
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    avg: sum / nums.length,
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

/** Fallback: current tenure in stage using stage_entered_at (only clients in that stage). */
export function computeCurrentTenureByStage(
  clients: { stage: string; stage_entered_at: string | null }[]
): Map<string, number[]> {
  const buckets = new Map<string, number[]>();
  for (const s of STAGE_ORDER) {
    buckets.set(s, []);
  }
  const now = Date.now();
  for (const c of clients) {
    if (!c.stage_entered_at || !buckets.has(c.stage)) continue;
    const days = Math.max(
      0,
      (now - new Date(c.stage_entered_at).getTime()) / MS_PER_DAY
    );
    buckets.get(c.stage)!.push(days);
  }
  return buckets;
}

export function buildVelocityRows(
  fromAudits: Map<string, number[]>,
  fallback: Map<string, number[]>,
  labelFn: (k: string) => string
): StageVelocityRow[] {
  const rows: StageVelocityRow[] = [];
  for (const stage of STAGE_ORDER) {
    const auditDays = fromAudits.get(stage) ?? [];
    const fb = fallback.get(stage) ?? [];
    const nums = auditDays.length > 0 ? auditDays : fb;
    const { avg, min, max } = stats(nums);

    rows.push({
      stage,
      label: labelFn(stage),
      avgDays: avg !== null ? Math.round(avg * 10) / 10 : null,
      fastestDays: min !== null ? Math.round(min * 10) / 10 : null,
      slowestDays: max !== null ? Math.round(max * 10) / 10 : null,
      sampleCount: nums.length,
    });
  }
  return rows;
}

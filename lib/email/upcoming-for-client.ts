import type { SupabaseClient } from "@supabase/supabase-js";

export type UpcomingEmailRow = {
  enrollmentId: string;
  sequenceKey: string;
  sequenceLabel: string;
  stepOrder: number;
  subject: string;
  dayOffset: number;
  scheduledFor: string;
  isSkipped: boolean;
};

const SEQUENCE_LABELS: Record<string, string> = {
  welcome_lead: "Lead",
  welcome_cs: "Client Services",
  active_arc: "Active Arc",
  partial_arc: "Partial Arc",
  case_referred: "Case Referred",
  follow_up_24hr: "Follow Up",
  holiday: "Holiday",
};

function sequenceLabel(key: string): string {
  return SEQUENCE_LABELS[key] ?? key;
}

type EnrollmentRow = {
  id: string;
  sequence_key: string | null;
  enrolled_at: string | null;
  last_step_sent: number | null;
  skipped_step_orders: number[] | null;
};

type TemplateRow = {
  sequence_key: string | null;
  step_order: number | null;
  day_offset: number | null;
  subject: string | null;
  name: string | null;
};

export async function listUpcomingEmailsForClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<UpcomingEmailRow[]> {
  const { data: enrollmentsRaw, error: enrollErr } = await supabase
    .from("sequence_enrollments")
    .select("id, sequence_key, enrolled_at, last_step_sent, skipped_step_orders")
    .eq("client_id", clientId)
    .eq("status", "active");

  if (enrollErr) {
    console.error("[upcoming-emails] enrollments error:", enrollErr.message);
    return [];
  }

  const enrollments = (enrollmentsRaw ?? []) as EnrollmentRow[];
  if (!enrollments.length) return [];

  const keys = Array.from(
    new Set(
      enrollments
        .map((e) => (e.sequence_key ?? "").trim())
        .filter((k): k is string => k.length > 0)
    )
  );
  if (!keys.length) return [];

  const { data: templatesRaw, error: tmplErr } = await supabase
    .from("comm_templates")
    .select("sequence_key, step_order, day_offset, subject, name")
    .in("sequence_key", keys)
    .eq("is_active", true)
    .order("step_order", { ascending: true });

  if (tmplErr) {
    console.error("[upcoming-emails] templates error:", tmplErr.message);
    return [];
  }

  const templates = (templatesRaw ?? []) as TemplateRow[];
  const templatesByKey = new Map<string, TemplateRow[]>();
  for (const t of templates) {
    const k = String(t.sequence_key ?? "");
    const list = templatesByKey.get(k) ?? [];
    list.push(t);
    templatesByKey.set(k, list);
  }

  const rows: UpcomingEmailRow[] = [];
  for (const e of enrollments) {
    const key = String(e.sequence_key ?? "").trim();
    if (!key) continue;
    const enrolledAt = e.enrolled_at ? new Date(e.enrolled_at) : new Date();
    const lastSent = Number(e.last_step_sent ?? 0);
    const skipSet = new Set<number>(
      Array.isArray(e.skipped_step_orders) ? e.skipped_step_orders : []
    );
    const steps = templatesByKey.get(key) ?? [];
    for (const t of steps) {
      const step = Number(t.step_order ?? 0);
      if (step <= lastSent) continue;
      const offset = Number(t.day_offset ?? 0);
      const scheduled = new Date(enrolledAt);
      scheduled.setDate(scheduled.getDate() + offset);
      rows.push({
        enrollmentId: String(e.id),
        sequenceKey: key,
        sequenceLabel: sequenceLabel(key),
        stepOrder: step,
        subject: (t.subject ?? t.name ?? "").trim() || `Step ${step}`,
        dayOffset: offset,
        scheduledFor: scheduled.toISOString(),
        isSkipped: skipSet.has(step),
      });
    }
  }

  rows.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  return rows;
}

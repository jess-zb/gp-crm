import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyVercelCronRequest } from "@/lib/cron/verify-vercel-cron-request";

export const dynamic = "force-dynamic";

type ClientNames = {
  first_name: string | null;
  last_name: string | null;
};

type ReminderWithClient = {
  id: string;
  client_id: string | null;
  assigned_to: string | null;
  description: string | null;
  due_date: string | null;
  cancelled: boolean | null;
  clients: ClientNames | ClientNames[] | null;
};

function joinedClient(
  c: ReminderWithClient["clients"]
): ClientNames | null {
  if (!c) return null;
  return Array.isArray(c) ? c[0] ?? null : c;
}

/**
 * Cron (pg_cron / Vercel) invokes GET with `vercel-cron/1.0` or `x-cron-secret`.
 * Creates in-app notifications for reminders due in the next 60 minutes.
 */
/** pg_cron / HTTP callers may use POST; delegate to same logic as GET. */
export async function POST(request: Request) {
  return GET(request);
}

export async function GET(request: Request) {
  try {
    if (!verifyVercelCronRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createServiceClient();

    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: reminders, error: remErr } = await adminClient
      .from("reminders")
      .select(
        `
        id,
        client_id,
        assigned_to,
        description,
        due_date,
        cancelled,
        clients (
          first_name,
          last_name
        )
      `
      )
      .eq("completed", false)
      .eq("cancelled", false)
      .not("due_date", "is", null)
      .gte("due_date", now.toISOString())
      .lte("due_date", in60.toISOString());

    if (remErr) {
      console.error("[appointments-cron] reminders fetch error:", remErr.message);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }

    const rows = reminders ?? [];

    for (const reminder of rows as ReminderWithClient[]) {
      if (!reminder.assigned_to) continue;

      const { data: existing, error: existErr } = await adminClient
        .from("notifications")
        .select("id")
        .eq("user_id", reminder.assigned_to)
        .eq("type", "appointment")
        .ilike("body", `%${reminder.id}%`)
        .limit(1);

      if (existErr) {
        console.warn("[appointments-cron] existing check error:", existErr.message);
        continue;
      }

      if (existing?.length) continue;

      const c = joinedClient(reminder.clients);
      const clientName = c
        ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown client"
        : "Unknown client";

      const desc = reminder.description?.trim() || "Reminder";

      const { error: insErr } = await adminClient.from("notifications").insert({
        user_id: reminder.assigned_to,
        type: "appointment",
        title: "Appointment due soon",
        body: `${desc} — ${clientName} (ID: ${reminder.id})`,
        client_id: reminder.client_id,
        client_name: clientName,
        read: false,
        action_url: reminder.client_id
          ? `/clients/${reminder.client_id}`
          : "/reminders",
      });

      if (insErr) {
        console.warn("[appointments-cron] insert error:", insErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      checked: rows.length,
    });
  } catch (err) {
    console.error("[appointments-cron] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

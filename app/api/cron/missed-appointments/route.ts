import { NextResponse } from "next/server";
import { verifyVercelCronRequest } from "@/lib/cron/verify-vercel-cron-request";
import { createServiceClient } from "@/lib/supabase/server";
import { enrollClientInEmailSequence } from "@/lib/email/sequence-enrollment";

const TERMINAL_STAGES = new Set(["dnc", "closed", "not_interested"]);

export async function GET(request: Request) {
  if (!verifyVercelCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: missedAppts, error: apptErr } = await supabase
    .from("reminders")
    .select("id, client_id, due_date")
    .eq("completed", false)
    .eq("cancelled", false)
    .lt("due_date", twentyFourHoursAgo)
    .not("client_id", "is", null)
    .limit(300);

  if (apptErr) {
    return NextResponse.json({ error: apptErr.message }, { status: 500 });
  }

  const clientIds = Array.from(
    new Set(
      (missedAppts ?? [])
        .map((r) => (r as { client_id: string | null }).client_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  if (!clientIds.length) {
    return NextResponse.json({ enrolled: 0 });
  }

  const { data: clients, error: clientErr } = await supabase
    .from("clients")
    .select("id, email, stage")
    .in("id", clientIds);

  if (clientErr) {
    return NextResponse.json({ error: clientErr.message }, { status: 500 });
  }

  const clientById = new Map(
    (clients ?? []).map((c) => [String((c as { id: string }).id), c as { id: string; email: string | null; stage: string | null }])
  );

  let enrolled = 0;
  const attemptedClients = new Set<string>();

  for (const appt of missedAppts ?? []) {
    const clientId = String((appt as { client_id: string }).client_id);
    if (attemptedClients.has(clientId)) continue;
    attemptedClients.add(clientId);

    const client = clientById.get(clientId);
    if (!client?.email?.trim()) continue;
    if (TERMINAL_STAGES.has(String(client.stage ?? "").trim())) continue;

    // blockIfEverStarted prevents re-sending if the sequence was already active or completed —
    // a missed appointment should only trigger one follow-up email, not one per cron run.
    const res = await enrollClientInEmailSequence(supabase, {
      clientId,
      sequenceKey: "follow_up_24hr",
      clientEmail: client.email,
      blockIfEverStarted: true,
    });
    if (res.ok) enrolled++;
  }

  return NextResponse.json({ enrolled });
}

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyVercelCronRequest } from "@/lib/cron/verify-vercel-cron-request";
import { FROM_EMAIL, SUPPORT_EMAIL, publicAppUrl } from "@/lib/constants/business-contact";
import { createServiceClient } from "@/lib/supabase/server";
import { renderTemplate } from "@/lib/email/render-template";
import { getRoleDisplayName } from "@/lib/utils/roles";
import { isHiddenProfile } from "@/lib/constants/hidden-accounts";

const HOLIDAY_TEMPLATE_KEY = "holiday" as const;

/** Federal / observed US holidays (Pacific calendar day). Extend per year as needed. */
const US_HOLIDAYS_PACIFIC = new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-05-25",
  "2026-06-19",
  "2026-07-04",
  "2026-09-07",
  "2026-10-12",
  "2026-11-11",
  "2026-11-26",
  "2026-12-25",
]);

function getBaseUrl(): string {
  return publicAppUrl();
}

function todayPacificYmd(): string {
  const tz = process.env.HOLIDAY_TIMEZONE?.trim() || "America/Phoenix";
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

function startOfTodayInTimezoneIso(tz: string): string {
  const nowTz = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  const start = new Date(nowTz);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export async function GET(request: Request) {
  if (!verifyVercelCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tz = process.env.HOLIDAY_TIMEZONE?.trim() || "America/Phoenix";
  const today = todayPacificYmd();

  if (!US_HOLIDAYS_PACIFIC.has(today)) {
    return NextResponse.json({ skipped: true, reason: "Not a holiday", today });
  }

  const supabase = createServiceClient();

  // Honor the master email kill switch, same as the drip dispatcher. If email
  // is switched off during an incident, holiday greetings must not go out.
  const { data: killSwitch } = await supabase
    .from("crm_settings")
    .select("value")
    .eq("key", "email_sequences_enabled")
    .maybeSingle();

  if (killSwitch?.value !== "true") {
    return NextResponse.json({ skipped: true, reason: "email_sequences_disabled", today });
  }

  const startOfTodayIso = startOfTodayInTimezoneIso(tz);

  const { data: holidayRows, error: holErr } = await supabase
    .from("email_logs")
    .select("client_id")
    .eq("template_key", HOLIDAY_TEMPLATE_KEY)
    .gte("sent_at", startOfTodayIso)
    .not("client_id", "is", null);

  if (holErr) {
    return NextResponse.json({ error: holErr.message }, { status: 500 });
  }

  const alreadyGotHoliday = new Set(
    (holidayRows ?? [])
      .map((r) => r.client_id as string | null)
      .filter((id): id is string => Boolean(id))
  );

  const { data: activeClients, error: clientErr } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, unsubscribed_at, assigned_to, stage")
    .eq("is_active", true)
    .is("unsubscribed_at", null)
    .not("email", "is", null)
    .not("stage", "in", '("dnc","not_interested")')
    .limit(500);

  if (clientErr) {
    return NextResponse.json({ error: clientErr.message }, { status: 500 });
  }

  const toSend = (activeClients ?? []).filter((c) => !alreadyGotHoliday.has(String(c.id))).slice(0, 150);

  if (toSend.length === 0) {
    return NextResponse.json({ sent: 0, holiday: today });
  }

  const baseUrl = getBaseUrl();
  const resend = new Resend(process.env.RESEND_API_KEY);

  let sent = 0;
  let errors = 0;

  for (const client of toSend) {
    try {
      const clientId = String(client.id);
      const { data: mgr } = client.assigned_to
        ? await supabase
            .from("profiles")
            .select("full_name, title, email, role")
            .eq("id", client.assigned_to)
            .maybeSingle()
        : { data: null };

      const hiddenManager = isHiddenProfile(
        { email: mgr?.email as string | null, role: mgr?.role as string | null },
        "client"
      );
      const mgrName = hiddenManager ? "" : String(mgr?.full_name ?? "").trim();
      const [mgrFirst, ...mgrRest] = mgrName ? mgrName.split(/\s+/) : ["Account", "Manager"];
      const mgrLast = mgrRest.join(" ").trim() || "—";
      const mgrEmail = hiddenManager
        ? SUPPORT_EMAIL
        : String(mgr?.email ?? "").trim() || SUPPORT_EMAIL;

      const unsubscribeUrl = `${baseUrl}/unsubscribe/${encodeURIComponent(clientId)}`;
      const portalUrl = `${baseUrl}/portal`;

      const { subject, html } = await renderTemplate({
        template_key: HOLIDAY_TEMPLATE_KEY,
        variables: {
          client: {
            firstName: String(client.first_name ?? "").trim() || "Client",
            lastName: String(client.last_name ?? "").trim() || "",
          },
          accountManager: {
            firstName: mgrFirst || "Account",
            lastName: mgrLast,
            title: hiddenManager ? getRoleDisplayName("acct_manager") : String(mgr?.title ?? "").trim() || getRoleDisplayName("acct_manager"),
            email: mgrEmail,
          },
          portalUrl,
          unsubscribeUrl,
        },
      });

      const out = await resend.emails.send({
        from: FROM_EMAIL,
        to: String(client.email),
        subject,
        html,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
      });

      if ((out as { error?: { message?: string } })?.error) {
        const msg = (out as { error?: { message?: string } }).error?.message || "Resend send failed";
        await supabase.from("email_logs").insert({
          client_id: clientId,
          template_key: HOLIDAY_TEMPLATE_KEY,
          status: "failed",
          error: msg,
        });
        errors++;
        continue;
      }

      const messageId = String((out as { data?: { id?: string } }).data?.id ?? "");

      await supabase.from("email_logs").insert({
        client_id: clientId,
        template_key: HOLIDAY_TEMPLATE_KEY,
        resend_message_id: messageId || null,
        status: "sent",
      });

      sent++;
    } catch {
      errors++;
      try {
        await supabase.from("email_logs").insert({
          client_id: String(client.id),
          template_key: HOLIDAY_TEMPLATE_KEY,
          status: "failed",
          error: "holiday_autoresponder_send_exception",
        });
      } catch {
        /* ignore */
      }
    }
  }

  return NextResponse.json({ sent, errors, holiday: today });
}

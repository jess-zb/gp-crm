import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { createServiceClient } from "@/lib/supabase/server";

type ResendEvent = {
  type: string;
  created_at: string;
  data?: {
    email_id?: string;
    bounce?: { reason?: string | null; type?: string | null; classification?: string | null };
    failed?: { reason?: string | null };
  };
};

function pickSvixHeaders(h: Headers) {
  return {
    "svix-id": h.get("svix-id") ?? "",
    "svix-timestamp": h.get("svix-timestamp") ?? "",
    "svix-signature": h.get("svix-signature") ?? "",
  };
}

function isHardBounce(e: ResendEvent): boolean {
  const t = String(e.data?.bounce?.type ?? "").toLowerCase();
  const c = String(e.data?.bounce?.classification ?? "").toLowerCase();
  if (t) return t.includes("hard");
  if (c) return c.includes("hard");
  return false;
}

export async function POST(request: Request) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const payload = await request.text();
    const headers = pickSvixHeaders(request.headers);

    let event: ResendEvent;
    try {
      const wh = new Webhook(secret);
      event = wh.verify(payload, headers) as ResendEvent;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messageId = String(event.data?.email_id ?? "").trim();
    if (!messageId) {
      return NextResponse.json({ ok: true });
    }

    const createdAt = event.created_at ? new Date(event.created_at).toISOString() : new Date().toISOString();

    const supabase = createServiceClient();

    // Update email_logs by resend_message_id
    if (event.type === "email.delivered") {
      await supabase
        .from("email_logs")
        .update({ status: "delivered", delivered_at: createdAt })
        .eq("resend_message_id", messageId);
    } else if (event.type === "email.opened") {
      await supabase
        .from("email_logs")
        .update({ status: "opened", opened_at: createdAt })
        .eq("resend_message_id", messageId)
        .is("opened_at", null);
    } else if (event.type === "email.clicked") {
      await supabase
        .from("email_logs")
        .update({ status: "clicked", clicked_at: createdAt })
        .eq("resend_message_id", messageId);
    } else if (event.type === "email.bounced") {
      const reason = event.data?.bounce?.reason ?? null;
      await supabase
        .from("email_logs")
        .update({ status: "bounced", bounced_at: createdAt, error: reason })
        .eq("resend_message_id", messageId);
    } else if (event.type === "email.complained") {
      await supabase
        .from("email_logs")
        .update({ status: "complained", error: "spam_complaint" })
        .eq("resend_message_id", messageId);
    } else if (event.type === "email.failed") {
      const reason = event.data?.failed?.reason ?? null;
      await supabase
        .from("email_logs")
        .update({ status: "failed", error: reason })
        .eq("resend_message_id", messageId);
    } else {
      // Ignore other event types (email.sent, etc.)
      return NextResponse.json({ ok: true });
    }

    // AUTO-UNSUBSCRIBE on hard bounce or complaint
    const shouldUnsubscribe = event.type === "email.complained" || (event.type === "email.bounced" && isHardBounce(event));
    if (shouldUnsubscribe) {
      const { data: logRow } = await supabase
        .from("email_logs")
        .select("client_id")
        .eq("resend_message_id", messageId)
        .maybeSingle();

      const clientId = (logRow as { client_id?: string | null } | null)?.client_id ?? null;
      if (clientId) {
        await supabase.from("clients").update({ unsubscribed_at: new Date().toISOString() }).eq("id", clientId);

        await supabase
          .from("sequence_enrollments")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancel_reason: "bounced_or_complained",
          })
          .eq("client_id", clientId)
          .eq("status", "active");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[webhooks/resend] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}


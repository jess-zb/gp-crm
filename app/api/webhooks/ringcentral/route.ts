import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const validationToken = request.headers.get("Validation-Token");
    if (validationToken) {
      return new Response(null, {
        status: 200,
        headers: { "Validation-Token": validationToken },
      });
    }

    const body = (await request.json()) as Record<string, unknown>;

    const event = String(body.event ?? "");
    const body_data =
      body.body && typeof body.body === "object"
        ? (body.body as Record<string, unknown>)
        : {};

    if (
      event.includes("telephony/sessions") ||
      event.includes("call-log")
    ) {
      await handleCallEvent(body_data);
    }

    if (event.includes("message-store") || event.includes("sms")) {
      await handleSmsEvent(body_data);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("RingCentral webhook error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function last10Digits(num: string | undefined | null): string | null {
  const d = num?.replace(/\D/g, "") ?? "";
  if (d.length < 10) return d.length ? d : null;
  return d.slice(-10);
}

async function findClientByPhoneSuffix(suffix: string | null) {
  if (!suffix) return { clientId: null as string | null, assignedTo: null as string | null };

  const pattern = `%${suffix}`;
  const { data: clients } = await adminClient
    .from("clients")
    .select("id, assigned_to")
    .or(
      `phone_mobile.ilike.${pattern},phone_work.ilike.${pattern},phone_home.ilike.${pattern},phone.ilike.${pattern}`
    )
    .limit(1);

  return {
    clientId: (clients?.[0]?.id as string | undefined) ?? null,
    assignedTo: (clients?.[0]?.assigned_to as string | undefined) ?? null,
  };
}

async function insertCommunicationIfNew(params: {
  ringcentralId: string | null;
  payload: Record<string, unknown>;
}) {
  const { ringcentralId, payload } = params;
  if (ringcentralId) {
    const { data: existing } = await adminClient
      .from("communications")
      .select("id")
      .eq("ringcentral_call_id", ringcentralId)
      .maybeSingle();
    if (existing?.id) return { skipped: true as const };
  }

  const { error } = await adminClient.from("communications").insert(payload);
  if (error) throw error;
  return { skipped: false as const };
}

async function handleCallEvent(data: Record<string, unknown>) {
  const legs = Array.isArray(data.legs) ? data.legs : [];
  const leg0 =
    legs[0] && typeof legs[0] === "object"
      ? (legs[0] as Record<string, unknown>)
      : undefined;

  const fromObj =
    data.from && typeof data.from === "object"
      ? (data.from as Record<string, unknown>)
      : undefined;
  const toObj =
    data.to && typeof data.to === "object"
      ? (data.to as Record<string, unknown>)
      : undefined;

  const fromNumber =
    (fromObj?.phoneNumber as string | undefined) ??
    (typeof leg0?.from === "string" ? leg0.from : undefined) ??
    (leg0?.from &&
    typeof leg0.from === "object" &&
    (leg0.from as Record<string, unknown>).phoneNumber
      ? String((leg0.from as Record<string, unknown>).phoneNumber)
      : undefined);

  const toNumber =
    (toObj?.phoneNumber as string | undefined) ??
    (typeof leg0?.to === "string" ? leg0.to : undefined) ??
    (leg0?.to &&
    typeof leg0.to === "object" &&
    (leg0.to as Record<string, unknown>).phoneNumber
      ? String((leg0.to as Record<string, unknown>).phoneNumber)
      : undefined);

  const duration = Number(
    data.duration ?? leg0?.duration ?? 0
  );
  const dirRaw = String(data.direction ?? "");
  const direction =
    dirRaw.toLowerCase() === "inbound" ? "inbound" : "outbound";

  const startTime =
    (data.startTime as string | undefined) ??
    (leg0?.startTime as string | undefined) ??
    new Date().toISOString();

  const phoneToMatch = direction === "inbound" ? fromNumber : toNumber;
  const cleanPhone = last10Digits(phoneToMatch);

  const { clientId, assignedTo } = await findClientByPhoneSuffix(cleanPhone);

  const ringcentralId =
    (data.sessionId as string | undefined) ??
    (data.id as string | undefined) ??
    null;

  const result = await insertCommunicationIfNew({
    ringcentralId,
    payload: {
      client_id: clientId,
      type: "call",
      direction,
      body: "RingCentral call — auto logged",
      from_number: fromNumber ?? null,
      to_number: toNumber ?? null,
      duration_seconds: Number.isFinite(duration) ? duration : 0,
      ringcentral_call_id: ringcentralId,
      recorded_by: assignedTo,
      sent_at: startTime,
    },
  });

  if (result.skipped) return;

  if (clientId) {
    await adminClient.from("audit_log").insert({
      client_id: clientId,
      action: "call_auto_logged",
      new_value: {
        direction,
        duration_seconds: duration,
        from: fromNumber,
        to: toNumber,
      },
      performed_by_name: "RingCentral",
    });
  }
}

async function handleSmsEvent(data: Record<string, unknown>) {
  const fromWrap =
    data.from && typeof data.from === "object"
      ? (data.from as Record<string, unknown>)
      : undefined;
  const fromNumber = fromWrap?.phoneNumber as string | undefined;
  const toArr = Array.isArray(data.to) ? data.to : [];
  const to0 =
    toArr[0] && typeof toArr[0] === "object"
      ? (toArr[0] as Record<string, unknown>)
      : undefined;
  const toNumber = to0?.phoneNumber as string | undefined;

  const messageText = String(
    data.subject ?? data.text ?? ""
  );
  const dirRaw = String(data.direction ?? "");
  const direction =
    dirRaw.toLowerCase() === "inbound" ? "inbound" : "outbound";
  const createdTime =
    (data.creationTime as string | undefined) ?? new Date().toISOString();
  const messageId = data.id as string | undefined;

  const phoneToMatch = direction === "inbound" ? fromNumber : toNumber;
  const cleanPhone = last10Digits(phoneToMatch);

  const { clientId, assignedTo } = await findClientByPhoneSuffix(cleanPhone);

  const result = await insertCommunicationIfNew({
    ringcentralId: messageId ?? null,
    payload: {
      client_id: clientId,
      type: "sms",
      direction,
      body: messageText,
      from_number: fromNumber ?? null,
      to_number: toNumber ?? null,
      ringcentral_call_id: messageId ?? null,
      recorded_by: assignedTo,
      sent_at: createdTime,
    },
  });

  if (result.skipped) return;

  if (clientId) {
    await adminClient.from("audit_log").insert({
      client_id: clientId,
      action: "sms_auto_logged",
      new_value: {
        direction,
        from: fromNumber,
        to: toNumber,
        preview: messageText.substring(0, 100),
      },
      performed_by_name: "RingCentral",
    });
  }
}

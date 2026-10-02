import { omitCarrierStatus, retryWriteWithoutCarrierStatus } from "@/lib/packets/carrier-status-column";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FEDEX_PACKET_REMINDER_KEYS } from "@/lib/reminders/workflow-config";
import { createWorkflowTask } from "@/lib/reminders/workflow";
import { getPostlogicXApiKey, POSTLOGIC_INTAKE_URL } from "./constants";

function pollStatusBaseUrl(): string {
  return process.env.POSTLOGIC_ENDPOINT?.trim() || POSTLOGIC_INTAKE_URL;
}

function extractTrackingAndStatus(payload: unknown): {
  tracking: string | null;
  status: string | null;
} {
  if (payload == null) {
    return { tracking: null, status: null };
  }
  if (typeof payload === "string") {
    try {
      return extractTrackingAndStatus(JSON.parse(payload));
    } catch {
      return { tracking: null, status: null };
    }
  }
  if (typeof payload !== "object") {
    return { tracking: null, status: null };
  }
  const o = payload as Record<string, unknown>;

  /** Common print-partner API shape */
  const ship = o.shipment;
  if (ship && typeof ship === "object") {
    const s = ship as Record<string, unknown>;
    const st = pickString(s.tracking) ?? pickString(s.tracking_number);
    const ss = pickString(s.status);
    if (st || ss) return { tracking: st, status: ss };
  }

  const tracking =
    pickString(o.tracking_number) ??
    pickString(o.trackingNumber) ??
    pickString(o.tracking) ??
    pickString(o.fedex_tracking_number) ??
    pickString(o.trknbr);
  const status =
    pickString(o.status) ??
    pickString(o.postlogic_status) ??
    pickString(o.shipment_status) ??
    pickString(o.shipmentStatus);
  if (tracking || status) {
    return { tracking, status };
  }
  for (const v of Object.values(o)) {
    const inner = extractTrackingAndStatus(v);
    if (inner.tracking || inner.status) {
      return inner;
    }
  }
  return { tracking: null, status: null };
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** "In Transit or further" — excludes early states like Processing / label created. */
export function shouldAdvanceStageForPostlogicStatus(
  status: string | null | undefined
): boolean {
  if (!status?.trim()) {
    return false;
  }
  const s = status.toLowerCase();
  if (
    s.includes("processing") ||
    s.includes("pending") ||
    s.includes("label created") ||
    s.includes("shipment information sent to fedex")
  ) {
    return false;
  }
  return (
    s.includes("in transit") ||
    s.includes("on the way") ||
    s.includes("out for delivery") ||
    s.includes("delivered") ||
    s.includes("at fedex") ||
    s.includes("picked up") ||
    s.includes("ready for recipient") ||
    s.includes("at destination") ||
    s.includes("departed") ||
    s.includes("arrived at")
  );
}

export type PollStatusResultRow = {
  id: string;
  name: string;
  tracking?: string;
  status?: string;
  unique_id?: string;
};

type PollClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  assigned_to: string | null;
  assigned_services_id: string | null;
  postlogic_unique_id: string | null;
  stage: string | null;
  fedex_tracking_number: string | null;
  postlogic_status: string | null;
};

type PollRowOutcome =
  | { outcome: "fatal"; error: string }
  | { outcome: "skip" }
  | { outcome: "updated"; result: PollStatusResultRow };

async function executePostlogicPollForClientRow(
  supabase: SupabaseClient,
  c: PollClientRow,
  opts: { performedBy?: string; performedByName?: string },
  baseUrl: string,
  apiKey: string
): Promise<PollRowOutcome> {
  const uid = c.postlogic_unique_id as string | null;
  if (!uid?.trim()) {
    return { outcome: "skip" };
  }

  const displayName =
    `${(c.first_name as string | null) ?? ""} ${(c.last_name as string | null) ?? ""}`.trim() ||
    "—";

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("unique_id", uid.trim());
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      console.warn(
        `[postlogic/poll-status] HTTP ${res.status} for client ${c.id}:`,
        text.slice(0, 200)
      );
      return { outcome: "skip" };
    }

    console.log(
      `[postlogic/poll-status] response for ${uid.trim()}:`,
      typeof json === "string" ? json : JSON.stringify(json)
    );

    const obj =
      json && typeof json === "object" && !Array.isArray(json)
        ? (json as Record<string, unknown>)
        : null;
    const topStatus = obj && typeof obj.status === "string" ? obj.status : null;

    let { tracking, status } = extractTrackingAndStatus(json);

    /** Prefer explicit success + shipment when API documents that shape */
    if (
      topStatus === "success" &&
      obj?.shipment &&
      typeof obj.shipment === "object"
    ) {
      const sm = obj.shipment as Record<string, unknown>;
      const tr = pickString(sm.tracking) ?? pickString(sm.tracking_number);
      const st = pickString(sm.status);
      if (tr) tracking = tr;
      if (st) status = st;
    }

    if (!tracking && !status) {
      console.log(
        `[postlogic/poll-status] no shipment data for ${uid.trim()}:`,
        typeof json === "string" ? json : JSON.stringify(json)
      );
      return { outcome: "skip" };
    }

    const patch: Record<string, unknown> = {};
    // Always update status even when tracking is missing.
    patch.postlogic_status = status ?? null;
    // Only update tracking when present.
    if (tracking) patch.fedex_tracking_number = tracking;

    const statusLower = (status ?? "").toLowerCase();

    // Track "Out for Delivery" without advancing stage.
    if (statusLower === "out for delivery") {
      patch.pod_tracking = tracking || "";
    }

    const prevStatusLower = String(c.postlogic_status ?? "").toLowerCase();
    const isDelivered = statusLower.includes("delivered");
    const isNewlyDelivered = isDelivered && !prevStatusLower.includes("delivered");

    if (isNewlyDelivered) {
      patch.pod_delivered_at = new Date().toISOString();
      patch.pod_tracking = tracking || (c.postlogic_unique_id as string | null) || null;
    }

    if (Object.keys(patch).length === 0 && !isDelivered) return { outcome: "skip" };

    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await supabase
        .from("clients")
        .update(patch)
        .eq("id", c.id as string);

      if (upErr) {
        return { outcome: "fatal", error: upErr.message };
      }
    }

    // Scan goes on carrier_status. Tab becomes Delivered only when this
    // packet is still on Packets Sent (Processing) and FedEx says delivered.
    if (status) {
      const scanPatch = {
        carrier_status: status,
        ...(tracking ? { tracking_number: tracking } : {}),
      };
      await retryWriteWithoutCarrierStatus(
        () =>
          supabase
            .from("client_fedex_shipments")
            .update(scanPatch)
            .eq("client_id", c.id as string)
            .eq("status", "Processing"),
        () =>
          supabase
            .from("client_fedex_shipments")
            .update(omitCarrierStatus(scanPatch))
            .eq("client_id", c.id as string)
            .eq("status", "Processing")
      );
    }

    if (isDelivered) {
      const cid = c.id as string;
      const deliveredAt = new Date().toISOString();
      const trk = tracking ?? "";
      const deliveredPatch = {
        status: "Delivered",
        carrier_status: "Delivered",
        delivered_at: deliveredAt,
        ...(trk ? { tracking_number: trk } : {}),
      };

      await retryWriteWithoutCarrierStatus(
        () =>
          supabase
            .from("client_fedex_shipments")
            .update(deliveredPatch)
            .eq("client_id", cid)
            .eq("status", "Processing"),
        () =>
          supabase
            .from("client_fedex_shipments")
            .update(omitCarrierStatus(deliveredPatch))
            .eq("client_id", cid)
            .eq("status", "Processing")
      );
    }

    if (isNewlyDelivered) {
      const deliveredAt = new Date().toISOString();
      const trk = tracking ?? "";
      const cid = c.id as string;
      const reminderPatch = {
        completed: true,
        completed_at: deliveredAt,
      };

      const { error: remErrKeys } = await supabase
        .from("reminders")
        .update(reminderPatch)
        .eq("client_id", cid)
        .eq("completed", false)
        .in("appointment_type_key", [...FEDEX_PACKET_REMINDER_KEYS]);

      const { error: remErrLegacy } = await supabase
        .from("reminders")
        .update(reminderPatch)
        .eq("client_id", cid)
        .eq("completed", false)
        .is("appointment_type_key", null)
        .ilike("description", "%packet sent%");

      if (remErrKeys || remErrLegacy) {
        console.warn(
          "[postlogic/poll-status] Packet Sent reminder complete failed:",
          remErrKeys?.message ?? remErrLegacy?.message
        );
      }

      const { error: checklistErr } = await supabase
        .from("onboarding_checklist")
        .update({ completed: true, completed_at: deliveredAt })
        .eq("client_id", cid)
        .eq("completed", false)
        .ilike("item", "%welcome packet%");

      if (checklistErr) {
        console.warn(
          "[postlogic/poll-status] onboarding checklist (welcome packet) update:",
          checklistErr.message
        );
      }

      const servicesAssignee =
        (c.assigned_services_id as string | null) ??
        (c.assigned_to as string | null) ??
        null;

      const { count: poaCount } = await supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("client_id", cid)
        .eq("appointment_type", "poa_follow_up_call")
        .eq("completed", false)
        .eq("cancelled", false);

      if ((poaCount ?? 0) === 0) {
        const dueIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { error: poaErr } = await createWorkflowTask(supabase, {
          client_id: cid,
          description:
            "POA Follow Up — packet delivered, confirm POA with client",
          due_date: dueIso,
          assigned_to: servicesAssignee,
          created_by: null,
          client_stage: String(c.stage ?? "client_services"),
          appointment_type: "poa_follow_up_call",
          pipeline_type: "service",
          auto_generated: true,
          workflow_source: "postlogic",
        });
        if (poaErr) {
          console.warn("[postlogic/poll-status] poa_follow_up_call create:", poaErr.message);
        }
      }

      try {
        await supabase.from("audit_log").insert({
          client_id: cid,
          action: "fedex_delivered",
          new_value: {
            tracking_number: trk,
            poa_follow_up_due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          performed_by_name: "System",
        });
      } catch (e) {
        console.warn("[postlogic/poll-status] fedex_delivered audit insert threw:", e);
      }

      const notifyUserId =
        (c.assigned_services_id as string | null) ??
        (c.assigned_to as string | null) ??
        undefined;
      if (notifyUserId) {
        const fn = (c.first_name as string | null) ?? "";
        const ln = (c.last_name as string | null) ?? "";
        const clientName = `${fn} ${ln}`.trim() || "Client";
        try {
          const { error: notifErr } = await supabase.from("notifications").insert({
            user_id: notifyUserId,
            type: "fedex_update",
            title: "Welcome packet delivered!",
            body: `${clientName}'s packet delivered. Tracking: ${trk}`,
            client_id: cid,
            client_name: clientName,
            read: false,
            action_url: `/clients/${cid}`,
          });
          if (notifErr) {
            console.warn(
              "[postlogic/poll-status] delivered notification insert:",
              notifErr.message
            );
          }
        } catch (e) {
          console.warn("[postlogic/poll-status] delivered notification threw:", e);
        }
      }
    }

    const result: PollStatusResultRow = {
      id: c.id as string,
      name: displayName,
      status: status ?? undefined,
      tracking: tracking ?? undefined,
      unique_id: uid.trim(),
    };

    // Log FedEx poll snapshot unless we already recorded fedex_delivered for this update.
    try {
      if (!isNewlyDelivered) {
        const performedByName =
          opts.performedByName?.trim() || opts.performedBy || "System";
        const payload: Record<string, unknown> = {
          postlogic_status: status ?? null,
          tracking: tracking ?? null,
          unique_id: uid.trim(),
        };
        if (opts.performedBy) {
          const { error: auditErr } = await supabase.from("audit_log").insert({
            client_id: c.id as string,
            action: "fedex_tracking_updated",
            new_value: payload,
            performed_by: opts.performedBy,
            performed_by_name: performedByName,
          });
          if (auditErr) {
            console.warn("[postlogic/poll-status] audit insert failed:", auditErr.message);
          }
        } else {
          const { error: auditErr } = await supabase.from("audit_log").insert({
            client_id: c.id as string,
            action: "fedex_tracking_updated",
            new_value: payload,
            performed_by_name: "System",
          });
          if (auditErr) {
            console.warn("[postlogic/poll-status] audit insert failed:", auditErr.message);
          }
        }
      }
    } catch (e) {
      console.warn("[postlogic/poll-status] audit insert threw:", e);
    }

    return { outcome: "updated", result };
  } catch (err) {
    console.error(`[postlogic/poll-status] Poll error for ${c.id}:`, err);
    return { outcome: "skip" };
  }
}

export async function runPostlogicPollStatus(
  supabase: SupabaseClient,
  opts: {
    clientId?: string;
    performedBy?: string;
    performedByName?: string;
  }
): Promise<
  | {
      ok: true;
      polled: number;
      updated: number;
      results: PollStatusResultRow[];
    }
  | { ok: false; error: string }
> {
  // Also identify records that were batch-sent but still missing Print ID.
  // We don't poll these (no unique_id), but we log them so admins can fill IDs.
  try {
    let missingIdQ = supabase
      .from("clients")
      .select("id, first_name, last_name, fedex_batch_sent_at, postlogic_unique_id")
      .eq("is_active", true)
      .not("fedex_batch_sent_at", "is", null)
      .is("postlogic_unique_id", null)
      .limit(200);
    if (opts.clientId) {
      missingIdQ = missingIdQ.eq("id", opts.clientId);
    }
    const { data: missing } = await missingIdQ;
    if (missing?.length) {
      console.warn(
        "[postlogic/poll-status] clients missing Print ID (postlogic_unique_id):",
        missing.map((m) => ({
          id: m.id,
          name: `${(m.first_name ?? "")} ${(m.last_name ?? "")}`.trim(),
          fedex_batch_sent_at: m.fedex_batch_sent_at,
        }))
      );
    }
  } catch (e) {
    console.warn("[postlogic/poll-status] missing-id scan failed:", e);
  }

  let q = supabase
    .from("clients")
    .select(
      "id, first_name, last_name, assigned_to, assigned_services_id, postlogic_unique_id, stage, fedex_tracking_number, postlogic_status"
    )
    .eq("is_active", true)
    .not("postlogic_unique_id", "is", null)
    .is("fedex_tracking_number", null);

  if (opts.clientId) {
    q = q.eq("id", opts.clientId);
  }

  const { data: clients, error } = await q;
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!clients?.length) {
    return { ok: true, polled: 0, updated: 0, results: [] };
  }

  const results: PollStatusResultRow[] = [];
  let updated = 0;
  const baseUrl = pollStatusBaseUrl();
  const apiKey = getPostlogicXApiKey();

  for (const c of clients) {
    const out = await executePostlogicPollForClientRow(
      supabase,
      c as PollClientRow,
      opts,
      baseUrl,
      apiKey
    );
    if (out.outcome === "fatal") {
      return { ok: false, error: out.error };
    }
    if (out.outcome === "updated") {
      results.push(out.result);
      updated += 1;
    }
  }

  return { ok: true, polled: clients.length, updated, results };
}

/**
 * Poll PostLogic for clients that already have FedEx tracking (Archive tab refresh).
 * Paginated — serverless-friendly chunk size.
 */
export async function runPostlogicArchiveStatusRefresh(
  supabase: SupabaseClient,
  opts: {
    performedBy?: string;
    performedByName?: string;
  }
): Promise<
  | {
      ok: true;
      polled: number;
      updated: number;
      results: PollStatusResultRow[];
    }
  | { ok: false; error: string }
> {
  const pageSize = 200;
  let page = 0;
  const results: PollStatusResultRow[] = [];
  let updated = 0;
  let polled = 0;
  const baseUrl = pollStatusBaseUrl();
  const apiKey = getPostlogicXApiKey();

  while (true) {
    const { data: batch, error } = await supabase
      .from("clients")
      .select(
        "id, first_name, last_name, assigned_to, assigned_services_id, postlogic_unique_id, stage, fedex_tracking_number, postlogic_status"
      )
      .not("fedex_tracking_number", "is", null)
      .neq("fedex_tracking_number", "")
      .not("postlogic_unique_id", "is", null)
      .order("id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!batch?.length) break;

    for (const c of batch) {
      polled += 1;
      const out = await executePostlogicPollForClientRow(
        supabase,
        c as PollClientRow,
        opts,
        baseUrl,
        apiKey
      );
      if (out.outcome === "fatal") {
        return { ok: false, error: out.error };
      }
      if (out.outcome === "updated") {
        results.push(out.result);
        updated += 1;
      }
    }

    if (batch.length < pageSize) break;
    page += 1;
  }

  return { ok: true, polled, updated, results };
}

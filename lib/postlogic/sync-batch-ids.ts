import type { SupabaseClient } from "@supabase/supabase-js";

export type BatchSyncResultRow = {
  id: string;
  name: string;
  unique_id: string;
  status: string | null;
  tracking: string | null;
};

type ShipmentRow = {
  unique_id?: string | null;
  recipient?: string | null;
  status?: string | null;
  tracking?: string | null;
};

async function fetchBatchForDate(batchDate: string): Promise<ShipmentRow[] | null> {
  if (!batchDate) {
    console.warn("Skipping fetch — batch_date is empty");
    return null;
  }
  const url = new URL("https://mgapepreyainffkvezjc.supabase.co/functions/v1/intake");
  url.searchParams.set("action", "batch");
  url.searchParams.set("partner", "DebtSupportPros, LLC");
  url.searchParams.set("batch_date", batchDate);
  url.searchParams.set("key", process.env.POSTLOGIC_API_KEY!);

  console.log("Fetching PostLogic batch:", url.toString());

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-api-key": process.env.POSTLOGIC_API_KEY!,
      Authorization: `Bearer ${process.env.POSTLOGIC_BEARER!}`,
      "Content-Type": "application/json",
    },
  });

  console.log("PostLogic response status:", res.status);

  if (!res.ok) {
    const errText = await res.text();
    console.error("PostLogic batch error:", res.status, errText);
    return null;
  }

  const data = (await res.json()) as {
    status?: string;
    shipments?: ShipmentRow[];
  };
  console.log("PostLogic batch data:", JSON.stringify(data));

  if (data.status !== "success") return null;
  return data.shipments || [];
}

/**
 * Pull batch shipments from PostLogic for recent dates and sync Print IDs / status / tracking onto clients.
 */
export async function runPostlogicBatchIdSync(
  adminClient: SupabaseClient,
  performedByLabel: string
): Promise<
  | {
      ok: true;
      matched: number;
      updated: number;
      results: BatchSyncResultRow[];
      datesChecked: string[];
    }
  | { ok: false; error: string }
> {
  const dates: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]!);
  }

  let totalMatched = 0;
  let totalUpdated = 0;
  const allResults: BatchSyncResultRow[] = [];

  try {
    for (const batchDate of dates) {
      const shipments = await fetchBatchForDate(batchDate);
      if (!shipments?.length) continue;

      console.log(`[sync-batch-ids] PostLogic batch ${batchDate}: ${shipments.length} shipments`);

      for (const shipment of shipments) {
        const uid = shipment.unique_id?.trim();
        if (!uid) continue;

        let { data: clients } = await adminClient
          .from("clients")
          .select(
            "id, first_name, last_name, assigned_to, postlogic_unique_id, fedex_tracking_number, postlogic_status, stage"
          )
          .eq("postlogic_unique_id", uid)
          .eq("is_active", true)
          .limit(1);

        if (!clients?.length) {
          const nameParts = (shipment.recipient ?? "").trim().split(/\s+/).filter(Boolean);
          const firstName = nameParts[0] ?? "";
          const lastName = nameParts.slice(1).join(" ").trim();

          if (firstName) {
            let nameQ = adminClient
              .from("clients")
              .select(
                "id, first_name, last_name, assigned_to, postlogic_unique_id, fedex_tracking_number, postlogic_status, stage"
              )
              .ilike("first_name", `${firstName}%`)
              .is("postlogic_unique_id", null)
              .eq("is_active", true)
              .limit(1);

            if (lastName) {
              nameQ = nameQ.ilike("last_name", `${lastName}%`);
            }

            const { data: nameMatches } = await nameQ;
            clients = nameMatches;
          }
        }

        if (!clients?.length) continue;

        const client = clients[0] as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          assigned_to: string | null;
          postlogic_unique_id: string | null;
          fedex_tracking_number: string | null;
          postlogic_status: string | null;
          stage: string | null;
        };

        totalMatched++;

        const updatePayload: Record<string, unknown> = {};
        let hasChanges = false;

        const shipStatus = shipment.status ?? null;
        const shipTracking = shipment.tracking?.trim() || null;

        if (!client.postlogic_unique_id) {
          updatePayload.postlogic_unique_id = uid;
          hasChanges = true;
        }

        if (
          shipStatus != null &&
          String(client.postlogic_status ?? "") !== String(shipStatus)
        ) {
          updatePayload.postlogic_status = shipStatus;
          hasChanges = true;
        }

        if (shipTracking && !client.fedex_tracking_number) {
          updatePayload.fedex_tracking_number = shipTracking;
          hasChanges = true;
          /** Stage advances only when PostLogic reports Delivered (see `poll-status`), not when tracking first appears. */
        }

        if (!hasChanges) continue;

        const { error: upErr } = await adminClient
          .from("clients")
          .update(updatePayload)
          .eq("id", client.id);

        if (upErr) {
          return { ok: false, error: upErr.message };
        }

        const { error: auditErr } = await adminClient.from("audit_log").insert({
          client_id: client.id,
          action: "fedex_tracking_updated",
          new_value: {
            postlogic_status: shipStatus,
            unique_id: uid,
            tracking: shipTracking,
            batch_date: batchDate,
            auto_synced: true,
          },
          performed_by_name: performedByLabel,
        });

        if (auditErr) {
          console.warn("[sync-batch-ids] audit insert warning:", auditErr.message);
        }

        if (shipTracking && !client.fedex_tracking_number && client.assigned_to) {
          const nm =
            `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Client";
          const { error: notifErr } = await adminClient.from("notifications").insert({
            user_id: client.assigned_to,
            type: "fedex_update",
            title: "Tracking number updated",
            body: `${nm}: tracking ${shipTracking}`,
            client_id: client.id,
            client_name: nm,
            read: false,
            action_url: `/clients/${client.id}`,
          });
          if (notifErr) {
            console.warn("[sync-batch-ids] notification:", notifErr.message);
          }
        }

        totalUpdated++;
        allResults.push({
          id: client.id,
          name: `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "—",
          unique_id: uid,
          status: shipStatus,
          tracking: shipTracking,
        });
      }
    }

    return {
      ok: true,
      matched: totalMatched,
      updated: totalUpdated,
      results: allResults,
      datesChecked: dates,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-batch-ids] error:", err);
    return { ok: false, error: msg };
  }
}

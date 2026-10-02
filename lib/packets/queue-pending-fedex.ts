import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Puts a client on Packets Needed / the next FedEx print batch without
 * erasing shipment history.
 *
 * Pending markers must not set batch_id / batch_date — those are stamped
 * only when the packet is actually sent. AM, Resend, and eSign all use
 * this helper so the queue stays one shape.
 */
export async function queuePendingPrimaryFedex(
  admin: SupabaseClient,
  clientId: string
): Promise<"inserted" | "exists" | "failed"> {
  const { data: existing } = await admin
    .from("client_fedex_shipments")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "Pending")
    .eq("recipient_type", "primary")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return "exists";

  const { data: client, error: clientErr } = await admin
    .from("clients")
    .select("first_name, last_name")
    .eq("id", clientId)
    .maybeSingle();
  if (clientErr || !client) {
    console.error("[queuePendingPrimaryFedex] client", clientErr?.message);
    return "failed";
  }

  const recipientName =
    `${String(client.first_name ?? "").trim()} ${String(client.last_name ?? "").trim()}`
      .trim()
      .toUpperCase() || "CLIENT";

  const { error } = await admin.from("client_fedex_shipments").insert({
    client_id: clientId,
    recipient_name: recipientName,
    recipient_type: "primary",
    carrier: "FedEx",
    status: "Pending",
  });
  if (error) {
    console.error("[queuePendingPrimaryFedex] insert", error.message);
    return "failed";
  }
  return "inserted";
}

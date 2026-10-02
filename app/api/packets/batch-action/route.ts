import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  omitCarrierStatus,
  retryWriteWithoutCarrierStatus,
} from "@/lib/packets/carrier-status-column";

const DEV_EMAIL = "dev@debtsupportpros.com";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.email !== DEV_EMAIL)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    action: string;
    shipmentId?: string;
    clientId?: string;
    batchId?: string;
  };
  const { action } = body;
  const admin = createAdminClient();

  // Tab-only: Packet Sent (Processing) → Packet Delivered. Does not stamp
  // delivered_at or carrier_status — FedEx may still be In Transit.
  if (action === "sent_to_delivered") {
    const { error: archiveError } = await admin
      .from("client_fedex_shipments")
      .update({ status: "Archived" })
      .eq("status", "Delivered");
    if (archiveError) return NextResponse.json({ error: archiveError.message }, { status: 500 });

    const { data, error } = await admin
      .from("client_fedex_shipments")
      .update({ status: "Delivered" })
      .eq("status", "Processing")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, updated: data?.length ?? 0 });
  }

  if (action === "delivered_to_archive") {
    const { data, error } = await admin
      .from("client_fedex_shipments")
      .update({ status: "Archived" })
      .eq("status", "Delivered")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, updated: data?.length ?? 0 });
  }

  if (action === "mark_delivered") {
    const { shipmentId } = body;
    if (!shipmentId)
      return NextResponse.json({ error: "shipmentId required" }, { status: 400 });
    const deliveredPatch = {
      status: "Delivered",
      carrier_status: "Delivered",
      delivered_at: new Date().toISOString(),
    };
    const { error } = await retryWriteWithoutCarrierStatus(
      () =>
        admin.from("client_fedex_shipments").update(deliveredPatch).eq("id", shipmentId),
      () =>
        admin
          .from("client_fedex_shipments")
          .update(omitCarrierStatus(deliveredPatch))
          .eq("id", shipmentId)
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "reset_to_needed") {
    const { clientId } = body;
    if (!clientId)
      return NextResponse.json({ error: "clientId required" }, { status: 400 });

    const { error: deleteError } = await admin
      .from("client_fedex_shipments")
      .delete()
      .eq("client_id", clientId);
    if (deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 });

    const { error: updateError } = await admin
      .from("clients")
      .update({
        postlogic_status: null,
        fedex_tracking_number: null,
        fedex_batch_sent_at: null,
        batch_id: null,
      })
      .eq("id", clientId);
    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  }

  // Add a specific client to a batch by name + tracking number.
  // Looks up the client, creates (or updates) their shipment record.
  if (action === "add_to_batch") {
    const { firstName, lastName, batchId, trackingNumber, status: shipStatus } =
      body as unknown as {
        firstName: string;
        lastName: string;
        batchId: string;
        trackingNumber: string;
        status?: string;
      };
    if (!firstName || !lastName || !batchId || !trackingNumber)
      return NextResponse.json({ error: "firstName, lastName, batchId, trackingNumber required" }, { status: 400 });

    // Find the client
    const { data: clients, error: clientErr } = await admin
      .from("clients")
      .select("id, first_name, last_name, street_address, city, state, zip_code, phone_mobile, assigned_to, fedex_merchant")
      .ilike("first_name", firstName.trim())
      .ilike("last_name", lastName.trim())
      .limit(5);
    if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 });
    if (!clients?.length) return NextResponse.json({ error: `No client found matching "${firstName} ${lastName}"` }, { status: 404 });

    const client = clients[0] as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      street_address: string | null;
      city: string | null;
      state: string | null;
      zip_code: string | null;
      phone_mobile: string | null;
      assigned_to: string | null;
      fedex_merchant: string | null;
    };

    // Resolve advisor name
    let advisorName: string | null = null;
    if (client.assigned_to) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", client.assigned_to)
        .single();
      advisorName = (profile as { full_name: string | null } | null)?.full_name ?? null;
    }

    const finalStatus = shipStatus ?? "Delivered";
    const deliveredAt = finalStatus === "Delivered" ? new Date().toISOString() : null;
    const recipientName = `${(client.first_name ?? "").toUpperCase()} ${(client.last_name ?? "").toUpperCase()}`.trim();

    // Insert shipment record
    const insertRow = {
      client_id: client.id,
      recipient_name: recipientName,
      recipient_type: "primary",
      carrier: "FedEx",
      batch_id: batchId,
      batch_date: batchId,
      tracking_number: trackingNumber,
      status: finalStatus === "Archived" ? "Archived" : finalStatus === "Delivered" ? "Delivered" : "Processing",
      carrier_status: shipStatus ?? (finalStatus === "Delivered" ? "Delivered" : "Processing"),
      delivered_at: deliveredAt,
      advisor: advisorName,
      merchant: client.fedex_merchant ?? null,
      street_address: client.street_address,
      city: client.city,
      state: client.state,
      zip_code: client.zip_code,
      phone: client.phone_mobile,
      sent_at: new Date().toISOString(),
    };
    const { error: insertErr } = await retryWriteWithoutCarrierStatus(
      () => admin.from("client_fedex_shipments").insert(insertRow),
      () => admin.from("client_fedex_shipments").insert(omitCarrierStatus(insertRow))
    );
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Update client fields
    await admin
      .from("clients")
      .update({
        postlogic_status: finalStatus,
        fedex_tracking_number: trackingNumber,
        batch_id: batchId,
      })
      .eq("id", client.id);

    return NextResponse.json({ success: true, clientId: client.id, recipientName });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}


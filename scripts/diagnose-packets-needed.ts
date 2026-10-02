import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // 1. All welcome_packet clients
  const { data: wpClients } = await sb
    .from("clients")
    .select("id, first_name, last_name, is_active, delivery_method, fedex_queued_at, created_at")
    .eq("stage", "welcome_packet")
    .order("created_at", { ascending: false });

  console.log(`\n=== welcome_packet clients total: ${wpClients?.length ?? 0} ===`);
  wpClients?.forEach(c =>
    console.log(`  ${c.id}  ${c.first_name} ${c.last_name}  active=${c.is_active}  delivery=${c.delivery_method ?? "NULL"}  queued=${c.fedex_queued_at ?? "NULL"}`)
  );

  // 2. Which of those have rows in client_fedex_shipments (would be excluded)
  if (wpClients?.length) {
    const wpIds = wpClients.map(c => c.id);
    const { data: shipped } = await sb
      .from("client_fedex_shipments")
      .select("client_id, status, batch_id")
      .in("client_id", wpIds);

    console.log(`\n=== welcome_packet clients with existing shipment rows: ${shipped?.length ?? 0} ===`);
    shipped?.forEach(s => console.log(`  client_id=${s.client_id}  status=${s.status}  batch=${s.batch_id}`));
  }

  // 3. welcome_packet + is_active + no shipment (what fetchPacketsNeeded returns)
  const { data: allShipped } = await sb
    .from("client_fedex_shipments")
    .select("client_id")
    .not("client_id", "is", null);

  const shippedIds = new Set((allShipped ?? []).map((r: {client_id: string}) => r.client_id));
  const eligible = (wpClients ?? []).filter(c => c.is_active && !shippedIds.has(c.id));
  console.log(`\n=== Eligible for Packets Needed (active + no prior shipment): ${eligible.length} ===`);
  eligible.forEach(c => console.log(`  ${c.first_name} ${c.last_name}  delivery=${c.delivery_method ?? "NULL"}`));
}

main();

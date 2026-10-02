import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data, error } = await sb
    .from("client_fedex_shipments")
    .select("id, client_id, recipient_name, status, sent_at, batch_id, batch_date, created_at")
    .eq("status", "Pending");

  console.log(`\nPending shipments: ${data?.length ?? 0}`, error?.message ?? "");
  data?.forEach((s) =>
    console.log(` • ${s.recipient_name} | batch: ${s.batch_id} | created: ${s.created_at}`)
  );

  // Also check clients at welcome_packet with delivery_method=fedex
  const { data: wpc } = await sb
    .from("clients")
    .select("id, first_name, last_name, delivery_method, fedex_batch_sent_at, stage")
    .eq("stage", "welcome_packet")
    .eq("is_active", true);

  console.log(`\nClients at welcome_packet: ${wpc?.length ?? 0}`);
  wpc?.forEach((c) =>
    console.log(
      ` • ${c.first_name} ${c.last_name} | delivery: ${c.delivery_method} | sent_at: ${c.fedex_batch_sent_at ?? "NULL"}`
    )
  );
}

main();

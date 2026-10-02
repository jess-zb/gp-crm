import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // Simulate the new fetchPacketsNeeded query
  const { data, error } = await sb
    .from("clients")
    .select("id, first_name, last_name, fedex_queued_at, delivery_method")
    .eq("stage", "welcome_packet")
    .eq("is_active", true)
    .eq("delivery_method", "fedex")
    .is("fedex_batch_sent_at", null)
    .order("fedex_queued_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) { console.error(error.message); return; }

  console.log(`\nPackets Needed tab would show ${data?.length ?? 0} clients:\n`);
  data?.forEach((c, i) =>
    console.log(`  ${i + 1}. ${c.first_name} ${c.last_name}  (queued: ${c.fedex_queued_at ?? "NULL"})`)
  );
}

main();

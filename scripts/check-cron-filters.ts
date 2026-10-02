import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: all } = await sb
    .from("clients")
    .select("id, first_name, last_name, postlogic_unique_id, batch_id, is_active, fedex_queued_at")
    .eq("stage", "welcome_packet")
    .eq("delivery_method", "fedex")
    .is("fedex_batch_sent_at", null);

  console.log(`\nAll welcome_packet+fedex+not_sent: ${all?.length ?? 0}`);

  const blocked = all?.filter((c) => c.postlogic_unique_id !== null) ?? [];
  console.log(`\nBlocked by postlogic_unique_id NOT NULL: ${blocked.length}`);
  blocked.forEach((c) =>
    console.log(`  • ${c.first_name} ${c.last_name} | uid: ${c.postlogic_unique_id}`)
  );

  const batchBlocked = all?.filter((c) => c.batch_id !== null) ?? [];
  console.log(`\nBlocked by batch_id NOT NULL: ${batchBlocked.length}`);
  batchBlocked.forEach((c) =>
    console.log(`  • ${c.first_name} ${c.last_name} | bid: ${c.batch_id}`)
  );

  const noQueue = all?.filter((c) => !c.fedex_queued_at) ?? [];
  console.log(`\nBlocked by fedex_queued_at NULL: ${noQueue.length}`);
  noQueue.forEach((c) => console.log(`  • ${c.first_name} ${c.last_name}`));

  const inactive = all?.filter((c) => !c.is_active) ?? [];
  console.log(`\nBlocked by is_active=false: ${inactive.length}`);
}

main();

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: targets } = await sb
    .from("clients")
    .select("id, first_name, last_name")
    .eq("stage", "welcome_packet")
    .eq("is_active", true)
    .eq("delivery_method", "fedex")
    .is("fedex_queued_at", null)
    .is("fedex_batch_sent_at", null);

  console.log(`Found ${targets?.length ?? 0} clients to backfill:`);
  targets?.forEach(c => console.log(`  ${c.first_name} ${c.last_name}`));

  if (!targets?.length) { console.log("Nothing to do."); return; }

  const now = new Date().toISOString();
  const ids = targets.map(c => c.id);

  const { error } = await sb
    .from("clients")
    .update({ fedex_queued_at: now })
    .in("id", ids);

  if (error) console.error("Error:", error.message);
  else console.log(`\n✓ Set fedex_queued_at on ${ids.length} clients.`);
}

main();

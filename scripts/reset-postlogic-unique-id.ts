import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // Find welcome_packet clients blocked by postlogic_unique_id
  const { data: targets } = await sb
    .from("clients")
    .select("id, first_name, last_name, postlogic_unique_id")
    .eq("stage", "welcome_packet")
    .eq("is_active", true)
    .eq("delivery_method", "fedex")
    .is("fedex_batch_sent_at", null)
    .not("postlogic_unique_id", "is", null);

  console.log(`Found ${targets?.length ?? 0} clients to unblock:`);
  targets?.forEach((c) =>
    console.log(`  ${c.first_name} ${c.last_name}  (uid: ${c.postlogic_unique_id})`)
  );

  if (!targets?.length) {
    console.log("Nothing to do.");
    return;
  }

  const ids = targets.map((c) => c.id);

  const { error } = await sb
    .from("clients")
    .update({ postlogic_unique_id: null })
    .in("id", ids);

  if (error) console.error("Error:", error.message);
  else console.log(`\n✓ Cleared postlogic_unique_id on ${ids.length} clients — cron will now pick them up.`);
}

main();

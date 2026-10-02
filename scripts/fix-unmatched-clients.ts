import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const fixes = [
  { tracking: "872355822815", clientId: "3442d299-62a5-43e8-93d6-2226793d46aa", name: "Robert Currey" },
  { tracking: "872355823259", clientId: "f4bc08b3-6031-444b-97ca-c4ceeb96ce8d", name: "Wanda Pinion" },
  { tracking: "872355824120", clientId: "f4bc08b3-6031-444b-97ca-c4ceeb96ce8d", name: "Billy Pinion" },
  { tracking: "872355823513", clientId: "f0ae733d-b0e0-499a-ae1e-3657c1d0817e", name: "Chitram Sewnarine" },
];

async function main() {
  // First check which rows exist
  const { data: existing } = await sb
    .from("client_fedex_shipments")
    .select("id, tracking_number, client_id, recipient_name")
    .in("tracking_number", fixes.map(f => f.tracking));

  console.log(`Found ${existing?.length ?? 0} rows in DB for these tracking numbers:`);
  existing?.forEach(r =>
    console.log(`  ${r.tracking_number}  client_id=${r.client_id ?? "NULL"}  name=${r.recipient_name}`)
  );
  console.log();

  // Patch each row
  for (const fix of fixes) {
    const existing_row = existing?.find(r => r.tracking_number === fix.tracking);
    if (!existing_row) {
      console.warn(`  ⚠ Row not found for ${fix.name} (tracking ${fix.tracking}) — inserting now`);
      const { error } = await sb.from("client_fedex_shipments").insert({
        client_id: fix.clientId,
        recipient_name: fix.name,
        recipient_type: "primary",
        carrier: "fedex",
        batch_id: "2026-05-28",
        batch_date: "2026-05-28",
        status: "Completed",
        tracking_number: fix.tracking,
        sent_at: "2026-05-28T20:00:00-04:00",
        delivered_at: null,
      });
      if (error) console.error(`    Insert error: ${error.message}`);
      else console.log(`  ✓ Inserted ${fix.name}`);
      continue;
    }

    const { error } = await sb
      .from("client_fedex_shipments")
      .update({ client_id: fix.clientId })
      .eq("tracking_number", fix.tracking);

    if (error) console.error(`  ✗ ${fix.name}: ${error.message}`);
    else console.log(`  ✓ Patched ${fix.name} → ${fix.clientId}`);
  }
}

main();

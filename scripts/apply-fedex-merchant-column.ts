import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // Apply the missing migration: add fedex_merchant column to clients
  const { error } = await sb.rpc("exec_sql" as never, {
    sql: "ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS fedex_merchant TEXT;",
  });

  if (error) {
    // exec_sql may not exist — try direct query instead
    console.log("exec_sql not available, trying direct approach...");
    const { data, error: err2 } = await sb
      .from("clients")
      .select("fedex_merchant")
      .limit(1);
    if (err2?.code === "42703") {
      console.error("Column still missing. Need to run migration via Supabase dashboard SQL editor:");
      console.error("  ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS fedex_merchant TEXT;");
    } else {
      console.log("Column already exists or was added:", data);
    }
    return;
  }

  console.log("✓ fedex_merchant column added to clients table");

  // Verify
  const { data, error: verifyErr } = await sb
    .from("clients")
    .select("fedex_merchant")
    .limit(1);
  if (verifyErr) {
    console.error("Verify failed:", verifyErr.message);
  } else {
    console.log("✓ Verified: fedex_merchant column is queryable");
  }
}
main();

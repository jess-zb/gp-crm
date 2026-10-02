import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const searches = [
  ["Robert", "Currey"],
  ["Wanda", "Pinion"],
  ["Billy", "Pinion"],
  ["Chitram", "Sewnarine"],
];

async function main() {
  for (const [first, last] of searches) {
    const { data } = await sb
      .from("clients")
      .select("id, first_name, last_name, spouse_first_name, spouse_last_name")
      .or(`last_name.ilike.%${last}%,spouse_last_name.ilike.%${last}%`);
    console.log(`\n=== ${first} ${last} ===`);
    if (!data?.length) {
      // Try first name only
      const { data: d2 } = await sb
        .from("clients")
        .select("id, first_name, last_name, spouse_first_name, spouse_last_name")
        .or(`first_name.ilike.%${first}%,spouse_first_name.ilike.%${first}%`);
      if (!d2?.length) console.log("  (no match on first or last name)");
      else d2.forEach(r => console.log(`  [first-only] ${r.id}  ${r.first_name} ${r.last_name} / spouse: ${r.spouse_first_name ?? "-"} ${r.spouse_last_name ?? "-"}`));
    } else {
      data.forEach(r => console.log(`  ${r.id}  ${r.first_name} ${r.last_name} / spouse: ${r.spouse_first_name ?? "-"} ${r.spouse_last_name ?? "-"}`));
    }
  }
}

main();

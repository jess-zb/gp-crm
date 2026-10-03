/**
 * Disposable CRM client for eSign QA.
 * Delete this client when testing is done (nickname ESIGN-TEST-DELETE).
 *
 *   npx tsx scripts/seed-esign-test-client.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const EMAIL = "esign-qa@goldenpathway.io";
const NICKNAME = "ESIGN-TEST-DELETE";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: existing } = await admin
    .from("clients")
    .select("id, first_name, last_name, stage")
    .eq("nickname", NICKNAME)
    .maybeSingle();
  if (existing) {
    console.log("Already exists:", existing.id, `/clients/${existing.id}`);
    return;
  }

  const { data: jessica } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .ilike("email", EMAIL)
    .maybeSingle();

  const { data: client, error } = await admin
    .from("clients")
    .insert({
      first_name: "Jessica",
      last_name: "EsignTest",
      nickname: NICKNAME,
      email: EMAIL,
      phone: "5551234567",
      phone_mobile: "5551234567",
      street_address: "1 Test Street",
      city: "Miami",
      state: "FL",
      zip_code: "33101",
      stage: "welcome_packet",
      is_active: true,
      assigned_to: jessica?.id ?? null,
      verbal_password: "esign-test",
    })
    .select("id")
    .single();
  if (error || !client) {
    throw new Error(error?.message || "client insert failed");
  }

  await admin.from("client_cards").insert([
    {
      client_id: client.id,
      last_four: "4242",
      charge_amount_cents: 15000,
      merchant_name: "TESTMID",
      creditor_name: "Test Card 1",
      card_type: "visa",
    },
    {
      client_id: client.id,
      last_four: "1111",
      charge_amount_cents: 5000,
      merchant_name: "TESTMID",
      creditor_name: "Test Card 2",
      card_type: "visa",
    },
  ]);

  console.log("Created test client", client.id);
  console.log(`/clients/${client.id}`);
  if (jessica) {
    console.log("Assigned to", jessica.full_name, jessica.role);
  } else {
    console.log("No staff profile for", EMAIL, "— assigned_to left empty");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

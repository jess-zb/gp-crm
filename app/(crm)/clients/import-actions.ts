"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canImportClientsCsv } from "@/lib/roles";

export type ImportRow = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

export type ImportResult =
  | { ok: true; imported: number; failed: number }
  | { ok: false; error: string };

export async function importClientsCsv(rows: ImportRow[]): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");
  if (profile.role === "client" || profile.role === "attorney") {
    redirect(profile.role === "attorney" ? "/attorney/cases" : "/portal");
  }

  if (!canImportClientsCsv(profile.role)) {
    return {
      ok: false,
      error: "Only developers and administrators can import clients.",
    };
  }

  if (rows.length === 0) {
    return { ok: false, error: "No rows to import." };
  }

  let imported = 0;
  let failed = 0;

  for (const r of rows) {
    const fn = (r.first_name ?? "").trim() || "Unknown";
    const ln = (r.last_name ?? "").trim() || "Unknown";
    const payload = {
      first_name: fn,
      last_name: ln,
      email: r.email?.trim() || null,
      phone: r.phone?.trim() || null,
      street_address: r.street_address?.trim() || null,
      city: r.city?.trim() || null,
      state: r.state?.trim() || null,
      zip_code: r.zip_code?.trim() || null,
      stage: "lead" as const,
      is_active: true,
    };

    const { error } = await supabase.from("clients").insert(payload);
    if (error) {
      failed += 1;
    } else {
      imported += 1;
    }
  }

  revalidatePath("/clients");
  return { ok: true, imported, failed };
}

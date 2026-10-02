"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canDeleteClientRecord } from "@/lib/roles";

export async function softDeleteClient(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const id = String(formData.get("clientId") ?? "");
    if (!id) return { ok: false, error: "Missing client ID" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { profile } = await getProfileForUser(supabase, user);
    if (!profile) redirect("/login");

    if (!canDeleteClientRecord(profile.role)) {
      return { ok: false, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from("clients")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("[softDeleteClient] update error:", error.message);
      return { ok: false, error: "Failed to delete client" };
    }

    revalidatePath("/clients");
    return { ok: true };
  } catch (err) {
    console.error(
      "[softDeleteClient] unexpected error:",
      err instanceof Error ? err.message : String(err)
    );
    return { ok: false, error: "Something went wrong" };
  }
}

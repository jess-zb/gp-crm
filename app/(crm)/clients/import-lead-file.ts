"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isCrmStaffRole } from "@/lib/roles";
import { savePartnerExport } from "@/lib/leads/save-partner-export";
import type { InboundLeadFields } from "@/lib/leads/parse-inbound-lead";

const MAX_BYTES = 1_000_000;

export type ImportLeadFileResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

function invalidFileMessage(fields: InboundLeadFields | undefined): string {
  const messages = Object.values(fields ?? {}).filter(
    (message): message is string => Boolean(message) && message !== "Send a JSON object."
  );
  if (messages.length === 0) return "That file is not a lead export.";
  return messages.join(" ");
}

/** Staff drop on Clients. Same text-file lead as the partner export, without the API key. */
export async function importLeadTextFile(formData: FormData): Promise<ImportLeadFileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !isCrmStaffRole(profile.role)) {
    return { ok: false, error: "You cannot add a lead." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Drop a .txt lead file." };
  }
  const name = file.name.trim();
  const looksLikeText =
    name.toLowerCase().endsWith(".txt") ||
    file.type === "text/plain" ||
    file.type.startsWith("text/plain;");
  if (!looksLikeText) {
    return { ok: false, error: "Drop a .txt lead file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That file is too large." };
  }

  const text = await file.text();
  if (!text.trim()) {
    return { ok: false, error: "That file is empty." };
  }

  const admin = createAdminClient();
  const result = await savePartnerExport(admin, {
    text,
    fileName: name,
    performedBy: user.id,
    performedByName: profile.full_name?.trim() || user.email || "Staff",
  });

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.status === 400
          ? invalidFileMessage(result.body.fields)
          : "Could not add that lead.",
    };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${result.body.id}`);
  return { ok: true, id: result.body.id, name: result.body.name };
}

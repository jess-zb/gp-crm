"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { canAccessPriorityBoard } from "@/lib/roles";
import {
  isCsChecklistItemKey,
  writeCsChecklistItem,
} from "@/lib/clients/cs-checklist-write";

export type CsChecklistActionResult = { ok: true } | { ok: false; error: string };

/**
 * Re-checks board access on every write. The hidden tab is a UX affordance, not
 * the boundary — a non-Services account manager could still call this directly.
 */
async function requireBoardAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  if (!canAccessPriorityBoard(profile.role, profile.is_services)) {
    return { ok: false as const, error: "Not authorized." };
  }

  return {
    ok: true as const,
    supabase,
    actorId: user.id,
    actorName: profile.full_name?.trim() || profile.email || "Unknown",
  };
}

export async function setCsChecklistItem(input: {
  clientId: string;
  itemKey: string;
  complete: boolean;
}): Promise<CsChecklistActionResult> {
  if (!isCsChecklistItemKey(input.itemKey)) {
    return { ok: false, error: "Unknown checklist item." };
  }

  const auth = await requireBoardAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  const result = await writeCsChecklistItem(auth.supabase, {
    clientIds: [input.clientId],
    itemKey: input.itemKey,
    complete: input.complete,
    actorId: auth.actorId,
    actorName: auth.actorName,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/clients");
  revalidatePath(`/clients/${input.clientId}`);
  return { ok: true };
}

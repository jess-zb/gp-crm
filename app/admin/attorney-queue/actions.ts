"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessAttorneyQueue } from "@/lib/roles";
import { assignClientsToAttorney } from "@/lib/attorney-queue/assign-clients";
import { toUserFacingError } from "@/lib/user-facing-error";

async function requireAttorneyQueueStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Unauthorized" };

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canAccessAttorneyQueue(profile.role)) {
    return { ok: false as const, error: "Forbidden" };
  }

  return {
    ok: true as const,
    supabase,
    user,
    profile,
    assignedByName:
      profile.full_name?.trim() || user.email?.trim() || "Staff",
  };
}

export async function assignAttorneyClientsAction(input: {
  clientIds: string[];
  attorneyId: string;
}): Promise<
  | {
      ok: true;
      clientCount: number;
      attorneyName: string;
      warnings: string[];
    }
  | { ok: false; error: string }
> {
  const auth = await requireAttorneyQueueStaff();
  if (!auth.ok) return auth;

  try {
    const result = await assignClientsToAttorney({
      supabase: auth.supabase,
      clientIds: input.clientIds,
      attorneyId: input.attorneyId,
      assignedBy: auth.user.id,
      assignedByName: auth.assignedByName,
    });

    if (!result.ok) {
      return { ok: false, error: toUserFacingError(result.error) };
    }

    revalidatePath("/admin/attorney-queue");
    revalidatePath("/attorney/cases");
    return {
      ok: true,
      clientCount: result.clientCount,
      attorneyName: result.attorneyName,
      warnings: result.clientEmailWarnings,
    };
  } catch (err) {
    console.error("[assignAttorneyClientsAction]", err);
    return { ok: false, error: "Something went wrong assigning clients." };
  }
}

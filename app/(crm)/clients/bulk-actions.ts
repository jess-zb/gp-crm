"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import {
  canAccessPriorityBoard,
  canBulkDeleteClients,
  isCrmStaffRole,
} from "@/lib/roles";
import { ALL_STAGE_ORDER, isPipelineStageHidden } from "@/lib/constants/stages";
import {
  isCsChecklistItemKey,
  writeCsChecklistItem,
} from "@/lib/clients/cs-checklist-write";

const STAGES = new Set<string>(
  [...ALL_STAGE_ORDER].filter((s) => !isPipelineStageHidden(s))
);

export type BulkResult = { ok: true } | { ok: false; error: string };

async function requireStaff() {
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
  return { supabase, user, profile };
}

async function filterAccessibleIds(
  supabase: SupabaseClient,
  profile: { role: string },
  userId: string,
  ids: string[]
): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data: rows, error } = await supabase
    .from("clients")
    .select("id, assigned_to")
    .in("id", ids);
  if (error || !rows) return [];
  return rows
    .filter(() => isCrmStaffRole(profile.role))
    .map((r) => r.id as string);
}

export async function bulkChangeStage(
  clientIds: string[],
  stage: string
): Promise<BulkResult> {
  if (!STAGES.has(stage) || isPipelineStageHidden(stage)) {
    return { ok: false, error: "Invalid stage." };
  }
  const { supabase, user, profile } = await requireStaff();
  if (!isCrmStaffRole(profile.role)) {
    return { ok: false, error: "Not allowed." };
  }
  const valid = await filterAccessibleIds(supabase, profile, user.id, clientIds);
  if (valid.length === 0) {
    return { ok: false, error: "No clients to update." };
  }

  // Block New Lead → anything other than Account Manager (same rule as profile stage dropdown).
  if (stage !== "account_manager" && stage !== "lead") {
    const { data: rows } = await supabase
      .from("clients")
      .select("id, stage")
      .in("id", valid);
    const blocked = (rows ?? []).some(
      (r) => (r.stage as string | null) === "lead"
    );
    if (blocked) {
      return {
        ok: false,
        error:
          "New Lead clients can only be moved to Account Manager. Advance them one stage at a time.",
      };
    }
  }

  const { error } = await supabase
    .from("clients")
    .update({ stage, stage_entered_at: new Date().toISOString() })
    .in("id", valid);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  revalidatePath("/pipeline");
  return { ok: true };
}

export async function bulkAssign(
  clientIds: string[],
  assignedTo: string | null
): Promise<BulkResult> {
  const { supabase, user, profile } = await requireStaff();
  if (!isCrmStaffRole(profile.role)) {
    return { ok: false, error: "Not allowed." };
  }
  const valid = await filterAccessibleIds(supabase, profile, user.id, clientIds);
  if (valid.length === 0) {
    return { ok: false, error: "No clients to update." };
  }
  const { error } = await supabase
    .from("clients")
    .update({ assigned_to: assignedTo })
    .in("id", valid);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  return { ok: true };
}

/**
 * Marks one Client Services checklist item complete across many clients.
 * Access is re-checked here because the hidden Priority tab is not the boundary.
 */
export async function bulkSetCsChecklistItem(
  clientIds: string[],
  itemKey: string
): Promise<BulkResult> {
  if (!isCsChecklistItemKey(itemKey)) {
    return { ok: false, error: "Unknown checklist item." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  if (!canAccessPriorityBoard(profile.role, profile.is_services)) {
    return { ok: false, error: "Not authorized." };
  }

  const ids = Array.from(new Set(clientIds.filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: "No clients to update." };

  const result = await writeCsChecklistItem(supabase, {
    clientIds: ids,
    itemKey,
    complete: true,
    actorId: user.id,
    actorName: profile.full_name?.trim() || profile.email || "Unknown",
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/clients");
  return { ok: true };
}

export async function bulkSoftDelete(clientIds: string[]): Promise<BulkResult> {
  const { supabase, user, profile } = await requireStaff();
  if (!canBulkDeleteClients(profile.role)) {
    return {
      ok: false,
      error: "Only developers and administrators can bulk-delete clients.",
    };
  }
  const valid = await filterAccessibleIds(supabase, profile, user.id, clientIds);
  if (valid.length === 0) {
    return { ok: false, error: "No clients to update." };
  }
  const { error } = await supabase
    .from("clients")
    .update({ is_active: false })
    .in("id", valid);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  return { ok: true };
}

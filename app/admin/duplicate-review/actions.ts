"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DuplicateActionResult =
  | { success: true }
  | { success: false; error: string };

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set."
    );
  }
  return createAdminClient();
}

async function verifyAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = getServiceSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "";
  if (!["admin", "dev"].includes(role)) {
    throw new Error("Access denied. Admin or dev role required.");
  }

  return {
    user,
    performerName: profile?.full_name?.trim() || user.email || "Admin",
  };
}

/**
 * Tables to re-point before deleting the duplicate client.
 *
 * onboarding_checklist is handled separately by mergeChecklistRows: it has a
 * unique index on (client_id, item_key), so blindly re-pointing rows would
 * collide with the kept client's own rows for the same step.
 */
const MOVE_CLIENT_ID_TABLES = [
  "communications",
  "reminders",
  "documents",
  "client_fedex_shipments",
  "sequence_enrollments",
  "client_cards",
  "email_logs",
] as const;

type MergeChecklistRow = {
  id: string;
  item_key: string | null;
  completed: boolean | null;
  completed_at: string | null;
  completed_by: string | null;
  bypassed: boolean | null;
  bypass_reason: string | null;
};

const CHECKLIST_MERGE_SELECT =
  "id, item_key, completed, completed_at, completed_by, bypassed, bypass_reason";

function isResolved(row: MergeChecklistRow): boolean {
  return row.completed === true || row.bypassed === true;
}

/**
 * Moves the duplicate's checklist rows onto the kept client without violating
 * the unique index on (client_id, item_key).
 *
 * Where both clients hold a row for the same step, the kept row wins unless it
 * is unresolved and the duplicate's is complete or bypassed -- progress should
 * survive a merge rather than being discarded. The duplicate's row is then
 * deleted. Unkeyed rows cannot collide, so they are simply re-pointed.
 */
async function mergeChecklistRows(
  supabase: SupabaseClient,
  keepId: string,
  deleteId: string
): Promise<string | null> {
  const [keepRes, dupRes] = await Promise.all([
    supabase.from("onboarding_checklist").select(CHECKLIST_MERGE_SELECT).eq("client_id", keepId),
    supabase.from("onboarding_checklist").select(CHECKLIST_MERGE_SELECT).eq("client_id", deleteId),
  ]);

  if (keepRes.error) return keepRes.error.message;
  if (dupRes.error) return dupRes.error.message;

  const keepByKey = new Map<string, MergeChecklistRow>();
  for (const row of (keepRes.data ?? []) as MergeChecklistRow[]) {
    if (row.item_key) keepByKey.set(row.item_key, row);
  }

  const repointIds: string[] = [];
  const dropIds: string[] = [];

  for (const dup of (dupRes.data ?? []) as MergeChecklistRow[]) {
    const existing = dup.item_key ? keepByKey.get(dup.item_key) : undefined;

    if (!existing) {
      repointIds.push(dup.id);
      // Claim the key so two of the duplicate's aliased rows cannot both move.
      if (dup.item_key) keepByKey.set(dup.item_key, dup);
      continue;
    }

    if (!isResolved(existing) && isResolved(dup)) {
      const { error } = await supabase
        .from("onboarding_checklist")
        .update({
          completed: dup.completed,
          completed_at: dup.completed_at,
          completed_by: dup.completed_by,
          bypassed: dup.bypassed,
          bypass_reason: dup.bypass_reason,
        })
        .eq("id", existing.id);
      if (error) return error.message;
    }

    dropIds.push(dup.id);
  }

  if (repointIds.length > 0) {
    const { error } = await supabase
      .from("onboarding_checklist")
      .update({ client_id: keepId })
      .in("id", repointIds);
    if (error) return error.message;
  }

  if (dropIds.length > 0) {
    const { error } = await supabase
      .from("onboarding_checklist")
      .delete()
      .in("id", dropIds);
    if (error) return error.message;
  }

  return null;
}

interface ClientMergeUpdates {
  shape_contact_id?: string;
  shape_lead_id?: string;
  phone_mobile?: string;
}

export async function mergeDuplicateClients(
  keepId: string,
  deleteId: string
): Promise<DuplicateActionResult> {
  console.log("[merge] called with:", keepId, deleteId);

  try {
    const { user, performerName } = await verifyAdminAccess();
    console.log("[merge] user verified:", user.id);

    const supabase = getServiceSupabase();

    for (const table of MOVE_CLIENT_ID_TABLES) {
      const { error } = await supabase
        .from(table)
        .update({ client_id: keepId })
        .eq("client_id", deleteId);

      if (error) {
        console.error(`[merge] ${table} update failed:`, error.message);
        return { success: false, error: `${table}: ${error.message}` };
      }
    }

    const checklistErr = await mergeChecklistRows(supabase, keepId, deleteId);
    if (checklistErr) {
      console.error("[merge] onboarding_checklist merge failed:", checklistErr);
      return { success: false, error: `onboarding_checklist: ${checklistErr}` };
    }

    const { data: dupClient, error: dupErr } = await supabase
      .from("clients")
      .select("first_name, last_name, shape_contact_id, shape_lead_id, phone_mobile")
      .eq("id", deleteId)
      .single();

    if (dupErr) {
      console.error("[merge] load duplicate client failed:", dupErr.message);
      return { success: false, error: dupErr.message };
    }

    if (dupClient) {
      const { data: primary } = await supabase
        .from("clients")
        .select("shape_contact_id, shape_lead_id, phone_mobile")
        .eq("id", keepId)
        .single();

      const updates: ClientMergeUpdates = {};
      if (!primary?.shape_contact_id && dupClient.shape_contact_id) {
        updates.shape_contact_id = dupClient.shape_contact_id as string;
      }
      if (!primary?.shape_lead_id && dupClient.shape_lead_id) {
        updates.shape_lead_id = dupClient.shape_lead_id as string;
      }
      if (!primary?.phone_mobile && dupClient.phone_mobile) {
        updates.phone_mobile = dupClient.phone_mobile as string;
      }

      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await supabase
          .from("clients")
          .update(updates)
          .eq("id", keepId);
        if (upErr) {
          return { success: false, error: upErr.message };
        }
      }
    }

    const mergedName = dupClient
      ? `${(dupClient.first_name as string | null) ?? ""} ${(dupClient.last_name as string | null) ?? ""}`.trim()
      : deleteId;

    const { error: auditErr } = await supabase.from("audit_log").insert({
      client_id: keepId,
      action: "clients_merged",
      new_value: {
        merged_from: deleteId,
        merged_name: mergedName,
      },
      performed_by: user.id,
      performed_by_name: performerName,
    });
    if (auditErr) {
      console.error("[merge] audit insert failed:", auditErr.message);
      return { success: false, error: auditErr.message };
    }

    const { error: delErr } = await supabase.from("clients").delete().eq("id", deleteId);
    if (delErr) {
      console.error("[merge] delete duplicate failed:", delErr.message);
      return { success: false, error: delErr.message };
    }

    console.log("[merge] success:", keepId, "<-", deleteId);

    revalidatePath("/admin/duplicate-review");
    revalidatePath("/clients");
    revalidatePath(`/clients/${keepId}`);
    return { success: true };
  } catch (err) {
    console.error("[mergeDuplicates] error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Merge failed",
    };
  }
}

export async function linkHouseholdSecondary(
  primaryId: string,
  secondaryId: string,
  secondaryName: string
): Promise<DuplicateActionResult> {
  console.log("[linkHousehold] called with:", primaryId, secondaryId);

  try {
    await verifyAdminAccess();
    const supabase = getServiceSupabase();

    const { error: commErr } = await supabase
      .from("communications")
      .update({ client_id: primaryId })
      .eq("client_id", secondaryId);
    if (commErr) {
      return { success: false, error: commErr.message };
    }

    const { error: shipErr } = await supabase
      .from("client_fedex_shipments")
      .update({
        client_id: primaryId,
        recipient_type: "secondary",
      })
      .eq("client_id", secondaryId);
    if (shipErr) {
      return { success: false, error: shipErr.message };
    }

    const nameParts = secondaryName.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length >= 2) {
      const { data: primary } = await supabase
        .from("clients")
        .select("spouse_first_name, spouse_last_name")
        .eq("id", primaryId)
        .single();

      if (!primary?.spouse_first_name) {
        const { error: spouseErr } = await supabase
          .from("clients")
          .update({
            spouse_first_name: nameParts[0],
            spouse_last_name: nameParts.slice(1).join(" "),
            spouse_name: secondaryName.trim(),
          })
          .eq("id", primaryId);
        if (spouseErr) {
          return { success: false, error: spouseErr.message };
        }
      }
    }

    const { error: delErr } = await supabase.from("clients").delete().eq("id", secondaryId);
    if (delErr) {
      return { success: false, error: delErr.message };
    }

    revalidatePath("/admin/duplicate-review");
    revalidatePath("/clients");
    revalidatePath(`/clients/${primaryId}`);
    return { success: true };
  } catch (err) {
    console.error("[linkHousehold] error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Link failed",
    };
  }
}

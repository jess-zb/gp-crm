"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canManageMids } from "@/lib/roles";
import { midSlug } from "@/lib/mids/queries";
import { deleteTemplateFile } from "@/lib/esign/template-storage";
import { toUserFacingError } from "@/lib/user-facing-error";

export type MidActionResult = { ok: boolean; error?: string; id?: string };

async function requireMidManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");
  if (!canManageMids(profile.role)) redirect("/settings");

  return { supabase, user, profile };
}

function revalidate() {
  revalidatePath("/settings/mids");
  revalidatePath("/clients/new");
}

export async function createMid(name: string): Promise<MidActionResult> {
  const { supabase, user, profile } = await requireMidManager();

  const clean = name.trim();
  if (!clean) return { ok: false, error: "Enter a MID name." };
  const slug = midSlug(clean);
  if (!slug) {
    return { ok: false, error: "Use at least one letter or number in the name." };
  }

  const { data, error } = await supabase
    .from("mids")
    .insert({ name: clean, slug, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      return { ok: false, error: `“${clean}” already exists.` };
    }
    return { ok: false, error: toUserFacingError(error.message) };
  }

  await supabase.from("audit_log").insert({
    action: "mid_created",
    new_value: { mid_id: data.id, name: clean, slug },
    performed_by: user.id,
    performed_by_name: profile.full_name?.trim() || "Staff",
  });

  revalidate();
  return { ok: true, id: data.id as string };
}

export async function renameMid(
  midId: string,
  name: string
): Promise<MidActionResult> {
  const { supabase, user, profile } = await requireMidManager();

  const clean = name.trim();
  if (!clean) return { ok: false, error: "Enter a MID name." };

  // The slug is deliberately NOT regenerated: it appears in e-sign template
  // storage paths, so renaming a MID must not orphan its uploaded PDFs.
  const { error } = await supabase
    .from("mids")
    .update({ name: clean })
    .eq("id", midId);

  if (error) {
    if (/duplicate key/i.test(error.message)) {
      return { ok: false, error: `“${clean}” already exists.` };
    }
    return { ok: false, error: toUserFacingError(error.message) };
  }

  await supabase.from("audit_log").insert({
    action: "mid_renamed",
    new_value: { mid_id: midId, name: clean },
    performed_by: user.id,
    performed_by_name: profile.full_name?.trim() || "Staff",
  });

  revalidate();
  return { ok: true };
}

export async function setMidActive(
  midId: string,
  isActive: boolean
): Promise<MidActionResult> {
  const { supabase, user, profile } = await requireMidManager();

  const { error } = await supabase
    .from("mids")
    .update({ is_active: isActive })
    .eq("id", midId);

  if (error) return { ok: false, error: toUserFacingError(error.message) };

  await supabase.from("audit_log").insert({
    action: isActive ? "mid_activated" : "mid_deactivated",
    new_value: { mid_id: midId },
    performed_by: user.id,
    performed_by_name: profile.full_name?.trim() || "Staff",
  });

  revalidate();
  return { ok: true };
}

/**
 * Only possible while nothing references the MID. Clients hold an
 * ON DELETE RESTRICT foreign key, so the database refuses otherwise — this
 * check exists to give a readable reason instead of a constraint error.
 */
export async function deleteMid(midId: string): Promise<MidActionResult> {
  const { supabase, user, profile } = await requireMidManager();

  const [{ count: clientCount }, { count: templateCount }] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("mid_id", midId),
    supabase
      .from("esign_templates")
      .select("id", { count: "exact", head: true })
      .eq("mid_id", midId),
  ]);

  if ((clientCount ?? 0) > 0) {
    return {
      ok: false,
      error: `${clientCount} client${clientCount === 1 ? "" : "s"} use this MID. Deactivate it instead.`,
    };
  }
  if ((templateCount ?? 0) > 0) {
    return {
      ok: false,
      error: `Remove this MID's ${templateCount} e-sign document${templateCount === 1 ? "" : "s"} first.`,
    };
  }

  const { error } = await supabase.from("mids").delete().eq("id", midId);
  if (error) return { ok: false, error: toUserFacingError(error.message) };

  await supabase.from("audit_log").insert({
    action: "mid_deleted",
    new_value: { mid_id: midId },
    performed_by: user.id,
    performed_by_name: profile.full_name?.trim() || "Staff",
  });

  revalidate();
  return { ok: true };
}

export async function setTemplateActive(
  templateId: string,
  isActive: boolean
): Promise<MidActionResult> {
  const { supabase, user, profile } = await requireMidManager();

  const { data: row, error: lookupErr } = await supabase
    .from("esign_templates")
    .select("id, mid_id, name")
    .eq("id", templateId)
    .maybeSingle();
  if (lookupErr || !row) return { ok: false, error: "Document not found." };

  const { error } = await supabase
    .from("esign_templates")
    .update({ is_active: isActive })
    .eq("id", templateId);
  if (error) return { ok: false, error: toUserFacingError(error.message) };

  await supabase.from("audit_log").insert({
    action: isActive ? "esign_template_activated" : "esign_template_deactivated",
    new_value: { template_id: templateId, mid_id: row.mid_id, name: row.name },
    performed_by: user.id,
    performed_by_name: profile.full_name?.trim() || "Staff",
  });

  revalidate();
  revalidatePath(`/settings/mids/${row.mid_id}`);
  return { ok: true };
}

export async function deleteTemplate(templateId: string): Promise<MidActionResult> {
  const { supabase, user, profile } = await requireMidManager();

  const { data: row } = await supabase
    .from("esign_templates")
    .select("id, mid_id, name, storage_path")
    .eq("id", templateId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Document not found." };

  const { count } = await supabase
    .from("esign_requests")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "This document has already been sent. Deactivate it instead.",
    };
  }

  const { error } = await supabase.from("esign_templates").delete().eq("id", templateId);
  if (error) return { ok: false, error: toUserFacingError(error.message) };

  await deleteTemplateFile(String(row.storage_path ?? ""));

  await supabase.from("audit_log").insert({
    action: "esign_template_deleted",
    new_value: { template_id: templateId, mid_id: row.mid_id, name: row.name },
    performed_by: user.id,
    performed_by_name: profile.full_name?.trim() || "Staff",
  });

  revalidate();
  revalidatePath(`/settings/mids/${row.mid_id}`);
  return { ok: true };
}

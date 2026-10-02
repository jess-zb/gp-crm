"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import {
  canAccessClientRecord,
  canBypassChecklist,
  canDeleteDocuments,
  canMoveClientStage,
  canReassignClient,
  isDevOrAdmin,
} from "@/lib/roles";
import {
  normalizePipelineStage,
  pipelineStageAuditAction,
} from "@/lib/clients/pipeline-status";
import { PIPELINE_STAGE_ORDER } from "@/lib/constants/stages";
import type { PipelineStageKey } from "@/lib/constants/stages";
import {
  ATTORNEY_EMAIL_NOTIFICATIONS_ENABLED,
  sendAttorneyCollectionLetterEmail,
  sendAttorneyCollectionLetterNotification,
} from "@/lib/attorney-notify";
import { runCaseSentToAttorneysTriggers } from "@/lib/clients/case-sent-triggers";
import { createWorkflowTask } from "@/lib/reminders/workflow";
import {
  advanceClientAfterPoaUpload,
  isPoaDocumentType,
  markPoaSignedOnClient,
} from "@/lib/clients/poa-upload-advance";
import { runStageEntrySideEffects } from "@/lib/reminders/stage-entry-appointments";
import { runEmailDispatch } from "@/lib/email/dispatch-for-client";
import {
  buildClientDocumentStoragePath,
  formatStorageUploadError,
  isAllowedUploadFile,
  isPermanentClientDocument,
  normalizeUploadMimeType,
  PERMANENT_DOCUMENT_DELETE_ERROR,
} from "@/lib/clients/document-upload";
import { toUserFacingError } from "@/lib/user-facing-error";

export type ClientActionResult =
  | { ok: true }
  | { ok: false; error: string };

const ESIGN_FILE_DELETE_ERROR =
  "This is a signed eSign file. Send a new copy from Packets if you need to replace it.";

async function isEsignProtectedDocument(docId: string): Promise<boolean> {
  const admin = createAdminClient();
  const [{ data: bySigned }, { data: byCert }] = await Promise.all([
    admin.from("esign_requests").select("id").eq("signed_document_id", docId).maybeSingle(),
    admin
      .from("esign_requests")
      .select("id")
      .eq("certificate_document_id", docId)
      .maybeSingle(),
  ]);
  return Boolean(bySigned || byCert);
}

const DOC_BUCKET = "client-documents";

const DOCUMENT_TYPES = new Set([
  "upload",
  "utility_bill",
  "collection_letter",
  "poa",
  "poa_signed",
  "poa_document",
  "power_of_attorney",
  "correspondence",
  "audio_recording",
  "cc_authorization",
  "screenshot",
  "other",
]);

function canAccessClient(
  role: string,
  userId: string,
  client: { assigned_to: string | null; attorney_id: string | null }
) {
  return canAccessClientRecord(role, userId, client);
}

async function requireStaffClient(clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error: profErr } = await getProfileForUser(supabase, user);
  if (profErr || !profile) {
    if (profErr) console.error("[clients/[id]/actions] profile error:", profErr);
    redirect("/login");
  }
  if (profile.role === "client" || profile.role === "attorney") {
    redirect(profile.role === "attorney" ? "/attorney/cases" : "/portal");
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, assigned_to, attorney_id, stage")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client) {
    if (error) console.error("[clients/[id]/actions] client fetch error:", error.message);
    redirect("/clients");
  }

  if (!canAccessClient(profile.role, user.id, client)) {
    redirect("/clients");
  }

  return { supabase, user, profile, client };
}

export type UpdateClientAccountInput = {
  clientId: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  verbal_password: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  spouse_name: string | null;
  spouse_nickname: string | null;
  email: string | null;
  phone_mobile: string | null;
  phone_work: string | null;
  phone_home: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

interface ClientContactPayload {
  first_name: string;
  middle_initial: string | null;
  last_name: string;
  nickname: string | null;
  verbal_password: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  spouse_name: string | null;
  spouse_nickname: string | null;
  email: string | null;
  phone_mobile: string | null;
  phone: string | null;
  phone_work: string | null;
  phone_home: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

/** Account tab: bulk save contact + identity fields (matches `clients` columns in use). */
export async function updateClient(
  input: UpdateClientAccountInput
): Promise<ClientActionResult> {
  try {
    const { supabase } = await requireStaffClient(input.clientId);

    const payload: ClientContactPayload = {
      first_name: input.first_name.trim() || "Unknown",
      middle_initial: null,
      last_name: input.last_name.trim() || "Unknown",
      nickname: input.nickname,
      verbal_password: input.verbal_password,
      spouse_first_name: input.spouse_first_name,
      spouse_last_name: input.spouse_last_name,
      spouse_name: input.spouse_name,
      spouse_nickname: input.spouse_nickname,
      email: input.email,
      phone_mobile: input.phone_mobile,
      phone: input.phone_mobile,
      phone_work: input.phone_work,
      phone_home: input.phone_home,
      street_address: input.street_address,
      city: input.city,
      state: input.state,
      zip_code: input.zip_code,
    };

    const { error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", input.clientId);

    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[clients/[id]/actions] updateClient error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

interface ClientSettingsPayload {
  stage?: PipelineStageKey;
  stage_entered_at?: string;
  assigned_to?: string | null;
  assigned_services_id?: string | null;
  attorney_id?: string | null;
}

/** Settings tab: assignments, attorney, and pipeline stage (hidden current stage). */
export async function updateClientSettings(
  formData: FormData
): Promise<ClientActionResult> {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { ok: false, error: "Missing client." };

  try {
    const { supabase, user, profile, client } = await requireStaffClient(clientId);

    const canEditStage = canMoveClientStage(profile.role);
    const oldStage = normalizePipelineStage(client.stage as string | null) as PipelineStageKey;
    const newStage = (canEditStage
      ? normalizePipelineStage(String(formData.get("stage") ?? oldStage))
      : oldStage) as PipelineStageKey;

    const payload: ClientSettingsPayload = {};

    if (canEditStage && newStage !== oldStage) {
      payload.stage = newStage;
      payload.stage_entered_at = new Date().toISOString();
    }

    if (canReassignClient(profile.role)) {
      const assignedRaw = String(formData.get("assigned_to") ?? "").trim();
      payload.assigned_to = assignedRaw === "" ? null : assignedRaw;
      const servicesRaw = String(formData.get("assigned_services_id") ?? "").trim();
      payload.assigned_services_id = servicesRaw === "" ? null : servicesRaw;
    }

    if (isDevOrAdmin(profile.role)) {
      const attorneyRaw = String(formData.get("attorney_id") ?? "").trim();
      payload.attorney_id = attorneyRaw === "" ? null : attorneyRaw;
    }

    if (Object.keys(payload).length === 0) {
      revalidatePath(`/clients/${clientId}`);
      return { ok: true };
    }

    const { error } = await supabase.from("clients").update(payload).eq("id", clientId);

    if (error) return { ok: false, error: toUserFacingError(error.message) };

    if (canEditStage && newStage !== oldStage) {
      const auditAction = pipelineStageAuditAction(oldStage, newStage);
      const performerName = profile.full_name?.trim() || user.email || "Staff";
      const { error: auditErr } = await supabase.from("audit_log").insert({
        client_id: clientId,
        action: auditAction,
        old_value: { stage: oldStage },
        new_value: { stage: newStage },
        performed_by: user.id,
        performed_by_name: performerName,
      });
      if (auditErr) {
        console.warn("[updateClientSettings] audit_log error:", auditErr.message);
      }

      const oldIdx = PIPELINE_STAGE_ORDER.indexOf(
        oldStage as (typeof PIPELINE_STAGE_ORDER)[number]
      );
      const newIdx = PIPELINE_STAGE_ORDER.indexOf(
        newStage as (typeof PIPELINE_STAGE_ORDER)[number]
      );
      const forward = oldIdx >= 0 && newIdx >= 0 && newIdx > oldIdx;

      await runStageEntrySideEffects(supabase, {
        clientId,
        oldStage,
        newStage,
        assignedTo: (client.assigned_to as string | null) ?? null,
        performerId: user.id,
        forward,
      });

      // Fire any day-0 drip emails immediately rather than waiting for
      // the hourly cron. Day-N>0 steps still ride the hourly dispatcher.
      try {
        const result = await runEmailDispatch({ clientId });
        if (result.errors > 0) {
          console.warn("[updateClientSettings] inline dispatch errors:", result);
        }
      } catch (dispatchErr) {
        console.error("[updateClientSettings] inline dispatch failed:", dispatchErr);
      }
    }

    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[clients/[id]/actions] updateClientSettings error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}


interface ClientProfilePayload {
  first_name: string;
  middle_initial: string | null;
  last_name: string;
  nickname: string | null;
  date_of_birth: string | null;
  ssn_encrypted: string | null;
  email: string | null;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  is_active: boolean;
  assigned_to?: string | null;
}

export async function saveClientProfile(
  formData: FormData
): Promise<ClientActionResult> {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { ok: false, error: "Missing client." };

  try {
    const { supabase, user, profile } = await requireStaffClient(clientId);

    const is_active = String(formData.get("is_active") ?? "true") === "true";

    const payload: ClientProfilePayload = {
      first_name:
        String(formData.get("first_name") ?? "").trim() || "Unknown",
      middle_initial:
        String(formData.get("middle_initial") ?? "").trim().slice(0, 1) || null,
      last_name: String(formData.get("last_name") ?? "").trim() || "Unknown",
      nickname: String(formData.get("nickname") ?? "").trim() || null,
      date_of_birth: String(formData.get("date_of_birth") ?? "").trim() || null,
      ssn_encrypted: String(formData.get("ssn_encrypted") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      street_address:
        String(formData.get("street_address") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      state: String(formData.get("state") ?? "").trim() || null,
      zip_code: String(formData.get("zip_code") ?? "").trim() || null,
      is_active,
    };

    if (canReassignClient(profile.role)) {
      const assignedRaw = String(formData.get("assigned_to") ?? "").trim();
      payload.assigned_to = assignedRaw === "" ? null : assignedRaw;
    }

    const { error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", clientId);

    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[clients/[id]/actions] saveClientProfile error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function createClientReminder(
  formData: FormData
): Promise<ClientActionResult> {
  const clientId = String(formData.get("clientId") ?? "");
  const description = String(formData.get("reminder_description") ?? "").trim();
  const due = String(formData.get("reminder_due_date") ?? "").trim();
  if (!clientId || !description) {
    return { ok: false, error: "Appointment details are required." };
  }

  try {
    const { supabase, user, client } = await requireStaffClient(clientId);

    const due_date = due ? new Date(`${due}T12:00:00.000Z`).toISOString() : null;

    const { error } = await createWorkflowTask(supabase, {
      client_id: clientId,
      description,
      due_date,
      assigned_to: user.id,
      created_by: user.id,
      client_stage: (client.stage as string | null) ?? null,
      workflow_source: "manual",
    });

    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[clients/[id]/actions] createClientReminder error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function bypassChecklistItem(
  formData: FormData
): Promise<ClientActionResult> {
  const checklistId = String(formData.get("checklistId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!checklistId || !clientId) {
    return { ok: false, error: "Missing required fields" };
  }

  try {
    const { supabase, profile } = await requireStaffClient(clientId);
    if (!canBypassChecklist(profile.role)) {
      return { ok: false, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from("onboarding_checklist")
      .update({
        bypassed: true,
        bypass_reason: "Bypassed from CRM",
        completed: false,
      })
      .eq("id", checklistId)
      .eq("client_id", clientId);

    if (error) {
      console.error("[bypassChecklistItem] database error:", error.message);
      return { ok: false, error: toUserFacingError(error.message) };
    }

    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[bypassChecklistItem] unexpected error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function uploadClientDocument(
  formData: FormData
): Promise<ClientActionResult> {
  try {
    const clientId = String(formData.get("clientId") ?? "");
    let document_type = String(formData.get("document_type") ?? "").trim();
    if (!document_type || !DOCUMENT_TYPES.has(document_type)) {
      return { ok: false, error: "Invalid document type" };
    }
    const is_collection_letter =
      document_type === "collection_letter" ||
      String(formData.get("is_collection_letter") ?? "") === "true";

    if (!clientId) return { ok: false, error: "Missing client ID" };

    const { supabase, user, client } = await requireStaffClient(clientId);

    const file = formData.get("file");
    if (!file || !(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Missing or empty file" };
    }

    const mime = normalizeUploadMimeType(file.name, file.type || "application/octet-stream");

    if (!isAllowedUploadFile({ type: mime, name: file.name })) {
      return {
        ok: false,
        error:
          "File type not supported. Use PDF, TXT, images, audio (MP3/WAV/M4A), video, or Word documents.",
      };
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const path = buildClientDocumentStoragePath(clientId, file.name);
    const { error: upErr } = await supabase.storage
      .from(DOC_BUCKET)
      .upload(path, buf, { contentType: mime, upsert: false });

    if (upErr) {
      console.error("[uploadClientDocument] storage error:", upErr.message);
      return { ok: false, error: formatStorageUploadError(upErr.message) };
    }

    const notesRaw = String(formData.get("notes") ?? "").trim();
    const { data: insertedDoc, error: insErr } = await supabase
      .from("documents")
      .insert({
        client_id: clientId,
        document_type,
        file_name: file.name,
        storage_path: path,
        file_size_bytes: file.size,
        mime_type: mime,
        uploaded_by: user.id,
        notes: notesRaw || null,
        is_collection_letter,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[uploadClientDocument] database error:", insErr.message);
      await supabase.storage.from(DOC_BUCKET).remove([path]);
      return { ok: false, error: toUserFacingError(insErr.message) };
    }

    if (isPoaDocumentType(document_type)) {
      await markPoaSignedOnClient(supabase, clientId);
      const fromStage = String(client.stage ?? "");
      const advanced = await advanceClientAfterPoaUpload(supabase, clientId);
      if (advanced) {
        await runStageEntrySideEffects(supabase, {
          clientId,
          oldStage: fromStage || "client_services",
          newStage: "awaiting_collection_letter",
          assignedTo: (client.assigned_to as string | null) ?? null,
          performerId: user.id,
          forward: true,
        });
      }
    }

    if (is_collection_letter) {
      try {
        const triggerResult = await runCaseSentToAttorneysTriggers({
          clientId,
          performerId: user.id,
          source: "collection_letter_upload",
        });
        const typedInsertedDoc = insertedDoc as { id: string } | null;
        if (typedInsertedDoc?.id && triggerResult.emailSent) {
          await supabase
            .from("documents")
            .update({
              attorney_notified_at: new Date().toISOString(),
              attorney_notify_error: null,
            })
            .eq("id", typedInsertedDoc.id)
            .eq("client_id", clientId);
        }
      } catch (err: unknown) {
        console.warn(
          "[uploadClientDocument] case_sent triggers error:",
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[uploadClientDocument] unexpected error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function deleteClientDocument(
  formData: FormData
): Promise<ClientActionResult> {
  const docId = String(formData.get("documentId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!docId || !clientId) {
    return { ok: false, error: "Missing required IDs" };
  }

  try {
    const { supabase, profile } = await requireStaffClient(clientId);
    if (!canDeleteDocuments(profile.role)) {
      return { ok: false, error: "Unauthorized" };
    }

    const { data: doc, error: fetchErr } = await supabase
      .from("documents")
      .select("storage_path, document_type, is_collection_letter")
      .eq("id", docId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[deleteClientDocument] fetch error:", fetchErr.message);
      return { ok: false, error: toUserFacingError(fetchErr.message) };
    }

    if (!doc?.storage_path) {
      return { ok: false, error: "Document not found" };
    }

    if (isPermanentClientDocument(doc)) {
      return { ok: false, error: PERMANENT_DOCUMENT_DELETE_ERROR };
    }

    if (await isEsignProtectedDocument(docId)) {
      return { ok: false, error: ESIGN_FILE_DELETE_ERROR };
    }

    const { error: remErr } = await supabase.storage
      .from(DOC_BUCKET)
      .remove([doc.storage_path]);
    if (remErr) {
      console.error("[deleteClientDocument] storage remove error:", remErr.message);
    }

    const { error: delErr } = await supabase
      .from("documents")
      .delete()
      .eq("id", docId)
      .eq("client_id", clientId);

    if (delErr) {
      console.error("[deleteClientDocument] database error:", delErr.message);
      return { ok: false, error: toUserFacingError(delErr.message) };
    }

    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[deleteClientDocument] unexpected error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function deleteClientCommunication(
  clientId: string,
  commId: string
): Promise<ClientActionResult> {
  if (!clientId || !commId) return { ok: false, error: "Missing required IDs" };
  try {
    const { supabase, profile } = await requireStaffClient(clientId);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? "";
    const { data: comm, error: fetchErr } = await supabase
      .from("communications")
      .select("recorded_by")
      .eq("id", commId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (fetchErr || !comm) return { ok: false, error: "Communication not found" };
    if (comm.recorded_by !== userId && !isDevOrAdmin(profile.role)) {
      return { ok: false, error: "Unauthorized" };
    }
    const { error } = await supabase
      .from("communications")
      .delete()
      .eq("id", commId)
      .eq("client_id", clientId);
    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[deleteClientCommunication] error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function editClientCommunication(
  clientId: string,
  commId: string,
  body: string
): Promise<ClientActionResult> {
  if (!clientId || !commId) return { ok: false, error: "Missing required IDs" };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Note cannot be empty" };
  try {
    const { supabase, profile } = await requireStaffClient(clientId);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? "";
    const { data: comm, error: fetchErr } = await supabase
      .from("communications")
      .select("recorded_by")
      .eq("id", commId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (fetchErr || !comm) return { ok: false, error: "Communication not found" };
    if (comm.recorded_by !== userId && !isDevOrAdmin(profile.role)) {
      return { ok: false, error: "Unauthorized" };
    }
    const { error } = await supabase
      .from("communications")
      .update({ body: trimmed })
      .eq("id", commId)
      .eq("client_id", clientId);
    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[editClientCommunication] error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function deleteOwnClientDocument(
  clientId: string,
  docId: string
): Promise<ClientActionResult> {
  if (!clientId || !docId) return { ok: false, error: "Missing required IDs" };
  try {
    const { supabase, profile } = await requireStaffClient(clientId);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? "";
    const { data: doc, error: fetchErr } = await supabase
      .from("documents")
      .select("storage_path, uploaded_by, document_type, is_collection_letter")
      .eq("id", docId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (fetchErr || !doc) return { ok: false, error: "Document not found" };
    if (doc.uploaded_by !== userId && !canDeleteDocuments(profile.role)) {
      return { ok: false, error: "Unauthorized" };
    }
    if (isPermanentClientDocument(doc)) {
      return { ok: false, error: PERMANENT_DOCUMENT_DELETE_ERROR };
    }
    if (await isEsignProtectedDocument(docId)) {
      return { ok: false, error: ESIGN_FILE_DELETE_ERROR };
    }
    if (doc.storage_path) {
      const { error: stErr } = await supabase.storage.from(DOC_BUCKET).remove([doc.storage_path]);
      if (stErr) console.warn("[deleteOwnClientDocument] storage remove:", stErr.message);
    }
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", docId)
      .eq("client_id", clientId);
    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[deleteOwnClientDocument] error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function editClientDocumentNotes(
  clientId: string,
  docId: string,
  notes: string
): Promise<ClientActionResult> {
  if (!clientId || !docId) return { ok: false, error: "Missing required IDs" };
  try {
    const { supabase, profile } = await requireStaffClient(clientId);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? "";
    const { data: doc, error: fetchErr } = await supabase
      .from("documents")
      .select("uploaded_by")
      .eq("id", docId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (fetchErr || !doc) return { ok: false, error: "Document not found" };
    if (doc.uploaded_by !== userId && !canDeleteDocuments(profile.role)) {
      return { ok: false, error: "Unauthorized" };
    }
    const { error } = await supabase
      .from("documents")
      .update({ notes: notes.trim() || null })
      .eq("id", docId)
      .eq("client_id", clientId);
    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[editClientDocumentNotes] error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function addClientCard(
  formData: FormData
): Promise<ClientActionResult> {
  const clientId = String(formData.get("clientId") ?? "");
  const creditor_name = String(formData.get("creditor_name") ?? "").trim();
  const card_type = String(formData.get("card_type") ?? "other");
  const last_four = String(formData.get("last_four") ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);

  if (!clientId || !creditor_name || last_four.length !== 4) {
    return {
      ok: false,
      error: "Creditor name and exactly four digits are required.",
    };
  }

  const allowedCard = new Set([
    "visa",
    "mastercard",
    "amex",
    "discover",
    "other",
  ]);
  const ct = allowedCard.has(card_type) ? card_type : "other";

  try {
    const { supabase, user } = await requireStaffClient(clientId);

    const { error } = await supabase.from("client_cards").insert({
      client_id: clientId,
      creditor_name,
      card_type: ct,
      last_four,
      added_by: user.id,
    });

    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[addClientCard] unexpected error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function retryAttorneyDocumentNotification(
  formData: FormData
): Promise<ClientActionResult> {
  const documentId = String(formData.get("documentId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!documentId || !clientId) {
    return { ok: false, error: "Missing document or client." };
  }

  if (!ATTORNEY_EMAIL_NOTIFICATIONS_ENABLED) {
    return {
      ok: false,
      error:
        "Attorney email notifications are disabled. Cases will be sent via the attorney batch queue.",
    };
  }

  try {
    const { supabase } = await requireStaffClient(clientId);

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, document_type, client_id")
      .eq("id", documentId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (docErr || !doc || doc.document_type !== "collection_letter") {
      if (docErr) console.error("[retryAttorneyDocumentNotification] doc fetch error:", docErr.message);
      return { ok: false, error: "Document not found or not a collection letter." };
    }

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("attorney_id, first_name, last_name")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr) {
      console.error("[retryAttorneyDocumentNotification] client fetch error:", clientErr.message);
      return { ok: false, error: "Failed to fetch client details." };
    }

    let result: { ok: true } | { ok: false; error: string };

    if (clientRow?.attorney_id) {
      const { data: attorney, error: attyErr } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", clientRow.attorney_id as string)
        .maybeSingle();

      if (attyErr) {
        console.error("[retryAttorneyDocumentNotification] attorney fetch error:", attyErr.message);
        return { ok: false, error: "Failed to fetch attorney details." };
      }

      const attorneyEmail = (attorney?.email as string | null)?.trim();
      if (attorneyEmail) {
        const mail = await sendAttorneyCollectionLetterEmail({
          clientId,
          clientFirstName: (clientRow.first_name as string | null) ?? "",
          clientLastName: (clientRow.last_name as string | null) ?? "",
          attorneyEmail,
        });
        result = mail.ok ? { ok: true } : { ok: false, error: mail.error };
      } else {
        result = { ok: false, error: "Assigned attorney has no email." };
      }
    } else {
      result = await sendAttorneyCollectionLetterNotification({
        documentId,
        clientId,
      });
    }

    if ("ok" in result && result.ok) {
      const { error: upErr } = await supabase
        .from("documents")
        .update({
          attorney_notified_at: new Date().toISOString(),
          attorney_notify_error: null,
        })
        .eq("id", documentId)
        .eq("client_id", clientId);
      if (upErr) return { ok: false, error: toUserFacingError(upErr.message) };
      revalidatePath(`/clients/${clientId}`);
      return { ok: true };
    }

    const errorMsg = ("error" in result && result.error) ? result.error : "Unknown error";
    const { error: upErr } = await supabase
      .from("documents")
      .update({ attorney_notify_error: errorMsg })
      .eq("id", documentId)
      .eq("client_id", clientId);
    if (upErr) return { ok: false, error: toUserFacingError(upErr.message) };
    revalidatePath(`/clients/${clientId}`);
    return { ok: false, error: errorMsg };
  } catch (err) {
    console.error("[retryAttorneyDocumentNotification] unexpected error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

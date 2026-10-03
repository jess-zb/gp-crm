import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessClientRecord } from "@/lib/roles";
import { canManageEsignTemplates, canUseEsignStaffUi, isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadTemplatesForClient } from "@/lib/esign/templates";
import { hasPdfMagicBytes } from "@/lib/clients/document-upload";
import { loadMidById } from "@/lib/mids/queries";
import {
  defaultRequiredBinds,
  documentTypeForBehavior,
  isEsignBehavior,
} from "@/lib/esign/types";
import {
  ESIGN_TEMPLATE_BUCKET,
  ESIGN_TEMPLATE_MAX_BYTES,
  deleteTemplateFile,
  isIncomingTemplatePath,
  promoteIncomingTemplate,
  templateStoragePath,
} from "@/lib/esign/template-storage";

/**
 * The e-sign documents a client may be sent: exactly the ones owned by their
 * MID. This is what makes the client-profile card list data-driven — adding a
 * MID and its documents needs no code change.
 */
export async function GET(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canUseEsignStaffUi(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = new URL(request.url).searchParams.get("clientId")?.trim() ?? "";
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, assigned_to, attorney_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!canAccessClientRecord(profile.role, user.id, client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { midName, templates } = await loadTemplatesForClient(supabase, clientId);
  return NextResponse.json({ ok: true, midName, templates });
}

/**
 * Turn a staged PDF into a document owned by a MID. This is the no-code path:
 * name, behaviour, file. Field placement happens afterwards in the editor.
 */
export async function POST(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canManageEsignTemplates(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    midId?: string;
    name?: string;
    behavior?: string;
    hint?: string;
    path?: string;
    uploadToken?: string;
    fileSize?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const midId = String(body.midId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const behavior = String(body.behavior ?? "").trim();
  const hint = String(body.hint ?? "").trim();
  const path = String(body.path ?? "").trim();
  const uploadToken = String(body.uploadToken ?? "").trim();
  const fileSize = Number(body.fileSize ?? 0);

  if (!midId || !name) {
    return NextResponse.json({ error: "Enter a document name." }, { status: 400 });
  }
  if (!isEsignBehavior(behavior)) {
    return NextResponse.json({ error: "Choose what this document does." }, { status: 400 });
  }
  if (!uploadToken || !isIncomingTemplatePath(user.id, uploadToken, path)) {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!fileSize || fileSize > ESIGN_TEMPLATE_MAX_BYTES) {
    return NextResponse.json({ error: "PDF must be 8 MB or smaller." }, { status: 413 });
  }

  const mid = await loadMidById(supabase, midId);
  if (!mid) return NextResponse.json({ error: "MID not found." }, { status: 404 });

  const admin = createAdminClient();
  const bucket = admin.storage.from(ESIGN_TEMPLATE_BUCKET);
  const { data, error } = await bucket.download(path);
  if (error || !data) {
    return NextResponse.json({ error: "Uploaded file was not found." }, { status: 400 });
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length > ESIGN_TEMPLATE_MAX_BYTES || !hasPdfMagicBytes(bytes)) {
    await bucket.remove([path]);
    return NextResponse.json({ error: "That file is not a PDF." }, { status: 400 });
  }

  let pageCount: number | null = null;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = doc.getPageCount();
  } catch {
    await bucket.remove([path]);
    return NextResponse.json({ error: "That PDF could not be read." }, { status: 400 });
  }

  const templateId = crypto.randomUUID();
  const storagePath = templateStoragePath(mid.slug, templateId);
  const moved = await promoteIncomingTemplate(path, storagePath);
  if (!moved.ok) {
    return NextResponse.json({ error: moved.error || "Could not store the PDF." }, { status: 500 });
  }

  const { error: insertErr } = await supabase.from("esign_templates").insert({
    id: templateId,
    mid_id: midId,
    name,
    hint: hint || null,
    behavior,
    document_type: documentTypeForBehavior(behavior),
    storage_path: storagePath,
    page_count: pageCount,
    fields: [],
    required_binds: defaultRequiredBinds(behavior),
    created_by: user.id,
  });

  if (insertErr) {
    await deleteTemplateFile(storagePath);
    if (insertErr.code === "23505" || /duplicate key/i.test(insertErr.message)) {
      return NextResponse.json(
        { error: `${mid.name} already has a document named “${name}”.` },
        { status: 400 }
      );
    }
    console.error("[esign templates] insert", insertErr.message);
    return NextResponse.json({ error: "Could not save the document." }, { status: 500 });
  }

  await admin.from("audit_log").insert({
    action: "esign_template_created",
    new_value: { template_id: templateId, mid_id: midId, name, behavior },
    performed_by: user.id,
    performed_by_name: profile.full_name?.trim() || "Staff",
  });

  return NextResponse.json({ ok: true, templateId });
}

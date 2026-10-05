import type { SupabaseClient } from "@supabase/supabase-js";
import { buildClientDocumentStoragePath } from "@/lib/clients/document-upload";
import {
  parsePartnerExport,
  partnerExportFileName,
  type PartnerExport,
} from "@/lib/leads/parse-partner-export";
import type { InboundLeadFields } from "@/lib/leads/parse-inbound-lead";

const BUCKET = "client-documents";

export type SavePartnerExportResult =
  | {
      ok: true;
      status: 201;
      body: {
        ok: true;
        created: true;
        id: string;
        document_id: string;
      };
    }
  | {
      ok: false;
      status: number;
      body: { ok: false; error: string; fields?: InboundLeadFields };
    };

async function removeExport(admin: SupabaseClient, clientId: string, storagePath: string | null) {
  if (storagePath) {
    await admin.storage.from(BUCKET).remove([storagePath]);
  }
  await admin.from("audit_log").delete().eq("client_id", clientId);
  await admin.from("clients").delete().eq("id", clientId);
}

async function storeExportFile(
  admin: SupabaseClient,
  clientId: string,
  lead: PartnerExport,
  text: string,
  fileName: string | null
): Promise<{ documentId: string; storagePath: string } | { error: string }> {
  const name = partnerExportFileName(lead.first_name, lead.last_name, fileName);
  const storagePath = buildClientDocumentStoragePath(clientId, name);
  const bytes = Buffer.from(text, "utf8");
  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "text/plain",
    upsert: false,
  });
  if (uploadErr) return { error: uploadErr.message };

  const { data, error } = await admin
    .from("documents")
    .insert({
      client_id: clientId,
      document_type: "upload",
      file_name: name,
      storage_path: storagePath,
      file_size_bytes: bytes.length,
      mime_type: "text/plain",
      notes: "Partner export",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { error: error?.message ?? "Could not save the document." };
  }
  return { documentId: data.id as string, storagePath };
}

/**
 * Every file becomes a new Lead. A repeated name or phone is another lead,
 * not an update. The original text is filed under Documents as Enrolled Cards.
 * Does not start the welcome email sequence.
 */
export async function savePartnerExport(
  admin: SupabaseClient,
  args: { text: string; fileName?: string | null; source?: string | null }
): Promise<SavePartnerExportResult> {
  if (args.text.includes("\0")) {
    return { ok: false, status: 400, body: { ok: false, error: "Request body must be a text file." } };
  }

  const parsed = parsePartnerExport(args.text, args.source);
  if (!parsed.ok) {
    return { ok: false, status: 400, body: { ok: false, error: "Invalid lead.", fields: parsed.fields } };
  }
  const lead = parsed.lead;

  const { data: created, error: insertErr } = await admin
    .from("clients")
    .insert({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      phone_mobile: lead.phone,
      phone_home: lead.phone_home,
      street_address: lead.street_address,
      city: lead.city,
      state: lead.state,
      zip_code: lead.zip_code,
      referred_by: lead.source,
      stage: "lead",
      is_active: true,
    })
    .select("id")
    .single();

  if (insertErr || !created?.id) {
    console.error("[api/leads] insert:", insertErr?.message ?? "missing id");
    return { ok: false, status: 500, body: { ok: false, error: "Could not save the lead." } };
  }
  const clientId = created.id as string;

  const { error: welcomeErr } = await admin
    .from("sequence_enrollments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      next_send_at: null,
      cancel_reason: "partner_import",
    })
    .eq("client_id", clientId)
    .eq("sequence_key", "welcome_lead")
    .eq("status", "active");
  if (welcomeErr) console.error("[api/leads] welcome cancel:", welcomeErr.message);

  const stored = await storeExportFile(admin, clientId, lead, args.text, args.fileName ?? null);
  if ("error" in stored) {
    console.error("[api/leads] document:", stored.error);
    await removeExport(admin, clientId, null);
    return { ok: false, status: 500, body: { ok: false, error: "Could not save the lead." } };
  }

  const fileName = partnerExportFileName(lead.first_name, lead.last_name, args.fileName ?? null);
  const { error: noteErr } = await admin.from("communications").insert({
    client_id: clientId,
    type: "note",
    direction: "internal",
    body: `Enrolled cards file received: ${fileName}`,
    sent_at: new Date().toISOString(),
  });
  if (noteErr) console.error("[api/leads] note:", noteErr.message);

  const { error: auditErr } = await admin.from("audit_log").insert({
    client_id: clientId,
    action: "inbound_lead",
    new_value: { source: lead.source, file_name: fileName },
    performed_by_name: "Partner API",
  });
  if (auditErr) console.error("[api/leads] audit:", auditErr.message);

  return {
    ok: true,
    status: 201,
    body: {
      ok: true,
      created: true,
      id: clientId,
      document_id: stored.documentId,
    },
  };
}

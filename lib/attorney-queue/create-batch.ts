import type { SupabaseClient } from "@supabase/supabase-js";
import { enrollClientInEmailSequence } from "@/lib/email/sequence-enrollment";
import {
  ATTORNEY_BATCH_DEFAULT_EXPIRY_DAYS,
  attorneyBatchPublicUrl,
  isAttorneyBatchEligibleDocument,
} from "@/lib/attorney-queue/tokens";
import { generateAttorneyBatchToken } from "@/lib/attorney-queue/generate-token";
import { createServiceClient } from "@/lib/supabase/server";

export type CreateAttorneyBatchSelection = {
  clientId: string;
  documentIds: string[];
};

export type CreateAttorneyBatchResult =
  | {
      ok: true;
      batchId: string;
      accessToken: string;
      publicUrl: string;
      expiresAt: string;
      clientCount: number;
      documentCount: number;
    }
  | { ok: false; error: string };

function addDaysIso(from: Date, days: number): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Creates an attorney handoff batch, enrolls case_referred for each client,
 * and notifies assigned attorneys in-app with the public download link.
 */
export async function createAttorneyBatch(args: {
  supabase: SupabaseClient;
  createdBy: string;
  selections: CreateAttorneyBatchSelection[];
  note?: string | null;
}): Promise<CreateAttorneyBatchResult> {
  const selections = args.selections
    .map((s) => ({
      clientId: s.clientId.trim(),
      documentIds: Array.from(
        new Set(s.documentIds.map((id) => id.trim()).filter(Boolean))
      ),
    }))
    .filter((s) => s.clientId && s.documentIds.length > 0);

  if (selections.length === 0) {
    return { ok: false, error: "Select at least one client with files." };
  }

  const clientIds = selections.map((s) => s.clientId);
  const allDocIds = Array.from(
    new Set(selections.flatMap((s) => s.documentIds))
  );

  const { data: clients, error: clientErr } = await args.supabase
    .from("clients")
    .select("id, stage, attorney_id, first_name, last_name")
    .in("id", clientIds);

  if (clientErr) {
    return { ok: false, error: clientErr.message };
  }

  const clientById = new Map((clients ?? []).map((c) => [c.id as string, c]));
  for (const id of clientIds) {
    const row = clientById.get(id);
    if (!row) return { ok: false, error: `Client not found: ${id}` };
    if (row.stage !== "case_sent_to_attorneys") {
      return {
        ok: false,
        error: "Only clients in Case Sent to Attorneys can be batched.",
      };
    }
  }

  const { data: alreadyBatched } = await args.supabase
    .from("attorney_batch_clients")
    .select("client_id, attorney_batches!inner(revoked_at)")
    .in("client_id", clientIds)
    .is("attorney_batches.revoked_at", null);

  if ((alreadyBatched ?? []).length > 0) {
    return {
      ok: false,
      error: "One or more selected clients are already in an active batch.",
    };
  }

  const { data: docs, error: docErr } = await args.supabase
    .from("documents")
    .select("id, client_id, document_type, is_collection_letter, file_name")
    .in("id", allDocIds)
    .is("archived_at", null);

  if (docErr) {
    return { ok: false, error: docErr.message };
  }

  const docById = new Map((docs ?? []).map((d) => [d.id as string, d]));
  for (const sel of selections) {
    for (const docId of sel.documentIds) {
      const doc = docById.get(docId);
      if (!doc) return { ok: false, error: `Document not found: ${docId}` };
      if (doc.client_id !== sel.clientId) {
        return { ok: false, error: "Document does not belong to selected client." };
      }
      if (
        !isAttorneyBatchEligibleDocument({
          document_type: doc.document_type as string | null,
          is_collection_letter: doc.is_collection_letter as boolean | null,
        })
      ) {
        return {
          ok: false,
          error: `Document is not a POA or collection letter: ${doc.file_name ?? docId}`,
        };
      }
    }
  }

  const now = new Date();
  const accessToken = generateAttorneyBatchToken();
  const expiresAt = addDaysIso(now, ATTORNEY_BATCH_DEFAULT_EXPIRY_DAYS);

  const { data: batch, error: batchErr } = await args.supabase
    .from("attorney_batches")
    .insert({
      access_token: accessToken,
      note: args.note?.trim() || null,
      created_by: args.createdBy,
      sent_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (batchErr || !batch) {
    return { ok: false, error: batchErr?.message ?? "Failed to create batch." };
  }

  const batchId = batch.id as string;

  const { error: clientInsErr } = await args.supabase
    .from("attorney_batch_clients")
    .insert(
      clientIds.map((clientId) => ({
        batch_id: batchId,
        client_id: clientId,
      }))
    );

  if (clientInsErr) {
    await args.supabase.from("attorney_batches").delete().eq("id", batchId);
    return { ok: false, error: clientInsErr.message };
  }

  const docRows = selections.flatMap((sel) =>
    sel.documentIds.map((documentId) => ({
      batch_id: batchId,
      client_id: sel.clientId,
      document_id: documentId,
    }))
  );

  const { error: docInsErr } = await args.supabase
    .from("attorney_batch_documents")
    .insert(docRows);

  if (docInsErr) {
    await args.supabase.from("attorney_batches").delete().eq("id", batchId);
    return { ok: false, error: docInsErr.message };
  }

  // Service role for sequence enrollment + notifications (consistent with stage triggers).
  const service = createServiceClient();
  const publicUrl = attorneyBatchPublicUrl(accessToken);
  const notifiedAttorneyIds = new Set<string>();

  for (const clientId of clientIds) {
    const enroll = await enrollClientInEmailSequence(service, {
      clientId,
      sequenceKey: "case_referred",
    });
    if (!enroll.ok && enroll.reason !== "already_enrolled") {
      console.warn(
        "[attorney-queue] case_referred enroll:",
        clientId,
        enroll.reason
      );
    }

    const client = clientById.get(clientId);
    const attorneyId = (client?.attorney_id as string | null) ?? null;
    if (attorneyId && !notifiedAttorneyIds.has(attorneyId)) {
      notifiedAttorneyIds.add(attorneyId);
      const clientName =
        `${(client?.first_name as string | null) ?? ""} ${(client?.last_name as string | null) ?? ""}`.trim() ||
        "Client";
      const { error: notifErr } = await service.from("notifications").insert({
        user_id: attorneyId,
        type: "attorney_batch",
        title: "New attorney file batch",
        body: `A batch including ${clientName}${clientIds.length > 1 ? ` and ${clientIds.length - 1} other case(s)` : ""} is ready. Download files via the shared link.`,
        client_id: clientId,
        client_name: clientName,
        read: false,
        action_url: publicUrl,
      });
      if (notifErr) {
        console.warn("[attorney-queue] attorney notification:", notifErr.message);
      }
    }

    const { error: docStampErr } = await service
      .from("documents")
      .update({
        attorney_notified_at: now.toISOString(),
        attorney_notify_error: null,
      })
      .in(
        "id",
        selections.find((s) => s.clientId === clientId)?.documentIds ?? []
      )
      .eq("client_id", clientId);

    if (docStampErr) {
      console.warn("[attorney-queue] stamp attorney_notified_at:", docStampErr.message);
    }
  }

  return {
    ok: true,
    batchId,
    accessToken,
    publicUrl,
    expiresAt,
    clientCount: clientIds.length,
    documentCount: docRows.length,
  };
}

export async function revokeAttorneyBatch(args: {
  supabase: SupabaseClient;
  batchId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await args.supabase
    .from("attorney_batches")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", args.batchId)
    .is("revoked_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

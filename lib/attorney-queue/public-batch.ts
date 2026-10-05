import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attorneyBatchDocKind,
  isAttorneyBatchToken,
} from "@/lib/attorney-queue/tokens";
import { CLIENT_DOCUMENTS_BUCKET } from "@/lib/clients/document-storage";

export type PublicBatchDocument = {
  id: string;
  client_id: string;
  file_name: string;
  document_type: string | null;
  kind: "poa" | "collection_letter" | "other";
  mime_type: string | null;
};

export type PublicBatchClient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  documents: PublicBatchDocument[];
};

export type PublicAttorneyBatch = {
  id: string;
  sent_at: string;
  expires_at: string;
  note: string | null;
  clients: PublicBatchClient[];
};

export async function loadPublicAttorneyBatch(
  supabase: SupabaseClient,
  token: string
): Promise<
  | { ok: true; batch: PublicAttorneyBatch }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "error"; message?: string }
> {
  if (!isAttorneyBatchToken(token)) {
    return { ok: false, reason: "invalid" };
  }

  const { data: batch, error } = await supabase
    .from("attorney_batches")
    .select("id, sent_at, expires_at, revoked_at, note")
    .eq("access_token", token.toLowerCase())
    .maybeSingle();

  if (error) {
    return { ok: false, reason: "error", message: error.message };
  }
  if (!batch) return { ok: false, reason: "invalid" };
  if (batch.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(batch.expires_at as string).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const batchId = batch.id as string;

  const { data: clientLinks, error: clientErr } = await supabase
    .from("attorney_batch_clients")
    .select("client_id")
    .eq("batch_id", batchId);

  if (clientErr) {
    return { ok: false, reason: "error", message: clientErr.message };
  }

  const clientIds = (clientLinks ?? []).map((r) => r.client_id as string);
  if (clientIds.length === 0) {
    return {
      ok: true,
      batch: {
        id: batchId,
        sent_at: batch.sent_at as string,
        expires_at: batch.expires_at as string,
        note: (batch.note as string | null) ?? null,
        clients: [],
      },
    };
  }

  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .in("id", clientIds);

  if (clientsErr) {
    return { ok: false, reason: "error", message: clientsErr.message };
  }

  const { data: docLinks, error: docLinkErr } = await supabase
    .from("attorney_batch_documents")
    .select("document_id, client_id")
    .eq("batch_id", batchId);

  if (docLinkErr) {
    return { ok: false, reason: "error", message: docLinkErr.message };
  }

  const documentIds = (docLinks ?? []).map((r) => r.document_id as string);
  const docsById = new Map<
    string,
    {
      id: string;
      client_id: string;
      file_name: string;
      document_type: string | null;
      is_collection_letter: boolean | null;
      mime_type: string | null;
    }
  >();

  if (documentIds.length > 0) {
    const { data: docs, error: docsErr } = await supabase
      .from("documents")
      .select(
        "id, client_id, file_name, document_type, is_collection_letter, mime_type"
      )
      .in("id", documentIds)
      .is("archived_at", null);

    if (docsErr) {
      return { ok: false, reason: "error", message: docsErr.message };
    }

    for (const d of docs ?? []) {
      docsById.set(d.id as string, {
        id: d.id as string,
        client_id: d.client_id as string,
        file_name: (d.file_name as string) || "file",
        document_type: (d.document_type as string | null) ?? null,
        is_collection_letter: (d.is_collection_letter as boolean | null) ?? null,
        mime_type: (d.mime_type as string | null) ?? null,
      });
    }
  }

  const docsByClient = new Map<string, PublicBatchDocument[]>();
  for (const link of docLinks ?? []) {
    const doc = docsById.get(link.document_id as string);
    if (!doc) continue;
    const list = docsByClient.get(doc.client_id) ?? [];
    list.push({
      id: doc.id,
      client_id: doc.client_id,
      file_name: doc.file_name,
      document_type: doc.document_type,
      kind: attorneyBatchDocKind({
        document_type: doc.document_type,
        is_collection_letter: doc.is_collection_letter,
      }),
      mime_type: doc.mime_type,
    });
    docsByClient.set(doc.client_id, list);
  }

  const clientOrder = new Map(clientIds.map((id, i) => [id, i]));
  const publicClients: PublicBatchClient[] = (clients ?? [])
    .map((c) => {
      const id = c.id as string;
      return {
        id,
        first_name: (c.first_name as string | null) ?? null,
        last_name: (c.last_name as string | null) ?? null,
        documents: docsByClient.get(id) ?? [],
      };
    })
    .sort(
      (a, b) => (clientOrder.get(a.id) ?? 0) - (clientOrder.get(b.id) ?? 0)
    );

  return {
    ok: true,
    batch: {
      id: batchId,
      sent_at: batch.sent_at as string,
      expires_at: batch.expires_at as string,
      note: (batch.note as string | null) ?? null,
      clients: publicClients,
    },
  };
}

export async function createPublicBatchDocumentSignedUrl(
  supabase: SupabaseClient,
  args: { token: string; documentId: string }
): Promise<
  | { ok: true; url: string; fileName: string }
  | { ok: false; status: number; error: string }
> {
  const loaded = await loadPublicAttorneyBatch(supabase, args.token);
  if (!loaded.ok) {
    const status =
      loaded.reason === "expired" || loaded.reason === "revoked" ? 410 : 404;
    return {
      ok: false,
      status,
      error:
        loaded.reason === "expired"
          ? "This download link has expired."
          : loaded.reason === "revoked"
            ? "This download link was revoked."
            : "Invalid download link.",
    };
  }

  const inBatch = loaded.batch.clients.some((c) =>
    c.documents.some((d) => d.id === args.documentId)
  );
  if (!inBatch) {
    return { ok: false, status: 404, error: "Document not in this batch." };
  }

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("file_name, storage_path")
    .eq("id", args.documentId)
    .is("archived_at", null)
    .maybeSingle();

  if (docErr || !doc?.storage_path) {
    return { ok: false, status: 404, error: "Document not found." };
  }

  // 1 hour — long enough for slow downloads; route must send Cache-Control: no-store
  // so CDNs never reuse an expired Location header.
  const { data: signed, error: signErr } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path as string, 60 * 60);

  if (signErr || !signed?.signedUrl) {
    return {
      ok: false,
      status: 500,
      error: signErr?.message ?? "Could not create download URL.",
    };
  }

  return {
    ok: true,
    url: signed.signedUrl,
    fileName: (doc.file_name as string) || "file",
  };
}

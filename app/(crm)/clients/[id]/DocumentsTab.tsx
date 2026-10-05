"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { File, FileImage, FileText, Loader2, Mic, Pencil, Video, X } from "lucide-react";
import { deleteOwnClientDocument, editClientDocumentNotes } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { uploadClientDocument } from "@/lib/clients/documents-upload-client";
import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import { DocPreviewModal } from "@/app/components/DocPreviewModal";
import { useToast } from "@/app/components/Toast";
import { createClientDocumentSignedUrl } from "@/lib/clients/document-storage";
import { downloadClientDocument } from "@/lib/clients/document-download";
import {
  DOCUMENT_TYPE_OPTIONS,
  documentTypeLabel,
  isPermanentClientDocument,
} from "@/lib/clients/document-upload";
import { isPoaDocumentType } from "@/lib/clients/poa-upload-advance";
import { emitClientProfilePatch } from "@/lib/clients/client-profile-patch";
import { toUserFacingError } from "@/lib/user-facing-error";

const BUCKET = "client-documents";

export { DOCUMENT_TYPE_OPTIONS };

/** Upload modal options (same as stored document types for new uploads). */
export const DOCUMENT_TAB_TYPE_OPTIONS = DOCUMENT_TYPE_OPTIONS;

export type DocumentListItem = {
  id: string;
  file_name: string;
  mime_type: string | null;
  document_type: string;
  created_at: string | null;
  uploaded_by: string | null;
  file_size_bytes: number | null;
  storage_path: string;
  notes: string | null;
  is_collection_letter?: boolean | null;
};

function getFileIcon(mimeType: string | null, fileName: string) {
  const m = (mimeType ?? "").toLowerCase();
  const n = fileName ?? "";
  if (m.includes("pdf") || /\.pdf$/i.test(n)) {
    return <FileText className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />;
  }
  if (m.includes("image") || /\.(jpe?g|png|gif|webp|svg)$/i.test(n)) {
    return <FileImage className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />;
  }
  if (m.includes("audio") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(n)) {
    return <Mic className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />;
  }
  if (m.includes("video") || /\.(mp4|webm|mov|mkv)$/i.test(n)) {
    return <Video className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />;
  }
  return <File className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />;
}

function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${i > 0 ? n.toFixed(1) : n} ${u[i]}`;
}

function labelForType(value: string) {
  if (value === "__uncategorized__") return "Uncategorized";
  return documentTypeLabel(value);
}

export function DocumentsTab({
  clientId,
  initialDocuments,
  uploaderNames,
  canDeleteDocs,
  currentUserId,
  openUploadType = null,
}: {
  clientId: string;
  initialDocuments: DocumentListItem[];
  uploaderNames: Record<string, string>;
  canDeleteDocs: boolean;
  currentUserId: string;
  /** Open the upload modal with this document type already selected. */
  openUploadType?: "cc_authorization" | "poa_document" | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState("");
  const [editNotesSaving, setEditNotesSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
  } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const [docType, setDocType] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [documents, setDocuments] = useState<DocumentListItem[]>(initialDocuments);
  const [loadError, setLoadError] = useState<string | null>(null);
  const openedUploadFromQuery = useRef(false);

  const fetchDocuments = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("documents")
      .select(
        `
        id,
        file_name,
        mime_type,
        document_type,
        created_at,
        uploaded_by,
        file_size_bytes,
        storage_path,
        notes,
        is_collection_letter
      `
      )
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Documents fetch error:", error);
      setLoadError(error.message);
      return;
    }

    setLoadError(null);
    setDocuments((data ?? []) as DocumentListItem[]);
  }, [clientId]);

  useEffect(() => {
    if (initialDocuments.length > 0) setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const grouped = useMemo(() => {
    const order = DOCUMENT_TAB_TYPE_OPTIONS.map((o) => o.value);
    const map = new Map<string, DocumentListItem[]>();
    for (const d of documents) {
      const raw = d.document_type?.trim();
      const k =
        d.is_collection_letter === true || raw === "collection_letter"
          ? "collection_letter"
          : raw || "__uncategorized__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    const sortItems = (items: DocumentListItem[]) =>
      [...items].sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      );
    const out: { type: string; label: string; items: DocumentListItem[] }[] = [];
    for (const type of order) {
      const items = map.get(type);
      if (items?.length) {
        out.push({
          type,
          label: labelForType(type),
          items: sortItems(items),
        });
      }
    }
    const used = new Set(out.map((g) => g.type));
    const rest = Array.from(map.keys())
      .filter((k) => !used.has(k))
      .sort((a, b) => a.localeCompare(b));
    for (const type of rest) {
      const items = map.get(type);
      if (items?.length) {
        out.push({
          type,
          label: labelForType(type),
          items: sortItems(items),
        });
      }
    }
    return out;
  }, [documents]);

  const resetForm = useCallback(() => {
    setDocType("");
    setNotes("");
    setFile(null);
  }, []);

  const closeUploadModal = useCallback(() => {
    setModalOpen(false);
    resetForm();
    if (openedUploadFromQuery.current) {
      openedUploadFromQuery.current = false;
      router.replace(`/clients/${clientId}?tab=documents`);
    }
  }, [resetForm, router, clientId]);

  useEffect(() => {
    if (!openUploadType || openedUploadFromQuery.current) return;
    openedUploadFromQuery.current = true;
    setDocType(openUploadType);
    setModalOpen(true);
  }, [openUploadType]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploading) closeUploadModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, uploading, closeUploadModal]);

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docType.trim()) {
      toast.error("Select a file type.");
      return;
    }
    if (!file) {
      toast.error("Select a file.");
      return;
    }
    const effectiveType = docType.trim();
    setUploading(true);
    const notesTrim = notes.trim();
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("documentType", effectiveType);
    formData.append("file", file);
    if (notesTrim) formData.append("notes", notesTrim);

    try {
      const { document: row, warning, successMessage, clientPatch } =
        await uploadClientDocument(formData);

      if (warning) {
        toast.warning(warning);
      }
      setDocuments((prev) => [...prev, row as DocumentListItem]);
      if (successMessage) {
        toast.success(successMessage);
      } else if (!warning) {
        toast.success(
          effectiveType === "collection_letter"
            ? "Collection letter uploaded"
            : "File uploaded"
        );
      }

      resetForm();
      closeUploadModal();
      if (effectiveType === "collection_letter") {
        await fetchDocuments();
        router.refresh();
      } else if (clientPatch && (isPoaDocumentType(effectiveType) || effectiveType === "cc_authorization")) {
        emitClientProfilePatch({ clientId, ...clientPatch });
      }
    } catch (e) {
      console.error("[DocumentsTab] upload:", e);
      toast.error(
        toUserFacingError(
          e instanceof Error ? e.message : "Upload failed. Please try again."
        )
      );
    } finally {
      setUploading(false);
    }
  };

  const openPreview = async (row: DocumentListItem) => {
    setPreviewLoadingId(row.id);
    try {
      const supabase = createClient();
      const fileUrl = await createClientDocumentSignedUrl(
        supabase,
        row.storage_path
      );
      setPreviewDoc({
        id: row.id,
        fileName: row.file_name,
        fileUrl,
        fileType: row.mime_type ?? "",
      });
    } catch (e) {
      toast.error(
        toUserFacingError(e instanceof Error ? e.message : "Could not open preview.")
      );
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const onDownload = async (row: DocumentListItem) => {
    try {
      await downloadClientDocument({
        documentId: row.id,
        fileName: row.file_name,
      });
    } catch (e) {
      toast.error(
        toUserFacingError(e instanceof Error ? e.message : "Could not download file.")
      );
    }
  };

  const canActOnDoc = (row: DocumentListItem) =>
    canDeleteDocs || row.uploaded_by === currentUserId;

  const canDeleteRow = (row: DocumentListItem) =>
    canActOnDoc(row) && !isPermanentClientDocument(row);

  const onDelete = async (row: DocumentListItem) => {
    if (!canDeleteRow(row)) return;
    if (!window.confirm(`Delete "${row.file_name}"? It will be removed from this client.`)) return;
    setDeletingId(row.id);
    const result = await deleteOwnClientDocument(clientId, row.id);
    if (!result.ok) {
      toast.error(result.error);
      setDeletingId(null);
      return;
    }
    toast.success("File deleted");
    setDeletingId(null);
    setDocuments((prev) => prev.filter((d) => d.id !== row.id));
    router.refresh();
  };

  const onSaveNotes = async (row: DocumentListItem) => {
    setEditNotesSaving(true);
    const result = await editClientDocumentNotes(clientId, row.id, editingNotesValue);
    setEditNotesSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDocuments((prev) =>
      prev.map((d) => d.id === row.id ? { ...d, notes: editingNotesValue.trim() || null } : d)
    );
    setEditingNotesId(null);
    setEditingNotesValue("");
    router.refresh();
  };

  const empty = documents.length === 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Uploads
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload and manage files. Each type is grouped in its own section.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-[#A87830] px-4 py-2.5 text-sm font-bold text-[#161616] shadow-md transition hover:opacity-95"
        >
          Upload +
        </button>
      </div>

      {loadError ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Could not load uploads: {toUserFacingError(loadError)}
        </p>
      ) : null}

      {empty ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center dark:border-[#2E2E2E]">
          <p className="text-base font-medium text-slate-700 dark:text-slate-300">
            No documents uploaded yet
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Click the "Upload File" button above to add documents for this client.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.type}>
              <h4 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide text-slate-800 dark:border-[#2E2E2E] dark:text-slate-200">
                {group.label}
              </h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2E2E2E]">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-[#1C1C1C]/80">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                        &nbsp;
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                        File
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                        Type
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                        Uploaded
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                        By
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                        Size
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 dark:border-[#2E2E2E]"
                      >
                        <td className="whitespace-nowrap px-3 py-2 align-middle">
                          {getFileIcon(row.mime_type, row.file_name)}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                          <button
                            type="button"
                            onClick={() => void openPreview(row)}
                            disabled={previewLoadingId === row.id}
                            className="max-w-[200px] truncate text-left text-sm font-medium text-[#A87830] hover:underline disabled:opacity-50 dark:text-[#7fbf6f]"
                            title={row.file_name}
                          >
                            {previewLoadingId === row.id ? "Opening…" : row.file_name}
                          </button>
                          {editingNotesId === row.id ? (
                            <div className="mt-1 flex items-center gap-1.5">
                              <input
                                type="text"
                                className="crm-input py-1 text-xs"
                                value={editingNotesValue}
                                onChange={(e) => setEditingNotesValue(e.target.value)}
                                disabled={editNotesSaving}
                                placeholder="Add a description…"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void onSaveNotes(row);
                                  if (e.key === "Escape") { setEditingNotesId(null); setEditingNotesValue(""); }
                                }}
                              />
                              <button
                                type="button"
                                disabled={editNotesSaving}
                                onClick={() => void onSaveNotes(row)}
                                className="shrink-0 rounded bg-[#A87830] px-2 py-1 text-xs font-semibold text-[#161616] hover:bg-[#8C6428] disabled:opacity-50"
                              >
                                {editNotesSaving ? "…" : "Save"}
                              </button>
                              <button
                                type="button"
                                disabled={editNotesSaving}
                                onClick={() => { setEditingNotesId(null); setEditingNotesValue(""); }}
                                className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {row.notes ? (
                                <span className="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                                  {row.notes}
                                </span>
                              ) : null}
                              {canActOnDoc(row) ? (
                                <button
                                  type="button"
                                  onClick={() => { setEditingNotesId(row.id); setEditingNotesValue(row.notes ?? ""); }}
                                  className="shrink-0 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                                  title="Edit description"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">
                          {labelForType(row.document_type?.trim() || "__uncategorized__")}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">
                          <ClientFormattedDate iso={row.created_at} />
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {row.uploaded_by
                            ? uploaderNames[row.uploaded_by] ?? "—"
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">
                          {formatFileSize(row.file_size_bytes)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void onDownload(row)}
                            className="mr-2 text-xs font-semibold text-[#A87830] hover:underline"
                          >
                            Download
                          </button>
                          {canDeleteRow(row) ? (
                            <button
                              type="button"
                              disabled={deletingId === row.id}
                              onClick={() => void onDelete(row)}
                              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {deletingId === row.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Deleting…
                                </>
                              ) : (
                                "Delete"
                              )}
                            </button>
                          ) : isPermanentClientDocument(row) ? (
                            <span
                              className="text-xs font-medium text-slate-400 dark:text-slate-500"
                              title="Collection letters and POA files cannot be deleted."
                            >
                              Locked
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-file-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !uploading) closeUploadModal();
          }}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h4
                id="upload-file-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Upload File
              </h4>
              <button
                type="button"
                disabled={uploading}
                onClick={closeUploadModal}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-[#242424]"
                aria-label="Close upload modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onUpload} className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  File type <span className="text-red-600">*</span>
                </span>
                <select
                  required
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
                >
                  <option value="">Select a file type</option>
                  {DOCUMENT_TAB_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm" htmlFor="doc-upload-file">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  File <span className="text-red-600">*</span>
                </span>
                <input
                  id="doc-upload-file"
                  type="file"
                  accept="audio/*,video/*,image/*,.pdf,.txt,text/plain,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold dark:text-slate-300 dark:file:bg-[#2E2E2E]"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  PDF, TXT, images, audio (MP3/WAV/M4A), video, and Word documents.
                </p>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Notes (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
                  placeholder="Internal notes…"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={closeUploadModal}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg bg-[#A87830] px-4 py-2 text-sm font-bold text-[#161616] shadow hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    "Upload"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {previewDoc ? (
        <DocPreviewModal
          documentId={previewDoc.id}
          fileName={previewDoc.fileName}
          fileUrl={previewDoc.fileUrl}
          fileType={previewDoc.fileType}
          onClose={() => setPreviewDoc(null)}
        />
      ) : null}
    </section>
  );
}

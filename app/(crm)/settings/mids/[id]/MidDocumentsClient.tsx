"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { createClient } from "@/lib/supabase/client";
import {
  ESIGN_BEHAVIORS,
  ESIGN_BEHAVIOR_LABELS,
  type EsignBehavior,
  type EsignTemplateRow,
} from "@/lib/esign/types";
import { deleteTemplate, setTemplateActive } from "../actions";

export function MidDocumentsClient({
  midId,
  midName,
  templates,
}: {
  midId: string;
  midName: string;
  templates: EsignTemplateRow[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [behavior, setBehavior] = useState<EsignBehavior>("cc_authorization");
  const [hint, setHint] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function run(work: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) {
    startTransition(async () => {
      const res = await work();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Enter a document name.");
      return;
    }
    if (!file) {
      toast.error("Choose a PDF.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Upload a PDF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("PDF must be 8 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const initRes = await fetch("/api/esign/template-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      });
      const initJson = (await initRes.json()) as {
        error?: string;
        path?: string;
        token?: string;
        uploadToken?: string;
      };
      if (!initRes.ok || !initJson.path || !initJson.token || !initJson.uploadToken) {
        toast.error(toUserFacingError(initJson.error || "Could not start upload"));
        return;
      }

      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("esign-templates")
        .uploadToSignedUrl(initJson.path, initJson.token, file, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadErr) {
        toast.error(toUserFacingError(uploadErr.message || "Upload failed"));
        return;
      }

      const doneRes = await fetch("/api/esign/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          midId,
          name: cleanName,
          behavior,
          hint,
          path: initJson.path,
          uploadToken: initJson.uploadToken,
          fileSize: file.size,
        }),
      });
      const doneJson = (await doneRes.json()) as {
        error?: string;
        templateId?: string;
        suggestedCount?: number;
      };
      if (!doneRes.ok || !doneJson.templateId) {
        toast.error(toUserFacingError(doneJson.error || "Could not save the document"));
        return;
      }

      const placed = doneJson.suggestedCount ?? 0;
      toast.success(
        placed > 0
          ? `${cleanName} added. ${placed} general field${placed === 1 ? "" : "s"} placed — adjust them, then save.`
          : `${cleanName} added. Drag on the fields this document needs, then save.`
      );
      router.push(`/esign-templates/${doneJson.templateId}`);
    } catch (err) {
      toast.error(toUserFacingError(err instanceof Error ? err.message : "Could not upload"));
    } finally {
      setUploading(false);
    }
  }

  const busy = pending || uploading;

  return (
    <div className="space-y-6">
      <section className="gp-card">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Add a document
        </h2>
        <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
          {midName} clients will see this document and no others. Name, address, and
          similar labels are placed automatically. You can move those and add anything
          else after the PDF is saved.
        </p>
        <form onSubmit={(e) => void onAdd(e)} className="mt-3 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Credit card authorization"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">What it does</span>
            <select
              value={behavior}
              onChange={(e) => setBehavior(e.target.value as EsignBehavior)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
            >
              {ESIGN_BEHAVIORS.map((value) => (
                <option key={value} value={value}>
                  {ESIGN_BEHAVIOR_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Short note <span className="font-normal text-slate-500">(optional)</span>
            </span>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Shown under the name on the client profile"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:text-slate-300 dark:file:bg-[#242424] dark:file:text-slate-200"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !name.trim() || !file}
            className="crm-btn-primary !px-4 !py-2 !text-sm"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            Add document
          </button>
        </form>
      </section>

      <section className="gp-card !p-0">
        {templates.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-white">No documents yet</p>
            <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
              Upload the first PDF above. Clients assigned to {midName} will then be able to
              receive it.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
            {templates.map((template) => (
              <li key={template.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {template.name}
                    </p>
                    {!template.is_active ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-[#242424] dark:text-slate-300">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                    {ESIGN_BEHAVIOR_LABELS[template.behavior] ?? template.behavior}
                    {template.hint ? ` · ${template.hint}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/esign-templates/${template.id}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
                  >
                    Place fields
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => setTemplateActive(template.id, !template.is_active),
                        template.is_active ? "Document deactivated" : "Document activated"
                      )
                    }
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-[#2E2E2E] dark:text-slate-300 dark:hover:bg-[#242424]"
                  >
                    {template.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => deleteTemplate(template.id), "Document deleted")}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

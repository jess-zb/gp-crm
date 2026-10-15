"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUserFacingError } from "@/lib/user-facing-error";
import { importLeadTextFile } from "./import-lead-file";

const MAX_FILES = 10;

function isTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".txt") || file.type === "text/plain" || file.type.startsWith("text/plain;");
}

export function LeadFileDrop() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function importFiles(list: File[]) {
    const texts = list.filter(isTextFile);
    const skipped = list.length - texts.length;
    if (texts.length === 0) {
      toast.error("Drop a .txt lead file.");
      return;
    }
    if (skipped > 0) {
      toast.error("Only .txt lead files are added. Other files were left out.");
    }
    const batch = texts.slice(0, MAX_FILES);
    if (texts.length > MAX_FILES) {
      toast.error(`Only the first ${MAX_FILES} files were added.`);
    }

    setBusy(true);
    try {
      const added: string[] = [];
      for (const file of batch) {
        const form = new FormData();
        form.set("file", file);
        const result = await importLeadTextFile(form);
        if (!result.ok) {
          toast.error(toUserFacingError(result.error));
          continue;
        }
        added.push(result.name);
      }
      if (added.length === 1) {
        toast.success(`${added[0]} added as a new lead.`);
      } else if (added.length > 1) {
        toast.success(`${added.length} new leads added.`);
      }
      if (added.length > 0) router.refresh();
    } catch (err) {
      toast.error(toUserFacingError(err instanceof Error ? err.message : "Could not add that lead."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      className={`mt-5 rounded-xl border border-dashed px-4 py-3 transition-colors ${
        over
          ? "border-[#A87830] bg-[#A87830]/10"
          : "border-slate-300 bg-slate-50 dark:border-[#3A3A3A] dark:bg-[#1C1C1C]"
      } ${busy ? "opacity-70" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        if (busy) return;
        void importFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <label
        htmlFor="lead-text-file"
        className={`flex items-center gap-3 ${busy ? "cursor-wait" : "cursor-pointer"}`}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#A87830]" aria-hidden />
        ) : (
          <FileText className="h-5 w-5 shrink-0 text-[#A87830]" aria-hidden />
        )}
        <span className="min-w-0" aria-live="polite">
          <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
            {busy ? "Adding lead…" : "Drop a lead file"}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Drag a .txt export here, or click to choose one. It becomes a New Lead.
          </span>
        </span>
      </label>
      <input
        ref={inputRef}
        id="lead-text-file"
        type="file"
        accept=".txt,text/plain"
        multiple
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length === 0) return;
          void importFiles(files);
        }}
      />
    </div>
  );
}

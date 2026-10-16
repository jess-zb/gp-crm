"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUserFacingError } from "@/lib/user-facing-error";
import { buildClientsHref } from "@/lib/clients/clients-tabs";
import { importLeadTextFile } from "./import-lead-file";

function isTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".txt") || file.type === "text/plain" || file.type.startsWith("text/plain;");
}

export function LeadFileDrop({ tab }: { tab: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

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

    setProgress(texts.length === 1 ? "Adding lead…" : `Adding 1 of ${texts.length}`);
    try {
      const added: string[] = [];
      for (let i = 0; i < texts.length; i++) {
        const file = texts[i];
        setProgress(texts.length === 1 ? "Adding lead…" : `Adding ${i + 1} of ${texts.length}`);
        const form = new FormData();
        form.set("file", file);
        const result = await importLeadTextFile(form);
        if (!result.ok) {
          toast.error(`${file.name}: ${toUserFacingError(result.error)}`);
          continue;
        }
        added.push(result.name);
      }
      if (added.length === 1) {
        toast.success(`${added[0]} added as a new lead.`);
      } else if (added.length > 1) {
        toast.success(`${added.length} new leads added.`);
      }
      if (added.length > 0) {
        const landing = tab === "all" || tab === "active" ? tab : "active";
        router.push(buildClientsHref({ tab: landing }));
        router.refresh();
      }
    } catch (err) {
      toast.error(toUserFacingError(err instanceof Error ? err.message : "Could not add that lead."));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      data-tour="lead-drop"
      className={`w-full justify-self-end rounded-md border border-dashed px-3 py-2 transition-colors md:w-auto ${
        over
          ? "border-[#A87830] bg-[#A87830]/10"
          : "border-slate-300 bg-slate-50 dark:border-[#3A3A3A] dark:bg-[#1C1C1C]"
      } ${progress ? "opacity-70" : ""}`}
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
        if (progress) return;
        void importFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <label
        htmlFor="lead-text-file"
        title="Drag a .txt export here, or click to choose one. It becomes a New Lead."
        className={`flex items-center gap-2 ${progress ? "cursor-wait" : "cursor-pointer"}`}
      >
        {progress ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#A87830]" aria-hidden />
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-[#A87830]" aria-hidden />
        )}
        <span className="whitespace-nowrap text-[13px] font-medium text-slate-800 dark:text-slate-100" aria-live="polite">
          {progress ?? "Drop a lead file"}
        </span>
      </label>
      <input
        ref={inputRef}
        id="lead-text-file"
        type="file"
        accept=".txt,text/plain"
        multiple
        className="sr-only"
        disabled={progress !== null}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length === 0) return;
          void importFiles(files);
        }}
      />
    </div>
  );
}

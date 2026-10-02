"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { ALL_GUIDES } from "@/lib/help/guides-index";
import { getGuideContent } from "@/lib/help/guide-content";
import { Upload } from "lucide-react";

const BUCKET = "guide-screenshots";

function publicScreenshotUrl(slug: string, stepNumber: number) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  return `${url}/storage/v1/object/public/${BUCKET}/${slug}/step-${stepNumber}.png`;
}

export function ManageScreenshotsClient() {
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const out: { slug: string; title: string; step: number; path: string }[] = [];
    for (const g of ALL_GUIDES) {
      const content = getGuideContent(g.slug);
      const n = content?.steps.length ?? g.steps;
      for (let s = 1; s <= n; s += 1) {
        out.push({
          slug: g.slug,
          title: g.title,
          step: s,
          path: `${g.slug}/step-${s}.png`,
        });
      }
    }
    return out;
  }, []);

  const handleUpload = useCallback(
    async (slug: string, stepNumber: number, file: File) => {
      const path = `${slug}/step-${stepNumber}.png`;
      const key = `${slug}-${stepNumber}`;
      setUploadingKey(key);
      try {
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });
        if (error) {
          toast.error(toUserFacingError(error.message));
          return;
        }
        toast.success("Screenshot uploaded!");
        router.refresh();
      } finally {
        setUploadingKey(null);
      }
    },
    [router, supabase, toast]
  );

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        All file types accepted. Files are stored at{" "}
        <code className="rounded bg-slate-100 px-1 text-xs dark:bg-[#071929]">
          {BUCKET}/{"{slug}"}/step-{"{n}"}.png
        </code>
        .
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const url = publicScreenshotUrl(row.slug, row.step);
          const key = `${row.slug}-${row.step}`;
          const busy = uploadingKey === key;
          return (
            <div
              key={key}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8DE3B5] dark:text-[#8DE3B5]">
                {row.slug}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
                {row.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Step {row.step}</p>

              <div className="mt-3 flex min-h-[120px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-[#1a3550] dark:bg-[#071929]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="max-h-40 w-full object-contain" />
              </div>

              <label className="mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#1a3550] dark:text-slate-200 dark:hover:bg-[#102840]">
                <Upload className="h-3.5 w-3.5" />
                {busy ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="*/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    ev.target.value = "";
                    if (!f) return;
                    void handleUpload(row.slug, row.step, f);
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

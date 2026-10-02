import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isCrmStaffRole } from "@/lib/roles";
import { canViewerAccessGuide, guideMetaBySlug } from "@/lib/help/guides-index";
import { GUIDE_CONTENT, getGuideContent } from "@/lib/help/guide-content";
import GuidePageClient from "./GuidePageClient";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const guide = getGuideContent(params.slug);
  if (guide) {
    return { title: `${guide.title} | Teach Me` };
  }
  const meta = guideMetaBySlug(params.slug);
  return {
    title: meta ? `${meta.title} | Teach Me` : "Guide | Teach Me",
  };
}

export default async function GuideSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");

  const r = profile.role;
  if (r === "client") redirect("/portal/help");
  if (!isCrmStaffRole(r) && r !== "attorney") redirect("/dashboard");

  const slug = params.slug;
  const guide = getGuideContent(slug);
  const guideMeta = guideMetaBySlug(slug);

  if (!guide && !guideMeta) {
    notFound();
  }

  if (guideMeta && !canViewerAccessGuide(slug, r)) {
    const backHref = r === "attorney" ? "/attorney/help" : "/help";
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This guide is not available for your role.
        </p>
        <Link
          href={backHref}
          className="mt-4 inline-block text-sm font-semibold text-[#8DE3B5] hover:underline dark:text-[#8DE3B5]"
        >
          Back to Teach Me
        </Link>
      </main>
    );
  }

  if (!guide && guideMeta) {
    const partial = GUIDE_CONTENT[slug];
    const demoUrl = partial?.demo_url;

    return (
      <main className="mx-auto max-w-2xl px-6 py-12 text-center">
        <Link
          href={r === "attorney" ? "/attorney/help" : "/help"}
          className="mb-8 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Teach Me
        </Link>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-green-50 dark:bg-[#102840]">
          <span className="text-3xl">{guideMeta.icon}</span>
        </div>
        <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">{guideMeta.title}</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">{guideMeta.description}</p>

        {demoUrl ? (
          <div
            className="relative overflow-hidden rounded-lg border border-gray-200 shadow-md dark:border-[#1a3550]"
            style={{ paddingBottom: "62.5%" }}
          >
            <iframe
              src={demoUrl}
              className="absolute left-0 top-0 h-full w-full border-0"
              allowFullScreen
              title={guideMeta.title}
            />
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 dark:border-[#1a3550] dark:bg-[#071929]">
            <Clock className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-gray-400 dark:text-slate-500">
              Full lesson coming soon
            </p>
            <p className="mt-1 text-xs text-gray-300 dark:text-slate-600">
              This guide is being prepared
            </p>
          </div>
        )}
      </main>
    );
  }

  if (!guide) {
    notFound();
  }

  const demoLayout = Boolean(guide.demo_url);

  return (
    <main
      className={
        demoLayout
          ? "mx-auto w-full max-w-[96rem] px-3 py-6 sm:px-5 sm:py-8 md:px-10"
          : "mx-auto max-w-3xl px-6 py-8"
      }
    >
      <Suspense
        fallback={<p className="text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      >
        <GuidePageClient guide={guide} viewerRole={r} />
      </Suspense>
    </main>
  );
}

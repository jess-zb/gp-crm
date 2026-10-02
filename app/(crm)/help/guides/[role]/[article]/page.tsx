import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  findHelpArticle,
  type HelpDeskRole,
} from "@/app/(crm)/help/helpContent";
import { getProfileForUser } from "@/lib/supabase/profile";
import { buildGuideStepsFromArticle } from "@/lib/help/guide-registry";
import GuideWalkthroughClient from "@/app/(crm)/help/guides/GuideWalkthroughClient";

const HELP_DESK_ROLES: HelpDeskRole[] = [
  "dev",
  "admin",
  "acct_manager",
  "attorney",
];

function isHelpDeskRole(value: string): value is HelpDeskRole {
  return (HELP_DESK_ROLES as string[]).includes(value);
}

export default async function InteractiveGuidePage({
  params,
}: {
  params: Promise<{ role: string; article: string }> | { role: string; article: string };
}) {
  const { role: roleParam, article: articleParam } = await Promise.resolve(params);
  if (!isHelpDeskRole(roleParam)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");
  if (profile.role === "client") redirect("/portal/help");

  /** Guides are scoped to the signed-in user's role catalog only. */
  if (profile.role !== roleParam) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-700 dark:text-slate-300">
          This tour is for a different role. Open Help from your account and choose{" "}
          <strong>Interactive guide</strong> from an article.
        </p>
        <Link
          href="/help"
          className="mt-6 inline-block font-semibold text-[#8DE3B5] hover:underline"
        >
          Back to Help Center
        </Link>
      </main>
    );
  }

  const found = findHelpArticle(roleParam, decodeURIComponent(articleParam));
  if (!found) {
    notFound();
  }

  const steps = buildGuideStepsFromArticle(found.article);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 md:px-6">
      <GuideWalkthroughClient
        role={roleParam}
        articleId={found.article.id}
        articleTitle={found.article.title}
        categoryTitle={found.category.title}
        steps={steps}
        userId={user.id}
      />
    </main>
  );
}

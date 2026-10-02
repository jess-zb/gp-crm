import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { TeachMeCourseClient } from "@/app/(crm)/help/TeachMeCourseClient";

export const metadata = {
  title: "Teach Me | Attorney",
  description: "Learn how to use the attorney workspace",
};

export default async function AttorneyTeachMePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");

  const r = profile.role;
  if (r !== "attorney" && r !== "dev" && r !== "admin") {
    redirect("/dashboard");
  }
  if (r === "attorney") {
    redirect("/attorney/cases");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <nav className="mb-6 text-sm text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href="/attorney/cases"
              className="font-medium text-[#8DE3B5] hover:text-[#6BC99A] dark:text-[#8DE3B5]"
            >
              Cases
            </Link>
          </li>
          <li className="text-slate-400" aria-hidden>
            /
          </li>
          <li className="font-medium text-slate-800 dark:text-slate-200">Teach Me</li>
        </ol>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[#8DE3B5] dark:text-[#8DE3B5]">
        Teach Me
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Structured guides for the attorney workspace
      </p>
      <div className="mt-8">
        <TeachMeCourseClient viewerRole={r} variant="attorney" />
      </div>
    </main>
  );
}

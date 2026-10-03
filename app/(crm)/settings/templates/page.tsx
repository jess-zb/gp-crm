import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isOpsLead } from "@/lib/roles";
import { TemplatesClient } from "./TemplatesClient";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";

export default async function TemplatesSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");

  if (profile.role === "client") redirect("/portal");
  if (profile.role === "attorney") redirect("/attorney/cases");

  const canManage = isOpsLead(profile.role);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Message templates" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-5">
        <p className="mb-4 max-w-2xl text-[13px] text-slate-600 dark:text-slate-400">
          Reusable email and text bodies for logging communications. Merge tags are filled when you
          apply a template on a client profile.
        </p>
        <p className="mb-6 text-[13px]">
          <Link
            href="/settings"
            className="font-medium text-[#A87830] hover:underline dark:text-[#A87830]"
          >
            ← Account settings
          </Link>
        </p>

        <TemplatesClient canManage={canManage} />
      </main>
    </div>
  );
}

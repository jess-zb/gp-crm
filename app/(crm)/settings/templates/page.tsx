import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronRight } from "lucide-react";
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

  const { data: dispatchSetting } = await supabase
    .from("crm_settings")
    .select("value")
    .eq("key", "email_sequences_enabled")
    .maybeSingle();
  const emailDispatchDisabled = dispatchSetting?.value !== "true";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Message templates" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-5">
        {emailDispatchDisabled ? (
          <Link
            href="/settings"
            className="mb-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:hover:bg-red-950/50"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                Automated drip emails are paused
              </p>
              <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
                No sequence emails will be sent until re-enabled. Click to open Settings.
              </p>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          </Link>
        ) : null}
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

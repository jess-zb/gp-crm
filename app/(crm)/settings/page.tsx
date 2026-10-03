import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { getRoleDisplayName } from "@/lib/utils/roles";
import { SettingsClient } from "./SettingsClient";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");

  if (profile.role === "client") redirect("/portal");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Settings" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-5">
        <p className="text-[13px] text-slate-600 dark:text-slate-400">
          Manage your profile, password, and preferences.
        </p>

        <SettingsClient
          initialFullName={profile.full_name}
          email={user.email ?? null}
          roleDisplay={getRoleDisplayName(profile.role)}
          showWorkspace={profile.role === "dev" || profile.role === "admin"}
          isDev={profile.role === "dev"}
        />
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { getRoleDisplayName } from "@/lib/utils/roles";
import { SettingsClient } from "@/app/(crm)/settings/SettingsClient";

export default async function AttorneySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");

  if (
    profile.role !== "attorney" &&
    profile.role !== "admin" &&
    profile.role !== "dev"
  ) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        Settings
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Manage your profile, password, and preferences.
      </p>

      <div className="mt-6">
        <SettingsClient
          initialFullName={profile.full_name}
          email={user.email ?? null}
          roleDisplay={getRoleDisplayName(profile.role)}
          showWorkspace={profile.role === "dev" || profile.role === "admin"}
          isDev={profile.role === "dev"}
        />
      </div>
    </main>
  );
}

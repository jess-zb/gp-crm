import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessTeamPage } from "@/lib/roles";
import { isHiddenFromRole } from "@/lib/constants/hidden-accounts";
import { STARRED_EMAILS } from "@/lib/team/starred";
import {
  TeamManagementClient,
  type TeamMemberRow,
} from "./TeamManagementClient";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");

  if (!canAccessTeamPage(profile.role)) {
    redirect("/dashboard");
  }

  const isDevRole = profile.role === "dev";
  const roleFilter = isDevRole
    ? (["dev", "admin", "acct_manager", "attorney"] as const)
    : (["admin", "acct_manager", "attorney"] as const);

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, is_active, is_compliance, is_accounts, is_services"
    )
    .in("role", [...roleFilter])
    .order("full_name", { ascending: true, nullsFirst: false });

  if (profErr) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <CrmPageHeader title="Team" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">
          <p className="text-sm text-red-600">{profErr.message}</p>
        </main>
      </div>
    );
  }

  let profileList = [...(profiles ?? [])];
  const emailLower = (e: string | null | undefined) => (e ?? "").toLowerCase();
  const existingEmails = new Set(profileList.map((p) => emailLower(p.email as string | null)));

  const missingStarred = STARRED_EMAILS.filter((addr) => !existingEmails.has(addr.toLowerCase()));
  if (missingStarred.length) {
    const { data: extra } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, role, is_active, is_compliance, is_accounts, is_services"
      )
      .in("email", missingStarred)
      .eq("is_active", true);
    const seen = new Set(profileList.map((p) => p.id as string));
    for (const row of extra ?? []) {
      const id = row.id as string;
      if (!seen.has(id)) {
        profileList.push(row);
        seen.add(id);
      }
    }
  }

  const starredSet = new Set(STARRED_EMAILS.map((e) => e.toLowerCase()));

  const sortedProfiles = [
    ...STARRED_EMAILS.map((email) =>
      profileList.find((p) => emailLower(p.email as string | null) === email.toLowerCase())
    ).filter(Boolean),
    ...profileList
      .filter((p) => !starredSet.has(emailLower(p.email as string | null)))
      .sort((a, b) =>
        String(a.full_name ?? a.email ?? "").localeCompare(
          String(b.full_name ?? b.email ?? ""),
          undefined,
          { sensitivity: "base" }
        )
      ),
  ] as {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    is_active: boolean | null;
    is_compliance: boolean | null;
    is_accounts: boolean | null;
    is_services: boolean | null;
  }[];

  const visibleProfiles = sortedProfiles.filter(
    (p) => !isHiddenFromRole(p.email as string | null, profile.role)
  );

  const members: TeamMemberRow[] = visibleProfiles.map((p) => ({
    id: p.id as string,
    email: p.email as string | null,
    full_name: p.full_name as string | null,
    role: p.role as string,
    is_active: p.is_active as boolean | null,
    is_compliance: !!p.is_compliance,
    is_accounts: !!p.is_accounts,
    is_services: !!p.is_services,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TeamManagementClient
        members={members}
        currentUserId={user.id}
        viewerProfileRole={profile.role}
        canInvite={profile.role === "admin" || profile.role === "dev"}
      />
    </div>
  );
}

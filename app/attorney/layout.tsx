import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isTransientUpstreamFailure } from "@/lib/supabase/transient-failure";
import { AttorneyShell } from "@/app/components/AttorneyShell";

export default async function AttorneyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError && isTransientUpstreamFailure(authError.message)) {
    throw new Error("Could not verify your session. Refresh the page to try again.");
  }
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error && isTransientUpstreamFailure(error)) {
    throw new Error("Could not load your account. Refresh the page to try again.");
  }
  if (error || !profile) redirect("/login");

  if (
    profile.role !== "attorney" &&
    profile.role !== "admin" &&
    profile.role !== "dev"
  ) {
    redirect("/dashboard");
  }

  const displayName = profile.full_name?.trim() || user.email || "Attorney";

  const { data: me } = await supabase
    .from("profiles")
    .select("last_seen_at")
    .eq("id", user.id)
    .maybeSingle();

  const afterIso =
    (me as { last_seen_at?: string | null } | null)?.last_seen_at ??
    "1970-01-01T00:00:00.000Z";
  const { count: newCaseCount = 0 } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("attorney_id", user.id)
    .eq("stage", "case_sent_to_attorneys")
    .not("attorney_portal_assigned_at", "is", null)
    .gt("attorney_portal_assigned_at", afterIso);

  return (
    <AttorneyShell
      displayName={displayName}
      userRole={profile.role}
      userId={user.id}
      newCaseCount={newCaseCount ?? 0}
    >
      {children}
    </AttorneyShell>
  );
}

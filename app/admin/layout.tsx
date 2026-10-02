import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { CrmShell } from "@/app/components/CrmShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");

  if (profile.role === "client") redirect("/portal");

  const displayName = profile.full_name?.trim() || user.email || "User";

  const { data: chatProfileRow } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, email, is_accounts, is_services"
    )
    .eq("id", user.id)
    .single();

  const chatProfile = chatProfileRow
    ? {
        id: chatProfileRow.id as string,
        full_name: (chatProfileRow.full_name as string | null) ?? null,
        role: chatProfileRow.role as string,
        is_accounts: !!chatProfileRow.is_accounts,
        is_services: !!chatProfileRow.is_services,
      }
    : null;

  return (
    <CrmShell
      displayName={displayName}
      role={profile.role}
      userId={user.id}
      chatProfile={chatProfile}
    >
      {children}
    </CrmShell>
  );
}

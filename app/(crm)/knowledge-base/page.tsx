import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isDevOrAdmin } from "@/lib/roles";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { KnowledgeBaseClient } from "./KnowledgeBaseClient";

export default async function KnowledgeBasePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");
  if (profile.role === "client") redirect("/portal");
  if (profile.role === "attorney") redirect("/attorney/cases");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Knowledge Base" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">
        <KnowledgeBaseClient canEdit={isDevOrAdmin(profile.role)} />
      </main>
    </div>
  );
}

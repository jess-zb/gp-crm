import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canExportBulkInviteCsv } from "@/lib/roles";
import { BulkInviteClient } from "./BulkInviteClient";

export default async function BulkInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");

  if (profile.role !== "dev") {
    redirect("/dashboard");
  }

  return <BulkInviteClient canExportCsv={canExportBulkInviteCsv(profile.role)} />;
}

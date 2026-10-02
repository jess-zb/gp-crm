import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isCrmStaffRole } from "@/lib/roles";
import { TeachMeCourseClient } from "./TeachMeCourseClient";

export const metadata = {
  title: "Teach Me | DebtSupportPros CRM",
  description: "Learn how to use DebtSupportPros CRM",
};

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");

  const r = profile.role;
  if (r === "client") redirect("/portal/help");

  if (!isCrmStaffRole(r) && r !== "attorney") {
    redirect("/dashboard");
  }

  return (
    <main className="relative mx-auto min-w-0 max-w-4xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <TeachMeCourseClient viewerRole={r} variant="crm" />
    </main>
  );
}

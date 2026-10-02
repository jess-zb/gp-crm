import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isTransientUpstreamFailure } from "@/lib/supabase/transient-failure";

export default async function RootPage() {
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
  if (error || !profile) {
    redirect("/login");
  }

  if (profile.role === "client") redirect("/portal");
  if (profile.role === "attorney") redirect("/attorney/cases");
  redirect("/dashboard");
}

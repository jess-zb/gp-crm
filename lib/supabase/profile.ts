import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types/user-role";

export type ProfileRow = {
  role: UserRole | string;
  full_name: string | null;
};

/**
 * Load profile or create a minimal row if the auth trigger did not run (common for older users).
 */
export async function getProfileForUser(
  supabase: SupabaseClient,
  user: User
): Promise<{ profile: ProfileRow | null; error: string | null }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }

  if (profile) {
    return { profile: profile as ProfileRow, error: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email ??
        "",
      role: "client",
    })
    .select("role, full_name")
    .maybeSingle();

  if (insertError) {
    return { profile: null, error: insertError.message };
  }

  return { profile: inserted as ProfileRow, error: null };
}

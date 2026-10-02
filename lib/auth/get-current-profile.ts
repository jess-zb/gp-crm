import type { SupabaseClient } from "@supabase/supabase-js";

export type CurrentProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_accounts: boolean;
  is_services: boolean;
};

export async function getCurrentProfile(
  supabase: SupabaseClient
): Promise<CurrentProfileRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_accounts, is_services")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as CurrentProfileRow;
}

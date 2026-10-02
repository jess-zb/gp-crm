import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { AttorneyCommunicationsClient } from "./AttorneyCommunicationsClient";

export type AttorneyClientOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export default async function AttorneyCommunicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) redirect("/login");
  /* Role is enforced by app/attorney/layout.tsx — do not duplicate redirects here. */

  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("attorney_id", user.id)
    .not("attorney_portal_assigned_at", "is", null)
    .in("stage", ["case_sent_to_attorneys", "closed"])
    .order("first_name", { ascending: true });

  const clients: AttorneyClientOption[] = (clientRows ?? []).map((c) => ({
    id: c.id as string,
    first_name: c.first_name as string | null,
    last_name: c.last_name as string | null,
  }));

  const displayName = profile.full_name?.trim() || user.email || "Attorney";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        Communications
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Portal messages with clients you represent.{" "}
        <Link href="/attorney/cases" className="font-medium text-[#8DE3B5] hover:underline">
          View cases
        </Link>
      </p>

      <AttorneyCommunicationsClient
        clients={clients}
        userId={user.id}
        senderName={displayName}
      />
    </main>
  );
}

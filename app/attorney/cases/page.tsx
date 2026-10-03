import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { buildSearchQuery } from "@/lib/clients/client-search";
import { AttorneyCasesListClient } from "./AttorneyCasesListClient";
import { AttorneyCasesMarkSeen } from "./AttorneyCasesMarkSeen";

export type AttorneyCaseRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  stage: string;
  case_sent_to_attorney_at: string | null;
  attorney_portal_assigned_at: string | null;
};

type SearchParams = { q?: string };

export default async function AttorneyCasesPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const sp = await Promise.resolve(searchParams);
  const q = (sp.q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error } = await getProfileForUser(supabase, user);
  if (error || !profile) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-600 dark:text-slate-400">
        <p>Could not load your profile.</p>
        <Link href="/login" className="mt-4 inline-block text-[#A87830] underline">
          Login
        </Link>
      </main>
    );
  }

  if (
    profile.role !== "attorney" &&
    profile.role !== "admin" &&
    profile.role !== "dev"
  ) {
    redirect("/dashboard");
  }

  let query = supabase
    .from("clients")
    .select("id, first_name, last_name, email, stage, case_sent_to_attorney_at, attorney_portal_assigned_at")
    .eq("attorney_id", user.id)
    .not("attorney_portal_assigned_at", "is", null)
    .in("stage", ["case_sent_to_attorneys", "closed"])
    .order("attorney_portal_assigned_at", { ascending: false, nullsFirst: false });

  if (q) {
    const raw = (sp.q ?? "").trim().slice(0, 200);
    const frag = buildSearchQuery(raw);
    if (frag) {
      query = query.or(frag);
    }
  }

  const { data: rows, error: listErr } = await query;

  if (listErr) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-red-600">{listErr.message}</p>
      </main>
    );
  }

  const cases: AttorneyCaseRow[] = (rows ?? []).map((c) => ({
    id: c.id as string,
    first_name: c.first_name as string | null,
    last_name: c.last_name as string | null,
    stage: c.stage as string,
    case_sent_to_attorney_at: c.case_sent_to_attorney_at as string | null,
    attorney_portal_assigned_at: c.attorney_portal_assigned_at as string | null,
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AttorneyCasesMarkSeen />
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        My Cases
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Cases assigned to you through the attorney queue.
      </p>

      <AttorneyCasesListClient initialQ={q} cases={cases} />
    </main>
  );
}

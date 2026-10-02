import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { DuplicateReviewClient } from "./DuplicateReviewClient";
import type { DuplicateClientPair } from "./types";

export default async function DuplicateReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");
  if (profile.role !== "dev") {
    redirect("/dashboard");
  }

  const { data: pairsRaw, error: pairsErr } = await supabase
    .from("duplicate_client_pairs")
    .select("*")
    .order("record_count", { ascending: false });

  if (pairsErr) {
    console.error("[duplicate-review] pairs:", pairsErr.message);
  }

  const pairs = (pairsRaw ?? []) as DuplicateClientPair[];

  const primaryIds = pairs.map((p) => p.primary_id);
  const secondaryIds = pairs.map((p) => p.secondary_id);
  const allClientIds = Array.from(new Set([...primaryIds, ...secondaryIds]));

  const noteMap: Record<string, number> = {};

  if (allClientIds.length > 0) {
    const { data: noteCounts } = await supabase
      .from("communications")
      .select("client_id")
      .in("client_id", allClientIds);

    for (const row of noteCounts ?? []) {
      const id = row.client_id as string;
      noteMap[id] = (noteMap[id] || 0) + 1;
    }
  }

  return (
    <main className="mx-auto min-w-0 max-w-5xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="crm-page-title mb-2 text-2xl font-bold text-slate-900 dark:text-white">
        Duplicate Review
      </h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        Review clients that share the same mobile number. Merge true duplicates or link household
        members as a secondary contact.
      </p>

      <DuplicateReviewClient pairs={pairs} noteMap={noteMap} />
    </main>
  );
}

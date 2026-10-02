import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isDev } from "@/lib/roles";
import { DripBackfillClient } from "./DripBackfillClient";
import {
  listStrandedClientServices,
  listStrandedLeads,
  listStrandedAccountManager,
  listStrandedActiveArc,
  listStrandedCaseReferred,
} from "./actions";

export default async function DripBackfillPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");
  if (!isDev(profile.role)) redirect("/dashboard");

  const [cs, leads, am, arc, caseRef] = await Promise.all([
    listStrandedClientServices(),
    listStrandedLeads(),
    listStrandedAccountManager(),
    listStrandedActiveArc(),
    listStrandedCaseReferred(),
  ]);

  return (
    <main className="mx-auto min-w-0 max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="crm-page-title mb-2 text-2xl font-bold text-slate-900 dark:text-white">
        Drip Backfill
      </h1>
      <p className="mb-8 text-sm text-slate-600 dark:text-slate-400">
        Enroll active clients who are missing their stage-appropriate drip sequences.
        Enrollments are backdated to each client&apos;s stage-entry date so they only
        receive their next upcoming email — no duplicate or out-of-order sends.
      </p>
      <DripBackfillClient
        csCount={cs.ok ? cs.count : 0}
        csSample={cs.ok ? cs.sample : []}
        leadCount={leads.ok ? leads.count : 0}
        leadSample={leads.ok ? leads.sample : []}
        amCount={am.ok ? am.count : 0}
        amSample={am.ok ? am.sample : []}
        arcCount={arc.ok ? arc.count : 0}
        arcSample={arc.ok ? arc.sample : []}
        caseCount={caseRef.ok ? caseRef.count : 0}
        caseSample={caseRef.ok ? caseRef.sample : []}
      />
    </main>
  );
}

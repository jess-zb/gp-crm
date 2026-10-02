import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessAttorneyQueue } from "@/lib/roles";
import {
  fetchAttorneyAssignmentHistory,
  fetchAttorneyOptions,
  fetchAttorneyQueue,
} from "@/lib/attorney-queue/fetch-queue";
import { AttorneyQueueClient } from "./AttorneyQueueClient";

export default async function AttorneyQueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");
  if (profile.role === "client") redirect("/portal");
  if (!canAccessAttorneyQueue(profile.role)) redirect("/dashboard");

  const [
    { clients, error: queueError },
    { rows: history, error: historyError },
    { attorneys, error: attorneyError },
  ] = await Promise.all([
    fetchAttorneyQueue(supabase),
    fetchAttorneyAssignmentHistory(supabase),
    fetchAttorneyOptions(supabase),
  ]);

  if (queueError) {
    console.error("[AttorneyQueue] queue error:", queueError);
  }
  if (historyError) {
    console.error("[AttorneyQueue] history error:", historyError);
  }
  if (attorneyError) {
    console.error("[AttorneyQueue] attorneys error:", attorneyError);
  }

  return (
    <main className="mx-auto min-w-0 max-w-6xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="crm-page-title text-2xl font-bold text-slate-900 dark:text-white">
          Attorney Queue
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Clients in Case Sent to Attorneys appear here until staff assigns them
          to an attorney. Select clients in bulk, choose the attorney, and
          assign — the client receives the case referred email and the attorney
          receives portal access to view contact info, signed POA, and
          collection letters.
        </p>
      </div>

      {(queueError || historyError || attorneyError) && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {queueError
            ? `Could not load queue: ${queueError}`
            : historyError
              ? `Could not load history: ${historyError}`
              : `Could not load attorneys: ${attorneyError}`}
        </div>
      )}

      <AttorneyQueueClient
        initialClients={clients}
        initialHistory={history}
        attorneys={attorneys}
      />
    </main>
  );
}

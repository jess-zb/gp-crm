import { createServiceClient } from "@/lib/supabase/server";
import { cancelActiveSequenceEnrollments } from "@/lib/email/sequence-enrollment";

// Public, unauthenticated page linked from every marketing email
// (`/unsubscribe/{clientId}`). One-click instant: processing happens on load,
// then we show the confirmation. force-dynamic so it is never cached/prefetched
// into a stale state.
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function processUnsubscribe(clientId: string): Promise<void> {
  const supabase = createServiceClient();

  // Stamp the opt-out (preserve the original timestamp if already set).
  await supabase
    .from("clients")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", clientId)
    .is("unsubscribed_at", null);

  // Clear the queue so nothing already scheduled slips through.
  await cancelActiveSequenceEnrollments(supabase, clientId, "unsubscribed");
}

export default async function UnsubscribePage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id?.trim();

  // Always render the same confirmation regardless of whether the id exists,
  // so the page can't be used to probe which client ids are valid. Only touch
  // the DB for well-formed UUIDs — this cheaply rejects crawler/garbage-id
  // floods before they can run service-role writes.
  if (clientId && UUID_RE.test(clientId)) {
    try {
      await processUnsubscribe(clientId);
    } catch (err) {
      console.error("[unsubscribe] failed:", err);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F6F8] px-4 py-10 dark:bg-[#071929]">
      <div className="mx-auto max-w-md rounded-xl border border-[#8DE3B5]/40 bg-white p-6 text-center text-sm text-slate-700 shadow-sm dark:border-[#8DE3B5]/20 dark:bg-[#0B2233] dark:text-slate-200">
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          You&apos;ve been unsubscribed
        </h1>
        <p className="mt-3 leading-relaxed">
          You won&apos;t receive any more marketing emails from us. Important
          account and service messages may still be sent.
        </p>
        <p className="mt-3 leading-relaxed text-slate-500 dark:text-slate-400">
          If this was a mistake, contact your account manager and they can turn
          your emails back on.
        </p>
      </div>
    </main>
  );
}

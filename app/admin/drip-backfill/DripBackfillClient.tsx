"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import {
  backfillClientServicesDrips,
  listStrandedClientServices,
  backfillLeadDrips,
  listStrandedLeads,
  backfillAccountManagerDrips,
  listStrandedAccountManager,
  backfillActiveArcDrips,
  listStrandedActiveArc,
  backfillCaseReferredDrips,
  listStrandedCaseReferred,
} from "./actions";

type StrandedRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
};

type RunResult = {
  processed: number;
  enrolled: number;
  skipped: number;
  reasons: Record<string, number>;
};

const REASON_LABELS: Record<string, string> = {
  no_email: "No email on file",
  already_enrolled: "Already enrolled",
  sequence_disabled: "Sequence disabled",
  no_active_template: "No active template",
  sequence_complete: "Past end of sequence",
  no_reference_date: "No stage-entry or created date",
  database_error: "Database error",
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

type StageCardProps = {
  title: string;
  description: string;
  sequenceLabel: string;
  initialCount: number;
  initialSample: StrandedRow[];
  onRefresh: () => Promise<{ ok: true; count: number; sample: StrandedRow[] } | { ok: false; error: string }>;
  onRun: () => Promise<{ ok: true; processed: number; enrolled: number; skipped: number; reasons: Record<string, number> } | { ok: false; error: string }>;
};

function StageCard({ title, description, sequenceLabel, initialCount, initialSample, onRefresh, onRun }: StageCardProps) {
  const toast = useToast();
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [sample, setSample] = useState<StrandedRow[]>(initialSample);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await onRefresh();
      if (!res.ok) { toast.error(res.error); return; }
      setCount(res.count);
      setSample(res.sample);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRun() {
    setConfirmOpen(false);
    setRunning(true);
    setResult(null);
    try {
      const res = await onRun();
      if (!res.ok) { toast.error(res.error); return; }
      setResult({ processed: res.processed, enrolled: res.enrolled, skipped: res.skipped, reasons: res.reasons });
      toast.success(`Enrolled ${res.enrolled} sequence rows across ${res.processed} clients`);
      const refreshed = await onRefresh();
      if (refreshed.ok) { setCount(refreshed.count); setSample(refreshed.sample); }
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {count}
              <span className="ml-1.5 text-sm font-normal text-slate-400">missing</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing || running}
              className="crm-btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={running || count === 0}
              className="crm-btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              {running ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Enrolling…</>
              ) : (
                `Enroll ${count}`
              )}
            </button>
          </div>
        </div>
      </section>

      {sample.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Preview (first {sample.length})
          </p>
          <ul className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
            {sample.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-800 dark:text-slate-200">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Created {fmt(c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Last run
          </p>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            <li>Clients processed: {result.processed}</li>
            <li>Sequence rows enrolled: {result.enrolled}</li>
            <li>Skipped: {result.skipped}</li>
          </ul>
          {Object.keys(result.reasons).length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              {Object.entries(result.reasons).map(([r, n]) => (
                <li key={r}>{REASON_LABELS[r] ?? r}: {n}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:border dark:border-[#2E2E2E] dark:bg-[#1C1C1C]" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">Enroll {count} clients?</h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Each client gets a backdated <code className="rounded bg-slate-100 px-1 dark:bg-[#121212]">{sequenceLabel}</code> enrollment.
              Steps whose scheduled date is already past are skipped — clients receive only their next upcoming email onward.
              Already-enrolled and no-email clients are automatically skipped.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-700 dark:border-[#2E2E2E] dark:text-slate-200">
                Cancel
              </button>
              <button type="button" onClick={() => void handleRun()} className="crm-btn-primary flex-1 text-sm">
                Enroll
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DripBackfillClient({
  csCount, csSample,
  leadCount, leadSample,
  amCount, amSample,
  arcCount, arcSample,
  caseCount, caseSample,
}: {
  csCount: number; csSample: StrandedRow[];
  leadCount: number; leadSample: StrandedRow[];
  amCount: number; amSample: StrandedRow[];
  arcCount: number; arcSample: StrandedRow[];
  caseCount: number; caseSample: StrandedRow[];
}) {
  const CARDS: StageCardProps[] = [
    {
      title: "New Lead",
      description: "Active leads missing the welcome_lead drip.",
      sequenceLabel: "welcome_lead",
      initialCount: leadCount,
      initialSample: leadSample,
      onRefresh: listStrandedLeads,
      onRun: backfillLeadDrips,
    },
    {
      title: "Account Manager (account_manager)",
      description: "Active Account Manager clients missing the partial_arc enrollment nudge.",
      sequenceLabel: "partial_arc",
      initialCount: amCount,
      initialSample: amSample,
      onRefresh: listStrandedAccountManager,
      onRun: backfillAccountManagerDrips,
    },
    {
      title: "Client Services",
      description: "Active Client Services clients missing welcome_cs + active_arc.",
      sequenceLabel: "welcome_cs + active_arc",
      initialCount: csCount,
      initialSample: csSample,
      onRefresh: listStrandedClientServices,
      onRun: backfillClientServicesDrips,
    },
    {
      title: "Retention + Awaiting Collections",
      description: "Active clients in these stages missing an active_arc enrollment (arc continues through these stages).",
      sequenceLabel: "active_arc",
      initialCount: arcCount,
      initialSample: arcSample,
      onRefresh: listStrandedActiveArc,
      onRun: backfillActiveArcDrips,
    },
    {
      title: "Case Sent to Attorneys",
      description: "Active clients missing the case_referred email.",
      sequenceLabel: "case_referred",
      initialCount: caseCount,
      initialSample: caseSample,
      onRefresh: listStrandedCaseReferred,
      onRun: backfillCaseReferredDrips,
    },
  ];

  return (
    <div className="space-y-8">
      {CARDS.map((card) => (
        <StageCard key={card.title} {...card} />
      ))}
    </div>
  );
}

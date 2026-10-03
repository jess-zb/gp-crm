"use client";

import Link from "next/link";
import { getStageConfig } from "@/lib/constants/stages";

const FUNNEL_STAGES = [
  "lead",
  "account_manager",
  "retention",
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
] as const;

export function DashboardPipelineFunnel({
  stageCounts,
}: {
  stageCounts: Record<string, number>;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Pipeline funnel
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Active clients by stage
          </p>
        </div>
        <Link
          href="/pipeline"
          className="text-sm font-medium text-[#A87830] hover:text-[#8C6428] dark:text-[#A87830] dark:hover:text-[#C4A15A]"
        >
          Full pipeline
        </Link>
      </div>
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-0">
          {FUNNEL_STAGES.map((stage, idx) => {
            const config = getStageConfig(stage);
            const count = stageCounts[stage] ?? 0;
            const isLast = idx === FUNNEL_STAGES.length - 1;

            return (
              <div key={stage} className="relative flex items-stretch">
                <div
                  className={`flex min-w-[120px] flex-col items-center justify-center border-y border-l px-4 py-3 ${config.color} ${config.border} ${
                    isLast ? "rounded-r-lg border-r" : ""
                  } ${idx === 0 ? "rounded-l-lg" : ""}`}
                >
                  <span className="text-lg font-bold tabular-nums">{count.toLocaleString()}</span>
                  <span className="mt-0.5 text-center text-[10px] font-semibold uppercase leading-tight tracking-wide">
                    {config.label}
                  </span>
                </div>

                {!isLast ? (
                  <div className="relative z-10 flex w-5 shrink-0 items-stretch">
                    <svg
                      viewBox="0 0 20 60"
                      className="h-full min-h-[72px] w-5"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <polygon
                        points="0,0 20,30 0,60"
                        fill={config.hex}
                        fillOpacity={0.35}
                      />
                    </svg>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

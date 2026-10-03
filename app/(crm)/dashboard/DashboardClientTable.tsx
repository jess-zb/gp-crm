import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DashboardClientRow } from "./dashboard-types";

function DaysInStageBadge({ date }: { date: string | null | undefined }) {
  if (!date) {
    return (
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600 dark:bg-[#242424] dark:text-slate-400">
        —
      </span>
    );
  }
  const days = Math.floor(
    (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
  );
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs tabular-nums ${
        days > 7
          ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
          : days > 3
            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            : "bg-slate-100 text-slate-600 dark:bg-[#242424] dark:text-slate-400"
      }`}
    >
      {days}d
    </span>
  );
}

export function DashboardClientTable({
  title,
  subtitle,
  clients,
  emptyMessage,
  columns,
  alertColor,
}: {
  title: string;
  subtitle?: string;
  clients: DashboardClientRow[];
  emptyMessage: string;
  columns: string[];
  alertColor?: "amber" | "red";
  stageColor?: string;
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-[#2E2E2E]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>
          {clients.length > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                alertColor === "red"
                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : alertColor === "amber"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                    : "bg-slate-100 text-slate-600 dark:bg-[#242424] dark:text-slate-400"
              }`}
            >
              {clients.length}
            </span>
          ) : null}
        </div>
      </div>

      {clients.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-[#2E2E2E]">
          {clients.slice(0, 8).map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-[#242424]/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {c.first_name} {c.last_name}
                </p>
                {columns.includes("phone") && c.phone_mobile ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {c.phone_mobile}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {columns.includes("sub_status") && c.sub_status ? (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    {c.sub_status.replace(/_/g, " ")}
                  </span>
                ) : null}
                {columns.includes("poa_status") ? (
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      c.poa_signed_at || c.poa_signed_date
                        ? "bg-green-100 text-green-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                    }`}
                  >
                    {c.poa_signed_at || c.poa_signed_date ? "POA ✓" : "No POA"}
                  </span>
                ) : null}
                {columns.includes("days_in_stage") ? (
                  <DaysInStageBadge date={c.stage_entered_at} />
                ) : null}
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </Link>
          ))}
          {clients.length > 8 ? (
            <div className="px-4 py-2.5 text-center">
              <Link
                href="/clients"
                className="text-xs text-[#A87830] hover:underline dark:text-[#A87830]"
              >
                +{clients.length - 8} more →
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

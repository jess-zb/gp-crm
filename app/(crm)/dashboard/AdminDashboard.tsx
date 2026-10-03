import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getStageConfig } from "@/lib/constants/stages";
import { formatRelativeTime } from "@/lib/utils/dates";
import type { AlertClientRow, TeamActivityRow } from "./dashboard-types";

function AlertRow({
  type,
  label,
  detail,
  href,
}: {
  type: "warning" | "error";
  label: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-[#242424]/40"
    >
      <div
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
          type === "error" ? "bg-red-500" : "bg-amber-500"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {label}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
    </Link>
  );
}

function clientName(c: AlertClientRow) {
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client";
}

export function AdminDashboard({
  teamActivity,
  rnaClients,
  stuckClients,
  missingPoa,
}: {
  teamActivity: TeamActivityRow[];
  rnaClients: AlertClientRow[];
  stuckClients: AlertClientRow[];
  missingPoa: AlertClientRow[];
}) {
  const hasAlerts =
    (rnaClients?.length ?? 0) > 0 ||
    (stuckClients?.length ?? 0) > 0 ||
    (missingPoa?.length ?? 0) > 0;

  return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-[#2E2E2E]">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Team Activity Today
          </h3>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-[#2E2E2E]">
          {teamActivity.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No stage advances yet today
            </p>
          ) : (
            teamActivity.map((a, i) => {
              const stage =
                a.new_value && typeof a.new_value === "object"
                  ? (a.new_value as { stage?: string }).stage
                  : undefined;
              return (
                <div
                  key={`${a.created_at}-${i}`}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {a.client?.first_name} {a.client?.last_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Advanced by {a.performed_by_name ?? "Staff"}
                      {stage ? ` → ${getStageConfig(stage).label}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                    {formatRelativeTime(a.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-[#2E2E2E]">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Alerts
          </h3>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-[#2E2E2E]">
          {rnaClients.map((c) => (
            <AlertRow
              key={c.id}
              type="warning"
              label={clientName(c)}
              detail="RNA — Ring No Answer"
              href={`/clients/${c.id}`}
            />
          ))}
          {stuckClients.map((c) => (
            <AlertRow
              key={c.id}
              type="warning"
              label={clientName(c)}
              detail={`Stuck in ${getStageConfig(String(c.stage ?? "")).label} for 7+ days`}
              href={`/clients/${c.id}`}
            />
          ))}
          {missingPoa.map((c) => (
            <AlertRow
              key={c.id}
              type="error"
              label={clientName(c)}
              detail="14+ days in Client Services, no POA"
              href={`/clients/${c.id}`}
            />
          ))}
          {!hasAlerts ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              ✓ No alerts right now
            </p>
          ) : null}
        </div>
      </div>
      </div>
  );
}

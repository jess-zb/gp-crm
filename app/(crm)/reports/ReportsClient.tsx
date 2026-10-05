"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getStageConfig, PIPELINE_STAGE_ORDER } from "@/lib/constants/stages";
import { REPORTS_VELOCITY_ORDER } from "@/lib/reports/constants";
import type { StageVelocityRow } from "@/lib/reports/stage-velocity";
import { belongsToDepartment } from "@/lib/team/department-members";

export type ReportsTeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_accounts: boolean;
  is_services: boolean;
};

export type StageAdvanceEvent = {
  performed_by: string | null;
  created_at: string;
};

export type CompletedAppointmentEvent = {
  assigned_to: string | null;
  completed_at: string;
};

type DateRangeKey = "7d" | "30d" | "90d";
type DeptFilterKey = "all" | "accounts" | "services";

function getSinceIso(range: DateRangeKey): string {
  const now = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function getDepartmentLabel(m: ReportsTeamMember): string {
  const parts: string[] = [];
  if (belongsToDepartment(m, "is_accounts")) parts.push("Account Manager");
  if (belongsToDepartment(m, "is_services")) parts.push("Client Services");
  if (parts.length === 0) return "—";
  return parts.join(", ");
}

function matchesDept(m: ReportsTeamMember, dept: DeptFilterKey): boolean {
  if (dept === "all") return true;
  if (dept === "accounts") return belongsToDepartment(m, "is_accounts");
  return belongsToDepartment(m, "is_services");
}

export function ReportsClient({
  stageTotals,
  totalActive,
  velocityRows,
  teamMembers,
  assignedByUser,
  stageAdvanceEvents,
  completedAppointments,
  newClientTimestamps,
  canExportCsv,
}: {
  stageTotals: Record<string, number>;
  totalActive: number;
  velocityRows: StageVelocityRow[];
  teamMembers: ReportsTeamMember[];
  assignedByUser: Record<string, number>;
  stageAdvanceEvents: StageAdvanceEvent[];
  completedAppointments: CompletedAppointmentEvent[];
  newClientTimestamps: string[];
  canExportCsv: boolean;
}) {
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const [deptFilter, setDeptFilter] = useState<DeptFilterKey>("all");

  const sinceMs = useMemo(
    () => new Date(getSinceIso(dateRange)).getTime(),
    [dateRange]
  );

  const activityStats = useMemo(() => {
    const stageAdvances = stageAdvanceEvents.filter(
      (e) => new Date(e.created_at).getTime() >= sinceMs
    ).length;
    const appointmentsCompleted = completedAppointments.filter(
      (e) =>
        e.completed_at && new Date(e.completed_at).getTime() >= sinceMs
    ).length;
    const newClients = newClientTimestamps.filter(
      (ts) => new Date(ts).getTime() >= sinceMs
    ).length;
    return { stageAdvances, appointmentsCompleted, newClients };
  }, [
    sinceMs,
    stageAdvanceEvents,
    completedAppointments,
    newClientTimestamps,
  ]);

  const advancesByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of stageAdvanceEvents) {
      if (!e.performed_by) continue;
      if (new Date(e.created_at).getTime() < sinceMs) continue;
      map.set(e.performed_by, (map.get(e.performed_by) ?? 0) + 1);
    }
    return map;
  }, [stageAdvanceEvents, sinceMs]);

  const appointmentsByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of completedAppointments) {
      if (!e.assigned_to || !e.completed_at) continue;
      if (new Date(e.completed_at).getTime() < sinceMs) continue;
      map.set(e.assigned_to, (map.get(e.assigned_to) ?? 0) + 1);
    }
    return map;
  }, [completedAppointments, sinceMs]);

  const teamPerformance = useMemo(() => {
    return teamMembers
      .filter((m) => matchesDept(m, deptFilter))
      .map((m) => ({
        id: m.id,
        full_name:
          m.full_name?.trim() || m.email?.trim() || "—",
        department: getDepartmentLabel(m),
        advances: advancesByUser.get(m.id) ?? 0,
        appointments_completed: appointmentsByUser.get(m.id) ?? 0,
        assigned_count: assignedByUser[m.id] ?? 0,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [
    teamMembers,
    deptFilter,
    advancesByUser,
    appointmentsByUser,
    assignedByUser,
  ]);

  const pieData = useMemo(
    () =>
      PIPELINE_STAGE_ORDER.map((stage) => ({
        name: getStageConfig(stage).label,
        value: stageTotals[stage] ?? 0,
        color: getStageConfig(stage).hex,
      })).filter((d) => d.value > 0),
    [stageTotals]
  );

  const orderedVelocity = useMemo(() => {
    const byStage = new Map(velocityRows.map((r) => [r.stage, r]));
    return REPORTS_VELOCITY_ORDER.map((stage) => {
      const row = byStage.get(stage);
      return (
        row ?? {
          stage,
          label: getStageConfig(stage).label,
          avgDays: null,
          fastestDays: null,
          slowestDays: null,
          sampleCount: 0,
        }
      );
    });
  }, [velocityRows]);

  const handleExportCSV = () => {
    if (!canExportCsv) return;
    const rows = teamPerformance.map((m) => [
      m.full_name,
      m.department,
      m.advances,
      m.appointments_completed,
      m.assigned_count,
    ]);
    const csv = [
      [
        "Name",
        "Department",
        "Stage Advances",
        "Appointments",
        "Assigned Clients",
      ],
      ...rows,
    ]
      .map((r) => r.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-performance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
      <nav
        className="mb-4 text-[13px] text-slate-500 dark:text-slate-400"
        aria-label="Breadcrumb"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href="/dashboard"
              className="font-medium text-[#A87830] hover:text-[#8C6428] dark:text-[#A87830]"
            >
              Dashboard
            </Link>
          </li>
          <li className="text-slate-400" aria-hidden>
            /
          </li>
          <li className="font-medium text-slate-800 dark:text-slate-200">
            Reports
          </li>
        </ol>
      </nav>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Period:
        </span>
        {(["7d", "30d", "90d"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setDateRange(r)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              dateRange === r
                ? "border-[#A87830] bg-[#A87830] text-[#161616]"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-300 dark:hover:bg-[#242424]"
            }`}
          >
            {r === "7d"
              ? "Last 7 days"
              : r === "30d"
                ? "Last 30 days"
                : "Last 90 days"}
          </button>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {activityStats.stageAdvances.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Stage Advances
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            Clients moved forward in pipeline
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {activityStats.appointmentsCompleted.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Appointments Completed
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            Calls and follow-ups logged
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {activityStats.newClients.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            New Clients
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            Added during this period
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          Active Clients by Stage
        </h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          {totalActive.toLocaleString()} active clients across pipeline stages.
        </p>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="40%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${Number(value).toLocaleString()} clients`,
                  name,
                ]}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value, entry) => (
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {value}:{" "}
                    {(entry as { payload?: { value?: number } }).payload
                      ?.value ?? 0}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-slate-500">
            No active clients in pipeline stages.
          </p>
        )}
      </div>

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Team performance
          </h2>
          {canExportCsv ? (
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-300 dark:hover:bg-[#242424]"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          ) : null}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "accounts", "services"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDeptFilter(d)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                deptFilter === d
                  ? "border-[#A87830] bg-[#A87830] text-[#161616]"
                  : "border-slate-200 bg-white text-slate-600 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-300"
              }`}
            >
              {d === "all"
                ? "All Departments"
                : d === "accounts"
                  ? "Account Managers"
                  : "Client Services"}
            </button>
          ))}
        </div>
        <div className="crm-table-wrap">
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]/80">
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Name
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Department
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Advances
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Appointments
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Assigned Clients
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
                {teamPerformance.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-white dark:bg-[#1C1C1C]/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {row.full_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {row.department}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-200">
                      {row.advances.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-200">
                      {row.appointments_completed.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-200">
                      {row.assigned_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
          Stage velocity
        </h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Average time in stage from audit history when available; otherwise
          current tenure.
        </p>
        <div className="crm-table-wrap">
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]/80">
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Stage
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Avg days
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Fastest
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Slowest
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
                {orderedVelocity.map((row) => (
                  <tr
                    key={row.stage}
                    className="bg-white dark:bg-[#1C1C1C]/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {row.label}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-200">
                      {row.avgDays !== null ? row.avgDays : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-200">
                      {row.fastestDays !== null ? row.fastestDays : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-200">
                      {row.slowestDays !== null ? row.slowestDays : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

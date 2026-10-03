"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { USERS_TO_CREATE } from "./users";

type RowStatus =
  | "pending"
  | "creating"
  | "created"
  | "failed"
  | "exists";

type RowState = {
  email: string;
  full_name: string;
  role: string;
  status: RowStatus;
  tempPassword?: string;
  error?: string;
};

type ApiResult =
  | { status: "created"; tempPassword: string }
  | { status: "exists" }
  | { status: "failed"; error?: string };

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function BulkInviteClient({ canExportCsv }: { canExportCsv: boolean }) {
  const initialRows = useMemo<RowState[]>(
    () =>
      USERS_TO_CREATE.map((u) => ({
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        status: "pending" as RowStatus,
      })),
    []
  );

  const [rows, setRows] = useState<RowState[]>(initialRows);
  const [busy, setBusy] = useState(false);

  const updateRow = useCallback((email: string, patch: Partial<RowState>) => {
    setRows((prev) =>
      prev.map((r) => (r.email === email ? { ...r, ...patch } : r))
    );
  }, []);

  const createAll = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setBusy(true);
    try {
      for (const u of USERS_TO_CREATE) {
        updateRow(u.email, { status: "creating", error: undefined });

        let res: Response;
        try {
          res = await fetch("/api/admin/bulk-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: u.email,
              full_name: u.full_name,
              role: u.role,
            }),
          });
        } catch (e) {
          updateRow(u.email, {
            status: "failed",
            error: e instanceof Error ? e.message : String(e),
          });
          continue;
        }

        let json: ApiResult & { error?: string };
        try {
          json = (await res.json()) as ApiResult & { error?: string };
        } catch {
          updateRow(u.email, {
            status: "failed",
            error: "Invalid response",
          });
          continue;
        }

        if (!res.ok && json.status !== "exists" && json.status !== "failed") {
          updateRow(u.email, {
            status: "failed",
            error:
              typeof json.error === "string"
                ? json.error
                : `HTTP ${res.status}`,
          });
          continue;
        }

        if (json.status === "created" && json.tempPassword) {
          updateRow(u.email, {
            status: "created",
            tempPassword: json.tempPassword,
          });
        } else if (json.status === "exists") {
          updateRow(u.email, { status: "exists" });
        } else if (json.status === "failed") {
          updateRow(u.email, {
            status: "failed",
            error: json.error ?? "Unknown error",
          });
        } else {
          updateRow(u.email, {
            status: "failed",
            error: "Unexpected response",
          });
        }
      }
    } finally {
      setBusy(false);
    }
  }, [updateRow]);

  const exportCsv = useCallback(() => {
    if (!canExportCsv) return;
    const header = ["email", "full_name", "role", "status", "temp_password"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          csvEscape(r.email),
          csvEscape(r.full_name),
          csvEscape(r.role),
          csvEscape(r.status),
          csvEscape(r.tempPassword ?? ""),
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-invite-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [canExportCsv, rows]);

  const statusLabel = (r: RowState) => {
    switch (r.status) {
      case "pending":
        return "Pending";
      case "creating":
        return "Creating…";
      case "created":
        return "Created";
      case "exists":
        return "Already exists";
      case "failed":
        return "Failed";
      default:
        return r.status;
    }
  };

  const statusClass = (r: RowState) => {
    switch (r.status) {
      case "pending":
        return "text-slate-500 dark:text-slate-400";
      case "creating":
        return "text-amber-600 dark:text-amber-400";
      case "created":
        return "text-emerald-600 dark:text-emerald-400";
      case "exists":
        return "text-sky-600 dark:text-sky-400";
      case "failed":
        return "text-red-600 dark:text-red-400";
      default:
        return "";
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Bulk User Creation
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            One-time seed from a fixed list. Developer access only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createAll()}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#A87830] px-4 py-2.5 text-sm font-semibold text-[#161616] shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Working…" : "Create All Users"}
          </button>
          {canExportCsv ? (
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200 dark:hover:bg-[#242424]"
          >
            Export results (CSV)
          </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#121212]/80">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Name
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Role
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Status
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Temp password
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Note
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
              {rows.map((r) => (
                <tr key={r.email}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {r.full_name}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {r.email}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">
                    {r.role}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${statusClass(r)}`}
                  >
                    {statusLabel(r)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800 dark:text-slate-200">
                    {r.tempPassword ?? "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {r.status === "exists"
                      ? "Already in system"
                      : r.error ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

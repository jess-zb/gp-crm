"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AttorneyAssignmentHistoryRow,
  AttorneyOption,
  AttorneyQueueClient,
} from "@/lib/attorney-queue/fetch-queue";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { formatDate } from "@/lib/utils/date";
import { assignAttorneyClientsAction } from "./actions";
import { isDeliverableEmail } from "@/lib/email/is-deliverable-email";

function clientName(c: Pick<AttorneyQueueClient, "first_name" | "last_name">) {
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client";
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDate(d, { month: "short", day: "numeric", year: "numeric" });
}

function attorneyLabel(a: AttorneyOption) {
  return a.full_name?.trim() || a.email?.trim() || "Attorney";
}

type Props = {
  initialClients: AttorneyQueueClient[];
  initialHistory: AttorneyAssignmentHistoryRow[];
  attorneys: AttorneyOption[];
};

export function AttorneyQueueClient({
  initialClients,
  initialHistory,
  attorneys,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [clients] = useState(initialClients);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(
    () => new Set()
  );
  const [attorneyId, setAttorneyId] = useState(
    () => attorneys.find((a) => a.id)?.id ?? ""
  );

  const selectedCount = selectedClients.size;

  const clientsMissingDocs = useMemo(() => {
    return Array.from(selectedClients).filter((id) => {
      const c = clients.find((row) => row.id === id);
      return !c || c.documents.length === 0;
    }).length;
  }, [selectedClients, clients]);

  const clientsMissingEmail = useMemo(() => {
    return Array.from(selectedClients).filter((id) => {
      const c = clients.find((row) => row.id === id);
      return !c || !isDeliverableEmail(c.email);
    }).length;
  }, [selectedClients, clients]);

  function toggleClient(clientId: string) {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function toggleAllClients() {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
      return;
    }
    setSelectedClients(new Set(clients.map((c) => c.id)));
  }

  function onAssign() {
    if (!attorneyId) {
      toast.error("Select an attorney.");
      return;
    }
    const clientIds = Array.from(selectedClients);
    if (clientIds.length === 0) {
      toast.error("Select at least one client.");
      return;
    }

    startTransition(async () => {
      const result = await assignAttorneyClientsAction({
        clientIds,
        attorneyId,
      });
      if (!result.ok) {
        toast.error(toUserFacingError(result.error));
        return;
      }
      toast.success(
        `Assigned ${result.clientCount} client${result.clientCount === 1 ? "" : "s"} to ${result.attorneyName}. Client and attorney notification emails sent.`
      );
      if (result.warnings.length > 0) {
        toast.warning(result.warnings.join(" "));
      }
      setSelectedClients(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C] sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Ready to assign
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {clients.length} client{clients.length === 1 ? "" : "s"} in Case
              Sent, not yet released to an attorney portal
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleAllClients}
              disabled={clients.length === 0 || pending}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
            >
              {selectedClients.size === clients.length && clients.length > 0
                ? "Clear selection"
                : "Select all"}
            </button>
            <button
              type="button"
              onClick={onAssign}
              disabled={selectedCount === 0 || !attorneyId || pending}
              className="rounded-lg bg-[#A87830] px-4 py-1.5 text-xs font-semibold text-[#161616] disabled:opacity-50"
            >
              {pending
                ? "Assigning…"
                : `Assign to attorney (${selectedCount})`}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-4">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Assign to attorney
            </span>
            <select
              value={attorneyId}
              onChange={(e) => setAttorneyId(e.target.value)}
              disabled={attorneys.length === 0 || pending}
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#2E2E2E] dark:bg-[#0a1a2a] dark:text-[#E8EAEE]"
            >
              {attorneys.length === 0 ? (
                <option value="">No active attorneys</option>
              ) : (
                attorneys.map((a) => (
                  <option key={a.id} value={a.id}>
                    {attorneyLabel(a)}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        {selectedCount > 0 && clientsMissingEmail > 0 ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
            {clientsMissingEmail} selected client
            {clientsMissingEmail === 1 ? "" : "s"} missing a valid email —
            add an email on the client profile before assigning.
          </div>
        ) : null}

        {selectedCount > 0 && clientsMissingDocs > 0 ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            {clientsMissingDocs} selected client
            {clientsMissingDocs === 1 ? "" : "s"} missing POA or collection
            letter — assign anyway only if files are being uploaded separately.
          </div>
        ) : null}

        {clients.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No clients waiting in the attorney queue.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2E2E2E]">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-[#2E2E2E]">
              <thead className="bg-slate-50 dark:bg-[#0a1a2a]/80">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Client
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Files on file
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Default attorney
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Case sent
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
                {clients.map((c) => {
                  const name = clientName(c);
                  const isSelected = selectedClients.has(c.id);
                  const poaCount = c.documents.filter((d) => d.kind === "poa").length;
                  const letterCount = c.documents.filter(
                    (d) => d.kind === "collection_letter"
                  ).length;

                  return (
                    <tr key={c.id} className="align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleClient(c.id)}
                          aria-label={`Select ${name}`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/clients/${c.id}`}
                          className="font-medium text-[#161616] hover:underline dark:text-[#A87830]"
                        >
                          {name}
                        </Link>
                        {!isDeliverableEmail(c.email) ? (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            No valid email on file
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {c.documents.length === 0 ? (
                          <span className="text-amber-700 dark:text-amber-300">
                            No POA / collection letter yet
                          </span>
                        ) : (
                          <>
                            {poaCount} POA · {letterCount} letter
                            {letterCount === 1 ? "" : "s"}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {c.attorney_name ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {formatWhen(c.case_sent_to_attorney_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C] sm:p-5">
        <h2 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
          Recent assignments
        </h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Clients released to attorney portal access
        </p>

        {initialHistory.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No portal assignments yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2E2E2E]">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-[#2E2E2E]">
              <thead className="bg-slate-50 dark:bg-[#0a1a2a]/80">
                <tr>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Assigned
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Client
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Attorney
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
                {initialHistory.map((row) => {
                  const name = clientName(row);
                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                        {formatWhen(row.assigned_at)}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/clients/${row.id}`}
                          className="font-medium text-[#161616] hover:underline dark:text-[#A87830]"
                        >
                          {name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {row.attorney_name ?? (
                          <span className="text-amber-700 dark:text-amber-300">
                            Unrecorded
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {row.assigned_by_name ?? "Staff"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

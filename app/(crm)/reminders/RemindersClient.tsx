"use client";

import { useMemo, useState, useTransition, useDeferredValue } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { deleteReminder, createReminder } from "./actions";

export type ReminderRow = {
  id: string;
  description: string;
  due_date: string | null;
  client_id: string | null;
  clientName: string;
  assigneeName: string;
};

export function ReminderRowActions({ reminderId }: { reminderId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm("Delete this appointment?")) return;
    startTransition(async () => {
      const r = await deleteReminder(reminderId);
      if (r.ok) {
        toast.success("Appointment deleted");
        router.refresh();
      } else {
        toast.error(toUserFacingError(r.error));
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={onDelete}
        className="inline-flex rounded-lg border border-red-200 bg-white p-2 text-red-600 shadow-sm transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-red-900/50 dark:bg-[#1C1C1C] dark:text-red-400 dark:hover:bg-red-950/40 disabled:opacity-50"
        title="Delete"
        aria-label="Delete appointment"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}

export function AddReminderButton({
  clients,
  teamMembers,
}: {
  clients: { id: string; label: string }[];
  teamMembers: { id: string; full_name: string | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [clientQuery, setClientQuery] = useState("");
  const deferredClientQuery = useDeferredValue(clientQuery);
  const [clientId, setClientId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const filteredClients = useMemo(() => {
    const q = deferredClientQuery.toLowerCase().trim();
    const base = q
      ? clients.filter((c) => c.label.toLowerCase().includes(q))
      : clients;
    if (clientId) {
      const sel = clients.find((c) => c.id === clientId);
      if (sel && !base.some((c) => c.id === clientId)) {
        return [sel, ...base];
      }
    }
    return base;
  }, [clients, deferredClientQuery, clientId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);

    const errors: Record<string, string> = {};
    const description = fd.get("description") as string;
    const dueDate = fd.get("due_date") as string;

    if (!clientId) {
      errors.clientId = "Client is required.";
    }
    if (!description?.trim()) {
      errors.description = "Appointment description is required.";
    }
    if (!dueDate) {
      errors.dueDate = "Due date is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    startTransition(async () => {
      const r = await createReminder(fd);
      if (r.ok) {
        toast.success("Appointment added");
        setOpen(false);
        setClientQuery("");
        setClientId("");
        setFieldErrors({});
        router.refresh();
      } else {
        toast.error(toUserFacingError(r.error));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="crm-btn-primary inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] focus-visible:ring-offset-2"
      >
        Add Appointment
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-reminder-title"
          >
            <h2
              id="add-reminder-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Add Appointment
            </h2>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="apt-client-search"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Client
                </label>
                <input type="hidden" name="client_id" value={clientId} required />
                <input
                  id="apt-client-search"
                  type="text"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  placeholder="Search by name…"
                  className={`mb-2 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                    fieldErrors.clientId
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                      : "border-slate-200 dark:border-[#2E2E2E]"
                  }`}
                  autoComplete="off"
                />
                <select
                  id="apt-client-id"
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    const c = clients.find((x) => x.id === e.target.value);
                    if (c) setClientQuery(c.label);
                  }}
                  required
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                    fieldErrors.clientId
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                      : "border-slate-200 dark:border-[#2E2E2E]"
                  }`}
                >
                  <option value="">Select client…</option>
                  {filteredClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.clientId ? (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {fieldErrors.clientId}
                  </p>
                ) : null}
              </div>
              <div className="block text-sm">
                <label
                  htmlFor="apt-description"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Appointment
                </label>
                <textarea
                  id="apt-description"
                  name="description"
                  required
                  rows={3}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                    fieldErrors.description
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                      : "border-slate-200 dark:border-[#2E2E2E]"
                  }`}
                />
                {fieldErrors.description ? (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {fieldErrors.description}
                  </p>
                ) : null}
              </div>
              <div className="block text-sm">
                <label
                  htmlFor="apt-due-date"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Due date
                </label>
                <input
                  id="apt-due-date"
                  type="date"
                  name="due_date"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                    fieldErrors.dueDate
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                      : "border-slate-200 dark:border-[#2E2E2E]"
                  }`}
                />
                {fieldErrors.dueDate ? (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {fieldErrors.dueDate}
                  </p>
                ) : null}
              </div>
              <div className="block text-sm">
                <label
                  htmlFor="apt-assigned-to"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Assign to
                </label>
                <select
                  id="apt-assigned-to"
                  name="assigned_to"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                >
                  <option value="">—</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name?.trim() || m.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="crm-btn-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !clientId}
                  className="crm-btn-primary inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] focus-visible:ring-offset-2"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

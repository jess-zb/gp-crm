"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import {
  getAppointmentTypesForStage,
  type StageAppointmentTypeDef,
} from "@/lib/constants/appointment-types";
import { normalizePipelineStage } from "@/lib/clients/pipeline-status";
import { buildSearchQuery } from "@/lib/clients/client-search";
import { createAppointmentFromModal } from "./actions";

export type TeamMemberOption = { id: string; full_name: string | null };

type SearchClient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_mobile: string | null;
  stage: string | null;
  email: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  fedex_tracking_number: string | null;
  assigned_to: string | null;
};

export function AddAppointmentModal({
  open,
  onClose,
  teamMembers,
}: {
  open: boolean;
  onClose: () => void;
  teamMembers: TeamMemberOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [clientSearch, setClientSearch] = useState("");
  const deferredClientSearch = useDeferredValue(clientSearch);
  const [searchResults, setSearchResults] = useState<SearchClient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<SearchClient | null>(null);

  const [appointmentType, setAppointmentType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const availableTypes = useMemo((): StageAppointmentTypeDef[] => {
    if (!selectedClient?.stage) return getAppointmentTypesForStage("lead");
    return getAppointmentTypesForStage(normalizePipelineStage(selectedClient.stage));
  }, [selectedClient?.stage]);

  const selectedTypeDef = useMemo(
    () => availableTypes.find((t) => t.value === appointmentType),
    [availableTypes, appointmentType]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setCurrentUserId(user.id);
      setAssignedTo((prev) => prev || user.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setClientSearch("");
      setSearchResults([]);
      setSelectedClient(null);
      setAppointmentType("");
      setDueDate("");
      setDueTime("09:00");
      setNotes("");
      setAssignedTo("");
      setFieldErrors({});
      return;
    }
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    const t = q.trim();
    if (t.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const supabase = createClient();
    const orFrag = buildSearchQuery(t);
    if (!orFrag) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, first_name, last_name, phone_mobile, stage, email, spouse_first_name, spouse_last_name, fedex_tracking_number, assigned_to"
      )
      .or(orFrag)
      .limit(8);
    setSearching(false);
    if (error) {
      console.warn("[AddAppointmentModal] search", error.message);
      setSearchResults([]);
      return;
    }
    setSearchResults((data ?? []) as SearchClient[]);
  }, []);

  useEffect(() => {
    if (!open) return;
    void runSearch(deferredClientSearch);
  }, [deferredClientSearch, open, runSearch]);

  const handleSelectClient = (client: SearchClient) => {
    setSelectedClient(client);
    setSearchResults([]);
    setClientSearch(
      `${String(client.first_name ?? "").trim()} ${String(client.last_name ?? "").trim()}`.trim() ||
        "Client"
    );
    setAppointmentType("");
    // Default assignee to the client's assigned AM; fall back to current user
    if (client.assigned_to) {
      setAssignedTo(client.assigned_to);
    }
  };

  const onSubmit = () => {
    const errors: Record<string, string> = {};
    if (!selectedClient?.id) errors.client = "Please select a client.";
    if (!appointmentType) errors.type = "Please select an appointment type.";
    if (!dueDate.trim()) errors.date = "Please select a date.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in all required fields.");
      return;
    }
    setFieldErrors({});

    const label = selectedTypeDef?.label ?? appointmentType;
    const pipeline = selectedTypeDef?.pipeline ?? "sales";
    const local = new Date(`${dueDate.trim()}T${(dueTime || "09:00").trim()}:00`);
    if (Number.isNaN(local.getTime())) {
      toast.error("Invalid date or time.");
      return;
    }

    startTransition(async () => {
      if (!selectedClient?.id) return;
      const res = await createAppointmentFromModal({
        client_id: selectedClient.id,
        appointment_type: appointmentType,
        description: label,
        due_date_iso: local.toISOString(),
        assigned_to: assignedTo.trim() || currentUserId,
        notes: notes.trim() || null,
        pipeline_type: pipeline,
      });
      if (!res.ok) {
        toast.error(toUserFacingError(res.error));
        return;
      }
      toast.success("Appointment added");
      onClose();
      router.refresh();
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-[600px] max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-appointment-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-6 pb-4 pt-6">
          <h3 id="add-appointment-title" className="crm-modal-title">
            Add Appointment
          </h3>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <div className="relative mb-4">
            <label
              htmlFor="client-search-input"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Client search <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                id="client-search-input"
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  if (selectedClient) setSelectedClient(null);
                }}
                placeholder="Name, phone, email, or tracking (min 2 characters)…"
                className={`crm-input pr-24 ${fieldErrors.client ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
                autoComplete="off"
                aria-invalid={!!fieldErrors.client}
                aria-describedby={fieldErrors.client ? "client-error" : undefined}
              />
              {searching ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400">
                  Searching…
                </span>
              ) : null}
              {searchResults.length > 0 && !selectedClient ? (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]"
                  role="listbox"
                >
                  <ul className="py-1">
                    {searchResults.map((c) => (
                      <li key={c.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-[#102840]"
                          onClick={() => handleSelectClient(c)}
                        >
                          {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client"}{" "}
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {c.phone_mobile || c.email || ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {fieldErrors.client && (
              <p id="client-error" className="mt-1 text-xs text-red-500">
                {fieldErrors.client}
              </p>
            )}
          </div>

          {!selectedClient ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
              <span className="text-xs text-amber-800 dark:text-amber-200">
                Select a client first — appointment types will update to match their current
                stage.
              </span>
            </div>
          ) : null}

          <label className="mb-4 block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Appointment type <span className="text-red-500">*</span>
            </span>
            <select
              value={appointmentType}
              disabled={!selectedClient}
              onChange={(e) => setAppointmentType(e.target.value)}
              className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:bg-[#071929] dark:text-white ${
                fieldErrors.type ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-[#1a3550]"
              }`}
              aria-invalid={!!fieldErrors.type}
              aria-describedby={fieldErrors.type ? "type-error" : undefined}
            >
              <option value="">Select type…</option>
              {availableTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {fieldErrors.type && (
              <p id="type-error" className="mt-1 text-xs text-red-500">
                {fieldErrors.type}
              </p>
            )}
          </label>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Date <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:bg-[#071929] dark:text-white ${
                  fieldErrors.date ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-[#1a3550]"
                }`}
                aria-invalid={!!fieldErrors.date}
                aria-describedby={fieldErrors.date ? "date-error" : undefined}
              />
              {fieldErrors.date && (
                <p id="date-error" className="mt-1 text-xs text-red-500">
                  {fieldErrors.date}
                </p>
              )}
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Time</span>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              />
            </label>
          </div>

          <label className="mb-4 block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
            />
          </label>

          <label className="mb-2 block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Assigned to</span>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
            >
              <option value="">—</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name?.trim() || m.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex-shrink-0 border-t border-gray-100 px-6 pb-6 pt-4 dark:border-[#1a3550]">
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="crm-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onSubmit}
              className="crm-btn-primary min-w-[80px] disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

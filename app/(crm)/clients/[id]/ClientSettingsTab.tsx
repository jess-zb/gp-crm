"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { isHiddenFromRole } from "@/lib/constants/hidden-accounts";
import { getRoleDisplayName } from "@/lib/utils/roles";
import { isDevOrAdmin } from "@/lib/roles";
import { normalizePipelineStage } from "@/lib/clients/pipeline-status";
import {
  filterByDepartment,
  type DepartmentMemberOption,
} from "@/lib/team/department-members";
import { reassignAccountsUser, updateClientSettings } from "./actions";

export type ClientSettingsTabClient = {
  stage: string | null;
  assigned_to: string | null;
  assigned_compliance_id: string | null;
  assigned_services_id: string | null;
  attorney_id: string | null;
  attorney: { full_name: string | null; email: string | null } | null;
  is_active: boolean | null;
};

type StaffOption = DepartmentMemberOption;

type AttorneyOption = StaffOption & {
  is_default_attorney?: boolean | null;
};

export function ClientSettingsTab({
  clientId,
  client,
  canReassignClient,
  canViewAssignedAttorneyField,
  viewerRole,
  userRole,
  staffOptions,
  attorneyOptions,
  assigneeName,
  assigneeRole,
  complianceAssigneeName,
  servicesAssigneeName,
  isComplianceUser,
}: {
  clientId: string;
  client: ClientSettingsTabClient;
  canReassignClient: boolean;
  canViewAssignedAttorneyField: boolean;
  viewerRole: string;
  /** Same as viewer profile role; used to gate attorney dropdown (dev/admin only). */
  userRole: string;
  staffOptions: StaffOption[];
  attorneyOptions: AttorneyOption[];
  assigneeName: string | null;
  assigneeRole?: string | null;
  complianceAssigneeName?: string | null;
  servicesAssigneeName?: string | null;
  isComplianceUser?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [recordActive, setRecordActive] = useState(client.is_active !== false);
  const toggleBusyRef = useRef(false);

  // Compliance-user accounts reassignment flow
  const [complianceSelectedId, setComplianceSelectedId] = useState(client.assigned_to ?? "");
  const [showComplianceConfirm, setShowComplianceConfirm] = useState(false);
  const [isComplianceAssigning, setIsComplianceAssigning] = useState(false);

  const initialStage = normalizePipelineStage(client.stage);

  useEffect(() => {
    setRecordActive(client.is_active !== false);
  }, [client.is_active]);

  const visibleStaff = staffOptions.filter(
    (s) =>
      !isHiddenFromRole(s.email, viewerRole) ||
      (client.assigned_to && s.id === client.assigned_to) ||
      (client.assigned_compliance_id && s.id === client.assigned_compliance_id) ||
      (client.assigned_services_id && s.id === client.assigned_services_id)
  );
  const complianceOptions = filterByDepartment(
    visibleStaff,
    "is_compliance",
    client.assigned_compliance_id
  );
  const accountsOptions = filterByDepartment(
    visibleStaff,
    "is_accounts",
    client.assigned_to
  );
  const servicesOptions = filterByDepartment(
    visibleStaff,
    "is_services",
    client.assigned_services_id
  );

  const handleToggleActive = useCallback(async () => {
    if (toggleBusyRef.current) return;
    toggleBusyRef.current = true;
    try {
      const supabase = createClient();
      const next = !recordActive;
      const { error } = await supabase
        .from("clients")
        .update({ is_active: next })
        .eq("id", clientId);
      if (error) throw error;
      setRecordActive(next);
      toast.success(next ? "Record marked active" : "Record archived");
      router.refresh();
    } catch (e) {
      toast.error(toUserFacingError(e instanceof Error ? e.message : "Update failed"));
    } finally {
      toggleBusyRef.current = false;
    }
  }, [clientId, recordActive, router, toast]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    setIsSaving(true);
    try {
      const res = await updateClientSettings(fd);
      if (!res || !res.ok) {
        toast.error(toUserFacingError(res?.error ?? "An unexpected error occurred. Please refresh the page."));
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error("An unexpected error occurred. Please refresh the page.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
      <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Client settings</h3>
      <form onSubmit={onSubmit} className="space-y-6">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="stage" value={initialStage} />

        <div className="grid gap-4 md:grid-cols-2">
          {canReassignClient ? (
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">Compliance</span>
              <select
                name="assigned_compliance_id"
                defaultValue={client.assigned_compliance_id ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              >
                <option value="">Unassigned</option>
                {complianceOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name?.trim() || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canReassignClient ? (
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">Accounts</span>
              <select
                name="assigned_to"
                defaultValue={client.assigned_to ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              >
                <option value="">Unassigned</option>
                {accountsOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name?.trim() || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canReassignClient ? (
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">Services</span>
              <select
                name="assigned_services_id"
                defaultValue={client.assigned_services_id ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              >
                <option value="">Unassigned</option>
                {servicesOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name?.trim() || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!canReassignClient ? (
            <>
              <div className="text-sm md:col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Compliance</span>
                <p className="mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-800 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-200">
                  {complianceAssigneeName ?? "—"}
                </p>
              </div>
              {isComplianceUser ? (
                <div className="text-sm md:col-span-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Accounts</span>
                  <select
                    value={complianceSelectedId}
                    onChange={(e) => setComplianceSelectedId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
                  >
                    <option value="">Unassigned</option>
                    {accountsOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name?.trim() || s.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={complianceSelectedId === (client.assigned_to ?? "")}
                    onClick={() => setShowComplianceConfirm(true)}
                    className="mt-2 rounded-lg bg-[#8DE3B5] px-4 py-1.5 text-xs font-medium text-[#0A2540] transition-colors hover:bg-[#6BC99A] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reassign Accounts User
                  </button>
                </div>
              ) : (
                <div className="text-sm md:col-span-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Accounts</span>
                  <p className="mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-800 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-200">
                    {assigneeName ?? "—"}
                    {assigneeName && assigneeRole ? (
                      <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                        {getRoleDisplayName(assigneeRole)}
                      </span>
                    ) : null}
                  </p>
                </div>
              )}
              <div className="text-sm md:col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Services</span>
                <p className="mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-800 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-200">
                  {servicesAssigneeName ?? "—"}
                </p>
              </div>
            </>
          ) : null}

          {canViewAssignedAttorneyField ? (
            isDevOrAdmin(userRole) ? (
              <label className="block text-sm md:col-span-2">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                  Assigned Attorney
                </span>
                <select
                  name="attorney_id"
                  defaultValue={client.attorney_id ?? ""}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-slate-900 focus:border-green-500 focus:outline-none dark:border-[#1a3550] dark:bg-[#071929] dark:text-white dark:focus:border-green-500"
                >
                  <option value="">No attorney assigned</option>
                  {attorneyOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name?.trim() || a.id.slice(0, 8)}
                      {a.is_default_attorney ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  When a collection letter is uploaded, the attorney will automatically be notified
                  through their portal.
                </p>
              </label>
            ) : (
              <div className="text-sm md:col-span-2">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                  Assigned Attorney
                </span>
                <p className="mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-gray-700 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-200">
                  {client.attorney_id
                    ? client.attorney?.full_name?.trim() ||
                      client.attorney?.email?.trim() ||
                      attorneyOptions.find((a) => a.id === client.attorney_id)?.full_name?.trim() ||
                      "—"
                    : "—"}
                </p>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  When a collection letter is uploaded, the attorney will automatically be notified
                  through their portal.
                </p>
              </div>
            )
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-[#1a3550]">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-slate-400">Record Status</span>
            <button
              type="button"
              onClick={() => void handleToggleActive()}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                recordActive ? "bg-[#8DE3B5]" : "bg-gray-300 dark:bg-slate-600"
              }`}
              aria-pressed={recordActive}
              aria-label={recordActive ? "Mark archived" : "Mark active"}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  recordActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${
                recordActive ? "text-[#8DE3B5] dark:text-[#8DE3B5]" : "text-gray-400 dark:text-slate-500"
              }`}
            >
              {recordActive ? "Active" : "Archived"}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-[#8DE3B5] px-5 py-2.5 text-sm font-medium text-[#0A2540] transition-colors hover:bg-[#6BC99A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>

      {showComplianceConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#1a3550] dark:bg-[#0d2035]">
            <h4 className="mb-1 text-base font-bold text-slate-900 dark:text-white">Reassign Accounts User?</h4>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              This change will be logged in the activity feed.
            </p>
            <div className="mb-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-slate-500 dark:text-slate-400">Currently:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{assigneeName || "Unassigned"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-slate-500 dark:text-slate-400">Reassign to:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {accountsOptions.find((s) => s.id === complianceSelectedId)?.full_name?.trim() || "Unassigned"}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowComplianceConfirm(false)}
                disabled={isComplianceAssigning}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-[#1a3550] dark:text-slate-300 dark:hover:bg-[#071929]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isComplianceAssigning}
                onClick={async () => {
                  setIsComplianceAssigning(true);
                  try {
                    const res = await reassignAccountsUser(clientId, complianceSelectedId || null);
                    if (!res?.ok) {
                      toast.error(toUserFacingError(res?.error ?? "Reassignment failed"));
                      return;
                    }
                    toast.success("Accounts user reassigned");
                    setShowComplianceConfirm(false);
                    router.refresh();
                  } catch {
                    toast.error("An unexpected error occurred. Please refresh the page.");
                  } finally {
                    setIsComplianceAssigning(false);
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-[#8DE3B5] px-4 py-2 text-sm font-medium text-[#0A2540] transition-colors hover:bg-[#6BC99A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isComplianceAssigning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm Reassignment"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

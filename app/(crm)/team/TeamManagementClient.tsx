"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pencil, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { toUserFacingError } from "@/lib/user-facing-error";
import { STARRED_EMAILS, STARRED_MEDALS } from "@/lib/team/starred";
import { getRoleDisplayName } from "@/lib/utils/roles";
import type { DeptProfileField } from "./DeptCheckbox";

export type TeamMemberRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean | null;
  is_accounts: boolean;
  is_services: boolean;
};

const DEPARTMENTS: { key: DeptProfileField; label: string }[] = [
  { key: "is_accounts", label: "Account Managers" },
  { key: "is_services", label: "Client Services" },
];

type StaffRole =
  | "dev"
  | "admin"
  | "acct_manager"
  | "attorney"
  | "client";

function getInitials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return "?";
}

function DeptCheckboxInline({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded accent-[#A87830]"
      />
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
    </label>
  );
}

function roleBadgeClass(role: string) {
  switch (role) {
    case "dev":
      return "bg-purple-900 text-purple-100";
    case "admin":
      return "bg-green-800 text-green-100";
    case "acct_manager":
      return "bg-blue-600 text-white";
    case "attorney":
      return "bg-purple-600 text-white";
    case "client":
      return "bg-gray-400 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

export function TeamManagementClient({
  members,
  currentUserId,
  viewerProfileRole,
  canInvite,
}: {
  members: TeamMemberRow[];
  currentUserId: string;
  viewerProfileRole: string;
  canInvite?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);

  const [memberList, setMemberList] = useState<TeamMemberRow[]>(members);
  useEffect(() => {
    setMemberList(members);
  }, [members]);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    full_name: "",
    email: "",
    role: "acct_manager" as "admin" | "acct_manager" | "attorney",
  });
  const [inviting, setInviting] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successInviteEmail, setSuccessInviteEmail] = useState("");
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  const [editRow, setEditRow] = useState<TeamMemberRow | null>(null);
  const [editRole, setEditRole] = useState<StaffRole>("acct_manager");
  const [editActive, setEditActive] = useState(true);
  const [editDepts, setEditDepts] = useState<
    Record<DeptProfileField, boolean>
  >({
    is_accounts: false,
    is_services: false,
  });

  const isDevViewer = viewerProfileRole === "dev";
  const isAdminViewer =
    viewerProfileRole === "admin" || viewerProfileRole === "dev";

  const roleOptionsForEdit = useMemo((): StaffRole[] => {
    if (isDevViewer) {
      return ["dev", "admin", "acct_manager", "attorney", "client"];
    }
    if (isAdminViewer) {
      return ["admin", "acct_manager", "attorney", "client"];
    }
    return ["acct_manager"];
  }, [isAdminViewer, isDevViewer]);

  async function updateProfile(
    id: string,
    patch: Record<string, unknown>
  ): Promise<boolean> {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return false;
    }
    return true;
  }

  function openEdit(m: TeamMemberRow) {
    if (m.role === "dev" && !isDevViewer) {
      toast.error("Only a developer can change developer roles.");
      return;
    }
    setEditRow(m);
    setEditRole(m.role as StaffRole);
    setEditActive(m.is_active !== false);
    setEditDepts({
      is_accounts: m.is_accounts,
      is_services: m.is_services,
    });
  }

  function saveEdit() {
    if (!editRow) return;
    const target = editRow;
    if (target.role === "dev" && !isDevViewer) return;
    if (editRole === "dev" && !isDevViewer) {
      toast.error("Only developers can assign the developer role.");
      return;
    }
    if (!editActive && target.id === currentUserId) {
      toast.error("You cannot deactivate your own account here.");
      return;
    }
    startTransition(async () => {
      const patch: Record<string, unknown> = {
        role: editRole,
        is_active: editActive,
      };
      if (editRole === "acct_manager") {
        patch.is_accounts = editDepts.is_accounts;
        patch.is_services = editDepts.is_services;
      }
      const ok = await updateProfile(target.id, patch);
      if (ok) {
        toast.success("Member updated");
        setEditRow(null);
        router.refresh();
      }
    });
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!inviteForm.full_name.trim()) errors.full_name = "Full name is required.";
    if (!inviteForm.email.trim()) errors.email = "Email is required.";

    if (Object.keys(errors).length > 0) {
      setInviteErrors(errors);
      toast.error("Please fill in all fields");
      return;
    }
    setInviteErrors({});

    setInviting(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = (await res.json()) as {
        error?: string;
        tempPassword?: string;
        email?: string;
      };
      if (data.error) {
        toast.error(toUserFacingError(data.error));
        return;
      }
      setSuccessInviteEmail(data.email ?? inviteForm.email.trim());
      setTempPassword(data.tempPassword ?? "");
      setShowInviteModal(false);
      setShowSuccess(true);
      setInviteForm({ full_name: "", email: "", role: "acct_manager" });
      router.refresh();
    } catch {
      toast.error("Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Team management">
        {canInvite ? (
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="crm-btn-primary"
          >
            <UserPlus className="h-4 w-4" />
            Invite Team Member
          </button>
        ) : null}
      </CrmPageHeader>

      <div className="mx-auto min-w-0 w-full max-w-6xl flex-1 overflow-x-hidden px-4 py-5 sm:px-6">
        <p className="mb-5 text-[13px] text-slate-600 dark:text-slate-400">
          Manage staff accounts, roles, and status.
        </p>

        <div className="crm-table-wrap min-w-0">
        <div className="-mx-px overflow-x-auto sm:mx-0">
          <table className="min-w-[480px] w-full text-left">
            <thead>
              <tr className="crm-table-head-row">
                <th className="crm-table-th">Member</th>
                <th className="crm-table-th">Role</th>
                <th className="crm-table-th !text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberList.map((m) => (
                <tr key={m.id} className="crm-table-row">
                  <td className="crm-table-td align-top">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: "#A87830" }}
                      >
                        {getInitials(m.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="crm-table-td-strong">
                          {(() => {
                            const em = m.email?.toLowerCase();
                            if (!em) return null;
                            const idx = STARRED_EMAILS.findIndex(
                              (addr) => addr.toLowerCase() === em
                            );
                            if (idx < 0 || idx >= STARRED_MEDALS.length)
                              return null;
                            return (
                              <span className="mr-1.5" aria-hidden>
                                {STARRED_MEDALS[idx]}
                              </span>
                            );
                          })()}
                          {m.full_name?.trim() || "—"}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {m.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="crm-table-td">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass(m.role)}`}
                    >
                      {getRoleDisplayName(m.role)}
                    </span>
                  </td>
                  <td className="crm-table-td whitespace-nowrap text-right">
                    <button
                      type="button"
                      disabled={
                        pending ||
                        (m.role === "dev" && !isDevViewer) ||
                        (m.role === "admin" &&
                          !(isDevViewer || isAdminViewer))
                      }
                      onClick={() => openEdit(m)}
                      className="inline-flex rounded-md border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200 dark:hover:bg-[#242424]"
                      title="Edit member"
                      aria-label="Edit member"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {showInviteModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setShowInviteModal(false);
          }}
          role="presentation"
        >
          <div
            className="mx-auto max-h-[90vh] w-full max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            role="dialog"
            aria-labelledby="invite-title"
          >
            <h2
              id="invite-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Invite Team Member
            </h2>
            <form onSubmit={handleInvite} className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Full name <span className="text-red-500">*</span>
                </span>
                <input
                  value={inviteForm.full_name}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                  className={`crm-input mt-1 ${
                    inviteErrors.full_name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                  }`}
                  aria-invalid={!!inviteErrors.full_name}
                  aria-describedby={inviteErrors.full_name ? "invite-name-error" : undefined}
                />
                {inviteErrors.full_name && (
                  <p id="invite-name-error" className="mt-1 text-xs text-red-500">
                    {inviteErrors.full_name}
                  </p>
                )}
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Email <span className="text-red-500">*</span>
                </span>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={`crm-input mt-1 ${
                    inviteErrors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                  }`}
                  aria-invalid={!!inviteErrors.email}
                  aria-describedby={inviteErrors.email ? "invite-email-error" : undefined}
                />
                {inviteErrors.email && (
                  <p id="invite-email-error" className="mt-1 text-xs text-red-500">
                    {inviteErrors.email}
                  </p>
                )}
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Role
                </span>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((f) => ({
                      ...f,
                      role: e.target.value as "admin" | "acct_manager" | "attorney",
                    }))
                  }
                  className="crm-input mt-1"
                >
                  <option value="admin">{getRoleDisplayName("admin")}</option>
                  <option value="acct_manager">{getRoleDisplayName("acct_manager")}</option>
                  <option value="attorney">{getRoleDisplayName("attorney")}</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-[#2E2E2E] dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex items-center gap-2 rounded-lg bg-[#A87830] px-4 py-2 text-sm font-semibold text-[#161616] hover:bg-[#8C6428] disabled:opacity-50"
                >
                  {inviting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send Invite"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showSuccess ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="mx-auto w-full max-w-[min(24rem,calc(100vw-2rem))] rounded-xl bg-white p-4 shadow-xl sm:p-6 dark:bg-[#1C1C1C]">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-emerald-950/60">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Team member created!
              </h3>
            </div>
            <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-4 dark:bg-[#121212]">
              <p className="text-sm text-gray-600 dark:text-slate-300">
                <span className="font-medium">Email:</span> {successInviteEmail}
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                <span className="font-medium">Temporary password:</span>{" "}
                <span className="font-mono">{tempPassword}</span>
              </p>
              <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                Please share these credentials securely.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `Email: ${successInviteEmail}\nPassword: ${tempPassword}`
                    );
                    toast.success("Copied to clipboard");
                  } catch {
                    toast.error("Could not copy");
                  }
                }}
                className="flex-1 rounded-lg border border-[#A87830] py-2 text-sm font-medium text-[#A87830] hover:bg-green-50 dark:hover:bg-[#242424]"
              >
                Copy credentials
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSuccess(false);
                  setTempPassword("");
                  setSuccessInviteEmail("");
                }}
                className="flex-1 rounded-lg bg-[#A87830] py-2 text-sm font-medium text-[#161616] hover:bg-[#8C6428]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editRow ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setEditRow(null);
          }}
          role="presentation"
        >
          <div
            className="mx-auto w-full max-w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            role="dialog"
            aria-labelledby="edit-role-title"
          >
            <h2
              id="edit-role-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Edit member
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {editRow.full_name ?? editRow.email}
            </p>
            <label className="mt-4 block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Role
              </span>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as StaffRole)}
                className="crm-input mt-1"
              >
                {roleOptionsForEdit.map((r) => (
                  <option key={r} value={r}>
                    {getRoleDisplayName(r)}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 py-3 dark:border-[#2E2E2E]">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Account Status
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Disable to prevent login
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditActive((p) => !p)}
                disabled={editRow.id === currentUserId && editActive}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                  editActive ? "bg-[#A87830]" : "bg-slate-200 dark:bg-[#2E2E2E]"
                }`}
                aria-pressed={editActive}
              >
                <span
                  className={`mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    editActive ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {editRole === "acct_manager" && isAdminViewer ? (
              <div className="border-t border-slate-100 pt-3 dark:border-[#2E2E2E]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Department Access
                </p>
                <div className="space-y-2">
                  {DEPARTMENTS.map((dept) => (
                    <DeptCheckboxInline
                      key={dept.key}
                      label={dept.label}
                      checked={editDepts[dept.key]}
                      onChange={(v) =>
                        setEditDepts((p) => ({ ...p, [dept.key]: v }))
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-[#2E2E2E] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={pending}
                className="flex items-center gap-2 rounded-lg bg-[#A87830] px-4 py-2 text-sm font-semibold text-[#161616] hover:bg-[#8C6428] disabled:opacity-50"
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
      ) : null}
    </div>
  );
}

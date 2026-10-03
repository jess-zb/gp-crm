"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";

export type CommTemplateRow = {
  id: string;
  name: string;
  type: "email" | "text";
  subject: string | null;
  body: string;
  updated_at: string | null;
  template_key?: string | null;
  sequence_key?: string | null;
  step_order?: number | null;
  day_offset?: number | null;
  is_overridden?: boolean | null;
  is_active?: boolean | null;
  category?: string | null;
  last_edited_at?: string | null;
};

const MERGE_HINT =
  "{{client_name}}, {{first_name}}, {{assigned_user}}, {{stage}}";

const TAB_BTN =
  "rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#A87830]/40";

function previewText(body: string, max = 100) {
  const t = body.trim().replace(/\s+/g, " ");
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function TemplatesClient({ canManage }: { canManage: boolean }) {
  const toast = useToast();

  const [tab, setTab] = useState<"email" | "text">("email");
  const [emailSequencesOnly, setEmailSequencesOnly] = useState(false);
  const [rows, setRows] = useState<CommTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [modalType, setModalType] = useState<"email" | "text">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comm_templates")
      .select(
        "id, name, type, subject, body, updated_at, template_key, sequence_key, step_order, day_offset, is_overridden, is_active, category, last_edited_at"
      )
      .order("name", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      setRows([]);
      return;
    }
    setRows((data ?? []) as CommTemplateRow[]);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (r.type !== tab) return false;
    if (tab === "email" && emailSequencesOnly) {
      return Boolean(r.sequence_key) || Boolean(r.step_order) || Boolean(r.template_key);
    }
    return true;
  });

  const seqTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.type !== "email") continue;
      const k = String(r.sequence_key ?? "").trim();
      if (!k) continue;
      const so = Number(r.step_order ?? 0);
      const cur = m.get(k) ?? 0;
      if (so > cur) m.set(k, so);
    }
    return m;
  }, [rows]);

  function sequenceLabelFromRow(r: CommTemplateRow): string {
    const seq = String(r.sequence_key ?? "").trim();
    const step = r.step_order ?? null;
    const day = r.day_offset ?? null;
    if (!seq || !step) return "—";
    const total = seqTotals.get(seq) ?? step;
    const seqName =
      seq === "active_arc"
        ? "Active"
        : seq === "partial_arc"
          ? "Partial"
          : seq === "welcome_lead"
            ? "Lead"
            : seq === "welcome_cs"
              ? "CS"
              : seq === "case_referred"
                ? "Case Referred"
                : seq === "holiday"
                  ? "Holiday"
                  : seq;
    return `${seqName} ${step}/${total}${day != null ? ` — Day ${day}` : ""}`;
  }

  function overrideBadge(r: CommTemplateRow): { label: string; className: string } | null {
    if (r.is_overridden) {
      const dt = r.last_edited_at ? new Date(r.last_edited_at).toLocaleDateString() : null;
      return {
        label: dt ? `Overridden · ${dt}` : "Overridden",
        className:
          "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-500/30",
      };
    }
    if (r.sequence_key || r.template_key) {
      return {
        label: "Default",
        className:
          "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/15 dark:bg-[#1C1C1C] dark:text-slate-300 dark:ring-[#3d5c3f]/30",
      };
    }
    return null;
  }

  function openAdd() {
    setEditingId(null);
    setName("");
    setModalType(tab);
    setSubject("");
    setBody("");
    setIsActive(true);
    setModalOpen(true);
  }

  function openEdit(row: CommTemplateRow) {
    setEditingId(row.id);
    setName(row.name);
    setModalType(row.type);
    setSubject(row.subject ?? "");
    setBody(row.body);
    setIsActive(row.is_active !== false);
    setModalOpen(true);
  }

  function closeModal() {
    if (!saving) setModalOpen(false);
  }

  async function onSave() {
    const n = name.trim();
    if (!n) {
      toast.error("Template name is required.");
      return;
    }
    if (modalType === "email" && !subject.trim()) {
      toast.error("Subject is required for email templates.");
      return;
    }
    if (!body.trim()) {
      toast.error("Body is required.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("comm_templates")
          .update({
            name: n,
            type: modalType,
            subject: modalType === "email" ? subject.trim() : null,
            body: body.trim(),
            is_active: isActive,
          })
          .eq("id", editingId);
        if (error) {
          toast.error(toUserFacingError(error.message));
          return;
        }
        toast.success("Template updated");
      } else {
        const { error } = await supabase.from("comm_templates").insert({
          name: n,
          type: modalType,
          subject: modalType === "email" ? subject.trim() : null,
          body: body.trim(),
          is_active: isActive,
          created_by: user.id,
        });
        if (error) {
          toast.error(toUserFacingError(error.message));
          return;
        }
        toast.success("Template saved");
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string, label: string) {
    if (!canManage) return;
    if (!window.confirm(`Delete template “${label}”?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("comm_templates").delete().eq("id", id);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    toast.success("Deleted");
    await load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`${TAB_BTN} ${
              tab === "email"
                ? "bg-[#A87830] text-[#161616] shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#242424] dark:text-slate-200 dark:hover:bg-[#243526]"
            }`}
          >
            Email Templates
          </button>
          <button
            type="button"
            onClick={() => setTab("text")}
            className={`${TAB_BTN} ${
              tab === "text"
                ? "bg-[#A87830] text-[#161616] shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#242424] dark:text-slate-200 dark:hover:bg-[#243526]"
            }`}
          >
            Text Templates
          </button>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-[#A87830] px-4 py-2.5 text-sm font-semibold text-[#161616] shadow-sm hover:opacity-95"
          >
            Add Template
          </button>
        ) : null}
      </div>

      {tab === "email" ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEmailSequencesOnly(false)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              !emailSequencesOnly
                ? "border-[#A87830] bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200 dark:hover:bg-[#242424]"
            }`}
          >
            All email
          </button>
          <button
            type="button"
            onClick={() => setEmailSequencesOnly(true)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              emailSequencesOnly
                ? "border-[#A87830] bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200 dark:hover:bg-[#242424]"
            }`}
          >
            Email Sequences
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-[#2E2E2E]">
          <thead className="bg-slate-50 dark:bg-[#0f1f11]">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                Template Name
              </th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                Type
              </th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                Subject
              </th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                Preview
              </th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No templates yet.
                  {canManage ? " Click Add Template to create one." : ""}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-[#242424]/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {r.name}
                    {tab === "email" && emailSequencesOnly && (r.sequence_key || r.template_key) ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {sequenceLabelFromRow(r)}
                        </span>
                        {overrideBadge(r) ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${overrideBadge(r)!.className}`}
                          >
                            {overrideBadge(r)!.label}
                          </span>
                        ) : null}
                        {r.is_active === false ? (
                          <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-500/30">
                            Off
                          </span>
                        ) : null}
                      </div>
                    ) : r.is_active === false ? (
                      <div className="mt-1">
                        <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-500/30">
                          Off
                        </span>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {r.type === "email" ? "Email" : "Text"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-600 dark:text-slate-300">
                    {r.type === "email"
                      ? r.subject?.trim() || "—"
                      : "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-600 dark:text-slate-400">
                    {previewText(r.body)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(r.id, r.name)}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">View only</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) closeModal();
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingId ? "Edit template" : "Add template"}
            </h2>

            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Template name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
                  placeholder="e.g. Welcome follow-up"
                />
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Type
                </legend>
                <div className="flex gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                    <input
                      type="radio"
                      name="tpl-type"
                      checked={modalType === "email"}
                      onChange={() => setModalType("email")}
                      className="h-4 w-4 border-slate-300 text-[#A87830] focus:ring-[#A87830]"
                    />
                    Email
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                    <input
                      type="radio"
                      name="tpl-type"
                      checked={modalType === "text"}
                      onChange={() => setModalType("text")}
                      className="h-4 w-4 border-slate-300 text-[#A87830] focus:ring-[#A87830]"
                    />
                    Text
                  </label>
                </div>
              </fieldset>

              {modalType === "email" ? (
                <label className="block text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Subject
                  </span>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
                    placeholder="Subject line"
                  />
                </label>
              ) : null}

              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Body
                </span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
                  placeholder="Message body…"
                />
              </label>

              <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-[#2E2E2E] dark:bg-[#121212]/50">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Active
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    When off, this template is skipped by the dispatcher and will not send.
                    Use to temporarily disable an email without deleting it.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] ${
                    isActive ? "bg-[#A87830]" : "bg-slate-300 dark:bg-[#2E2E2E]"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      isActive ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-[#2E2E2E] dark:bg-[#121212]/50 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Merge tags:
                </span>{" "}
                {MERGE_HINT}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave()}
                className="rounded-lg bg-[#A87830] px-4 py-2 text-sm font-semibold text-[#161616] hover:opacity-95 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

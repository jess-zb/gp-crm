"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadClientDocument } from "@/lib/clients/documents-upload-client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { formatMoneyUsdFromCents } from "@/lib/utils/format";
import {
  canDeleteBillingCards,
  canEditBillingCardAuthorizationOnly,
  canEditBillingCards,
  isDevOrAdmin,
} from "@/lib/roles";
import { useMidNames } from "@/lib/hooks/use-mids";

const BUCKET = "client-documents";

const AUTH_COLORS: Record<string, string> = {
  pre_auth: "bg-yellow-100 text-yellow-700",
  pending: "bg-gray-100 text-gray-600",
  approved: "bg-green-100 text-green-700",
  decline: "bg-red-100 text-red-700",
  dead: "bg-gray-200 text-gray-500",
  refund: "bg-purple-100 text-purple-700",
  chargeback: "bg-orange-100 text-orange-700",
  balance_transfer: "bg-blue-100 text-blue-700",
  closed: "bg-slate-100 text-slate-500",
};

const AUTH_LABELS: Record<string, string> = {
  pre_auth: "Pre-Auth",
  pending: "Pending",
  approved: "Approved",
  decline: "Decline",
  dead: "Dead",
  refund: "Refund",
  chargeback: "Chargeback",
  balance_transfer: "Balance Transfer",
  closed: "Closed",
};

const AUTH_OPTIONS = [
  { value: "pre_auth", label: "Pre-Auth" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "decline", label: "Decline" },
  { value: "dead", label: "Dead" },
  { value: "refund", label: "Refund" },
  { value: "chargeback", label: "Chargeback" },
  { value: "balance_transfer", label: "Balance Transfer" },
  { value: "closed", label: "Closed" },
];

const AUTH_VALUE_SET = new Set(AUTH_OPTIONS.map((o) => o.value));

function normalizeAuthStatus(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (s && AUTH_VALUE_SET.has(s)) return s;
  return "pre_auth";
}

const EMPTY_ADD_CARD_FORM = {
  merchant_name: "",
  creditor_name: "",
  card_type: "visa",
  last_four: "",
  charge_amount: "",
  authorization_status: "pre_auth",
};

export type CardRow = {
  id: string;
  merchant_name: string | null;
  creditor_name: string;
  card_type: string;
  last_four: string;
  charge_amount_cents: number | null;
  authorization_status: string;
  created_at: string | null;
  added_by: string | null;
  collection_letter_doc_id: string | null;
  collection_letter_file_name: string | null;
  collection_letter_storage_path: string | null;
};

export function BillingTabContent({
  clientId,
  cards: initialCards,
  userRole,
}: {
  clientId: string;
  cards: CardRow[];
  userRole: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const canEditCards = canEditBillingCards(userRole);
  const canAuthOnly = canEditBillingCardAuthorizationOnly(userRole);
  const canDeleteCards = canDeleteBillingCards(userRole);
  const showDestructiveBilling = isDevOrAdmin(userRole);
  const showBillingActions = canEditCards || canDeleteCards;
  const merchantOptions = useMidNames();

  const [cards, setCards] = useState(initialCards);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);
  const [editing, setEditing] = useState<CardRow | null>(null);
  const [editMerchant, setEditMerchant] = useState("");
  const [editCreditor, setEditCreditor] = useState("");
  const [editType, setEditType] = useState("visa");
  const [editLastFour, setEditLastFour] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editAuth, setEditAuth] = useState("pre_auth");
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingAddCard, setSavingAddCard] = useState(false);
  const [addFormData, setAddFormData] = useState(() => ({ ...EMPTY_ADD_CARD_FORM }));

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authCard, setAuthCard] = useState<CardRow | null>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [savingAuth, setSavingAuth] = useState(false);

  // Note: RLS allows acct_manager to update client_cards (authorization_status only; see migration).
  // Run migrations to apply policies + trigger. If updates fail in SQL editor, ensure:
  // GRANT UPDATE ON TABLE client_cards TO authenticated;

  const openAuthModal = useCallback((card: CardRow) => {
    setAuthCard(card);
    setAuthStatus(normalizeAuthStatus(card.authorization_status));
    setShowAuthModal(true);
  }, []);

  const handleSaveAuth = async () => {
    if (!authCard) return;
    setSavingAuth(true);
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setSavingAuth(false);
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const performerName = prof?.full_name?.trim() || "Staff";

      const { error } = await supabase
        .from("client_cards")
        .update({ authorization_status: normalizeAuthStatus(authStatus) })
        .eq("id", authCard.id)
        .eq("client_id", clientId);

      if (error) throw error;

      const { error: auditErr } = await supabase.from("audit_log").insert({
        client_id: clientId,
        action: "card_authorization_updated",
        new_value: {
          card_id: authCard.id,
          creditor_name: authCard.creditor_name,
          last_four: authCard.last_four,
          old_status: authCard.authorization_status,
          new_status: normalizeAuthStatus(authStatus),
        },
        performed_by: user.id,
        performed_by_name: performerName,
      });
      if (auditErr) {
        console.warn("audit_log card_authorization_updated:", auditErr.message);
      }

      toast.success("Authorization updated");
      setShowAuthModal(false);
      setAuthCard(null);
      router.refresh();
    } catch (err) {
      toast.error("Failed to update authorization");
      console.error(err);
    } finally {
      setSavingAuth(false);
    }
  };

  const totalCents = cards.reduce((s, c) => s + (c.charge_amount_cents ?? 0), 0);

  const openEdit = useCallback((c: CardRow) => {
    setEditing(c);
    setEditMerchant(c.merchant_name?.trim() ?? "");
    setEditCreditor(c.creditor_name);
    setEditType(c.card_type);
    setEditLastFour(c.last_four);
    setEditAmount(((c.charge_amount_cents ?? 0) / 100).toFixed(2));
    setEditAuth(normalizeAuthStatus(c.authorization_status));
    setEditOpen(true);
  }, []);

  const handleSaveCard = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEditCards) return;

    const merchantRaw = addFormData.merchant_name.trim();
    const creditor_name = addFormData.creditor_name.trim();
    const rawCardType = addFormData.card_type || "other";
    const allowedCard = new Set(["visa", "mastercard", "amex", "discover", "other"]);
    const card_type = allowedCard.has(rawCardType) ? rawCardType : "other";
    const last_four = addFormData.last_four.replace(/\D/g, "").slice(0, 4);
    const amt = addFormData.charge_amount.trim();
    /** DB column `charge_amount_cents` is INTEGER (cents). */
    const charge_amount_cents = amt ? Math.round(parseFloat(amt) * 100) : 0;

    if (!merchantRaw) {
      toast.error("Select a main merchant.");
      return;
    }
    if (!creditor_name || last_four.length !== 4) {
      toast.error("Creditor and four digits required.");
      return;
    }
    if (Number.isNaN(charge_amount_cents) || charge_amount_cents < 0) {
      toast.error("Invalid charge amount.");
      return;
    }

    setSavingAddCard(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSavingAddCard(false);
      return;
    }

    const authorization_status = normalizeAuthStatus(addFormData.authorization_status);

    const insertPayload = {
      client_id: clientId,
      merchant_name: merchantRaw || null,
      creditor_name,
      card_type,
      last_four,
      charge_amount_cents,
      authorization_status,
      added_by: user.id,
    };

    const { data: newCard, error: cardError } = await supabase
      .from("client_cards")
      .insert(insertPayload)
      .select()
      .single();

    if (cardError) {
      console.error("Card insert error:", JSON.stringify(cardError));
      toast.error(`Failed to save card — ${cardError.message}`);
      setSavingAddCard(false);
      return;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const performerName = prof?.full_name?.trim() || "Staff";
    const { error: auditErr } = await supabase.from("audit_log").insert({
      client_id: clientId,
      action: "card_added",
      new_value: {
        merchant_name: merchantRaw,
        creditor_name,
        last_four,
        charge_amount_cents,
        authorization_status,
        card_id: newCard?.id ?? null,
      },
      performed_by: user.id,
      performed_by_name: performerName,
    });
    if (auditErr) {
      console.warn("audit_log card_added:", auditErr.message);
    }

    toast.success("Card added successfully");
    setShowAddModal(false);
    setAddFormData({ ...EMPTY_ADD_CARD_FORM });
    setSavingAddCard(false);
    router.refresh();
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !canEditCards) return;
    const last_four = editLastFour.replace(/\D/g, "").slice(0, 4);
    const cents = Math.round(parseFloat(editAmount || "0") * 100);
    if (!editMerchant.trim() || !editCreditor.trim() || last_four.length !== 4) {
      toast.error("MIDs, creditor, and four digits required.");
      return;
    }
    if (Number.isNaN(cents) || cents < 0) {
      toast.error("Invalid charge amount.");
      return;
    }
    setSavingEdit(true);
    const supabase = createClient();
    const authorization_status = normalizeAuthStatus(editAuth);

    const { error } = await supabase
      .from("client_cards")
      .update({
        merchant_name: editMerchant.trim() || null,
        creditor_name: editCreditor.trim(),
        card_type: editType,
        last_four,
        charge_amount_cents: cents,
        authorization_status,
      })
      .eq("id", editing.id)
      .eq("client_id", clientId);
    setSavingEdit(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    toast.success("Card updated");
    setEditOpen(false);
    setEditing(null);
    router.refresh();
  };

  const deleteCard = async (c: CardRow) => {
    if (!canDeleteCards) return;
    if (!window.confirm("Are you sure you want to delete this card?")) return;
    setBusyCardId(c.id);
    const supabase = createClient();
    if (c.collection_letter_doc_id && c.collection_letter_storage_path) {
      const { error: stErr } = await supabase.storage
        .from(BUCKET)
        .remove([c.collection_letter_storage_path]);
      if (stErr) {
        toast.error(toUserFacingError(stErr.message));
        setBusyCardId(null);
        return;
      }
      const { error: delDoc } = await supabase
        .from("documents")
        .delete()
        .eq("id", c.collection_letter_doc_id)
        .eq("client_id", clientId);
      if (delDoc) {
        toast.error(toUserFacingError(delDoc.message));
        setBusyCardId(null);
        return;
      }
    }
    const { error } = await supabase.from("client_cards").delete().eq("id", c.id).eq("client_id", clientId);
    setBusyCardId(null);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    toast.success("Card removed");
    router.refresh();
  };

  const attachCollectionLetter = async (cardId: string, file: File) => {
    if (!canEditCards) return;
    setAttachingId(cardId);
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("documentType", "collection_letter");
    formData.append("file", file);
    formData.append("clientCardId", cardId);
    try {
      const { warning } = await uploadClientDocument(formData);
      if (warning) {
        toast.warning(`Uploaded, but card link failed: ${warning}`);
      } else {
        toast.success("Collection letter attached");
      }
      router.refresh();
    } catch (err) {
      toast.error(
        toUserFacingError(err instanceof Error ? err.message : "Upload failed")
      );
    } finally {
      setAttachingId(null);
    }
  };

  const removeCollectionLetter = async (c: CardRow) => {
    if (
      !showDestructiveBilling ||
      !c.collection_letter_doc_id ||
      !c.collection_letter_storage_path
    )
      return;
    if (!window.confirm("Remove this collection letter from the card?")) return;
    setBusyCardId(c.id);
    const supabase = createClient();
    const { error: stErr } = await supabase.storage
      .from(BUCKET)
      .remove([c.collection_letter_storage_path]);
    if (stErr) {
      toast.error(toUserFacingError(stErr.message));
      setBusyCardId(null);
      return;
    }
    const { error: delErr } = await supabase
      .from("documents")
      .delete()
      .eq("id", c.collection_letter_doc_id)
      .eq("client_id", clientId);
    setBusyCardId(null);
    if (delErr) {
      toast.error(toUserFacingError(delErr.message));
      return;
    }
    toast.success("Collection letter removed");
    router.refresh();
  };

  return (
    <section className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Cards on file</h3>
          <p className="mt-1 text-lg font-bold text-[#A87830]">
            Total charged: {formatMoneyUsdFromCents(totalCents)}
          </p>
        </div>
        {canEditCards ? (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="shrink-0 rounded-lg bg-[#A87830] px-4 py-2.5 text-sm font-bold text-[#161616] shadow-md transition hover:opacity-95"
          >
            Add Charge +
          </button>
        ) : null}
      </div>

      {!cards.length ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No cards recorded.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2E2E2E]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 dark:bg-[#1C1C1C]/80">
              <tr>
                <th className="px-3 py-2 font-semibold">Creditor</th>
                <th className="px-3 py-2 font-semibold">Last 4</th>
                <th className="px-3 py-2 font-semibold">MIDs</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Authorization</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                {showBillingActions ? (
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const authKey = normalizeAuthStatus(c.authorization_status);
                return (
                <tr key={c.id} className="border-t border-slate-100 dark:border-[#2E2E2E]">
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                    {c.creditor_name}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">
                    {c.last_four?.trim() ? `•••• ${c.last_four.trim()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {c.merchant_name?.trim() || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{c.card_type}</td>
                  <td className="px-3 py-2">
                    {canAuthOnly || canEditCards ? (
                      <button
                        type="button"
                        onClick={() => openAuthModal(c)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${
                          AUTH_COLORS[authKey] ?? AUTH_COLORS.pending
                        }`}
                        title="Update authorization status"
                      >
                        {AUTH_LABELS[authKey] ?? authKey}
                      </button>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          AUTH_COLORS[authKey] ?? AUTH_COLORS.pending
                        }`}
                      >
                        {AUTH_LABELS[authKey] ?? authKey}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                    {formatMoneyUsdFromCents(c.charge_amount_cents)}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {c.collection_letter_doc_id ? (
                          <span
                            className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-emerald-400"
                            title="Collection letter attached"
                            aria-label="Collection letter attached"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Attached</span>
                          </span>
                        ) : (
                          <span
                            className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500"
                            title="No letter yet"
                            aria-label="Waiting for collection letter"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Waiting</span>
                          </span>
                        )}
                        {showDestructiveBilling && c.collection_letter_doc_id ? (
                          <button
                            type="button"
                            disabled={busyCardId === c.id}
                            onClick={() => void removeCollectionLetter(c)}
                            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                          >
                            Remove letter
                          </button>
                        ) : null}
                      </div>
                      {canEditCards && !c.collection_letter_doc_id ? (
                        <label className="inline-flex cursor-pointer text-xs font-semibold text-[#A87830] hover:underline">
                          {attachingId === c.id ? "Uploading…" : "Attach Collection Letter"}
                          <input
                            type="file"
                            accept="*/*"
                            className="hidden"
                            disabled={attachingId !== null || busyCardId === c.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (f) void attachCollectionLetter(c.id, f);
                            }}
                          />
                        </label>
                      ) : null}
                    </div>
                  </td>
                  {showBillingActions ? (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {canEditCards ? (
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          title="Edit card"
                          aria-label="Edit card"
                          className="inline-flex rounded-md p-1.5 text-slate-500 transition-colors hover:bg-green-50 hover:text-green-700 dark:text-slate-400 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canDeleteCards ? (
                        <button
                          type="button"
                          disabled={busyCardId === c.id}
                          onClick={() => void deleteCard(c)}
                          title="Delete card"
                          aria-label="Delete card"
                          className="inline-flex rounded-md p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editOpen && editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEdit) {
              setEditOpen(false);
              setEditing(null);
            }
          }}
        >
          <div
            className="mx-auto w-full max-w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Edit card</h4>
            <form onSubmit={submitEdit} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">MIDs</span>
                <select
                  value={editMerchant}
                  onChange={(e) => setEditMerchant(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                >
                  <option value="" disabled>
                    Select MIDs
                  </option>
                  {merchantOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">
                  Authorization
                </label>
                <select
                  value={editAuth}
                  onChange={(e) => setEditAuth(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                >
                  {AUTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Creditor name</span>
                <input
                  value={editCreditor}
                  onChange={(e) => setEditCreditor(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Card type</span>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">American Express</option>
                  <option value="discover">Discover</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Last four</span>
                <input
                  value={editLastFour}
                  onChange={(e) => setEditLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                  maxLength={4}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Charge amount</span>
                <div className="relative mt-1">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                    aria-hidden
                  >
                    $
                  </span>
                  <input
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    className="w-full rounded-lg border border-slate-200 py-2 pl-7 pr-3 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                  />
                </div>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => {
                    setEditOpen(false);
                    setEditing(null);
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-[#2E2E2E]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-[#A87830] px-4 py-2 text-sm font-bold text-[#161616] disabled:opacity-50"
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAuthModal && authCard ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-card-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingAuth) {
              setShowAuthModal(false);
              setAuthCard(null);
            }
          }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3
                id="auth-card-modal-title"
                className="font-semibold text-gray-900 dark:text-white"
              >
                Update Authorization
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (!savingAuth) {
                    setShowAuthModal(false);
                    setAuthCard(null);
                  }
                }}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
              {authCard.creditor_name} •••• {authCard.last_four}
            </p>

            <div className="mb-5">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                Authorization Status
              </label>
              <select
                value={authStatus}
                onChange={(e) => setAuthStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
              >
                {AUTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!savingAuth) {
                    setShowAuthModal(false);
                    setAuthCard(null);
                  }
                }}
                className="crm-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAuth()}
                disabled={savingAuth}
                className="crm-btn-primary flex-1"
              >
                {savingAuth ? (
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

      {showAddModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-card-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingAddCard) setShowAddModal(false);
          }}
        >
          <div
            className="mx-auto w-full max-w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              id="add-card-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Add charge
            </h4>
            <form onSubmit={handleSaveCard} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">MIDs</span>
                <select
                  required
                  value={addFormData.merchant_name}
                  onChange={(e) =>
                    setAddFormData((p) => ({ ...p, merchant_name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                >
                  <option value="" disabled>
                    Select MIDs
                  </option>
                  {merchantOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">
                  Authorization
                </label>
                <select
                  value={addFormData.authorization_status}
                  onChange={(e) =>
                    setAddFormData((p) => ({ ...p, authorization_status: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                >
                  {AUTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Creditor name</span>
                <input
                  required
                  value={addFormData.creditor_name}
                  onChange={(e) =>
                    setAddFormData((p) => ({ ...p, creditor_name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Card type</span>
                <select
                  required
                  value={addFormData.card_type}
                  onChange={(e) =>
                    setAddFormData((p) => ({ ...p, card_type: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">American Express</option>
                  <option value="discover">Discover</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Last four</span>
                <input
                  required
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={addFormData.last_four}
                  onChange={(e) =>
                    setAddFormData((p) => ({
                      ...p,
                      last_four: e.target.value.replace(/\D/g, "").slice(0, 4),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Charge amount</span>
                <div className="relative mt-1">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                    aria-hidden
                  >
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={addFormData.charge_amount}
                    onChange={(e) =>
                      setAddFormData((p) => ({ ...p, charge_amount: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 py-2 pl-7 pr-3 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                  />
                </div>
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  disabled={savingAddCard}
                  onClick={() => {
                    setShowAddModal(false);
                    setAddFormData({ ...EMPTY_ADD_CARD_FORM });
                  }}
                  className="crm-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAddCard}
                  className="crm-btn-primary"
                >
                  {savingAddCard ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save card"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

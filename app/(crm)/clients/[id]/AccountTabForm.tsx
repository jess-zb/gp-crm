"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Save } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { AddressFields } from "@/components/AddressFields";
import { toUserFacingError } from "@/lib/user-facing-error";
import { getAddressWarning } from "@/lib/utils/address-validation";
import { updateClient } from "./actions";

export type AccountTabClient = {
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  nickname: string | null;
  verbal_password: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  spouse_name: string | null;
  spouse_nickname: string | null;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  phone_work: string | null;
  phone_home: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

type AccountFormValues = {
  first_name: string;
  last_name: string;
  nickname: string;
  spouse_first_name: string;
  spouse_last_name: string;
  spouse_nickname: string;
  verbal_password: string;
  email: string;
  phone_mobile: string;
  phone_work: string;
  phone_home: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
};

const FORM_KEYS = Object.keys({
  first_name: true,
  last_name: true,
  nickname: true,
  spouse_first_name: true,
  spouse_last_name: true,
  spouse_nickname: true,
  verbal_password: true,
  email: true,
  phone_mobile: true,
  phone_work: true,
  phone_home: true,
  street_address: true,
  city: true,
  state: true,
  zip_code: true,
}) as (keyof AccountFormValues)[];

const FORM_FIELD_LABELS: Record<keyof AccountFormValues, string> = {
  first_name: "first name",
  last_name: "last name",
  nickname: "nickname",
  spouse_first_name: "spouse first name",
  spouse_last_name: "spouse last name",
  spouse_nickname: "spouse nickname",
  verbal_password: "verbal password",
  email: "email",
  phone_mobile: "mobile phone",
  phone_work: "work phone",
  phone_home: "home phone",
  street_address: "street address",
  city: "city",
  state: "state",
  zip_code: "ZIP",
};

function formDataFromClient(c: AccountTabClient): AccountFormValues {
  const mobile = c.phone_mobile?.trim() || c.phone?.trim() || "";
  return {
    first_name: c.first_name?.trim() ?? "",
    last_name: c.last_name?.trim() ?? "",
    nickname: c.nickname?.trim() ?? "",
    spouse_first_name: c.spouse_first_name?.trim() ?? "",
    spouse_last_name: c.spouse_last_name?.trim() ?? "",
    spouse_nickname: c.spouse_nickname?.trim() ?? "",
    verbal_password: c.verbal_password?.trim() ?? "",
    email: c.email?.trim() ?? "",
    phone_mobile: formatPhone(mobile),
    phone_work: formatPhone(c.phone_work?.trim() ?? ""),
    phone_home: formatPhone(c.phone_home?.trim() ?? ""),
    street_address: c.street_address?.trim() ?? "",
    city: c.city?.trim() ?? "",
    state: c.state?.trim() ?? "",
    zip_code: c.zip_code?.trim() ?? "",
  };
}

function spouseCombined(fd: AccountFormValues): string | null {
  const a = fd.spouse_first_name.trim();
  const b = fd.spouse_last_name.trim();
  const s = [a, b].filter(Boolean).join(" ").trim();
  return s || null;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

const FieldLabel = ({
  htmlFor,
  label,
  fieldKey,
  savedField,
}: {
  htmlFor?: string;
  label: ReactNode;
  fieldKey: string;
  savedField: string | null;
}) => (
  <div className="mb-1 flex items-center justify-between gap-2">
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-slate-700 dark:text-slate-300"
    >
      {label}
    </label>
    {savedField === fieldKey ? (
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
        <Check className="h-3 w-3" aria-hidden />
        Saved
      </span>
    ) : null}
  </div>
);

const ErrorMessage = ({
  fieldKey,
  fieldErrors,
}: {
  fieldKey: string;
  fieldErrors: Record<string, string>;
}) => {
  const err = fieldErrors[fieldKey];
  if (!err) return null;
  return (
    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
      {err}
    </p>
  );
};

const inputClass = (hasErr: boolean) =>
  `mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 shadow-sm focus:border-[#A87830] focus:outline-none focus:ring-1 focus:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
    hasErr
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
      : "border-slate-200 dark:border-[#2E2E2E]"
  }`;

export function AccountTabForm({
  clientId,
  client,
  accountRevision,
}: {
  clientId: string;
  client: AccountTabClient;
  /** Changes when the server row updates (e.g. after router.refresh). */
  accountRevision: string;
}) {
  const toast = useToast();
  const router = useRouter();

  const [savedField, setSavedField] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaved = useCallback((field: string) => {
    setSavedField(field);
    window.setTimeout(() => setSavedField(null), 2000);
  }, []);

  const [formData, setFormData] = useState<AccountFormValues>(() =>
    formDataFromClient(client)
  );
  const [originalValues, setOriginalValues] = useState<AccountFormValues>(() =>
    formDataFromClient(client)
  );

  useEffect(() => {
    // Don't overwrite in-progress edits — auto-save pushes a new accountRevision while the user may still be typing.
    if (isDirtyRef.current) return;
    const next = formDataFromClient(client);
    setFormData(next);
    setOriginalValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- client fields come from latest props when accountRevision updates
  }, [clientId, accountRevision]);

  const isDirty = useMemo(
    () => FORM_KEYS.some((k) => formData[k] !== originalValues[k]),
    [formData, originalValues]
  );

  const addressWarning = useMemo(
    () => getAddressWarning(formData.street_address),
    [formData.street_address]
  );

  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const handleFieldChange = useCallback((field: keyof AccountFormValues, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const persistFullAccount = useCallback(
    async (opts?: { quiet?: boolean; skipRefresh?: boolean }) => {
      const fd = formDataRef.current;
      const prev = originalValues;
      const spouseFirst = fd.spouse_first_name.trim();
      const spouseLast = fd.spouse_last_name.trim();
      const spouseCombinedVal =
        [spouseFirst, spouseLast].filter(Boolean).join(" ").trim() || null;

      const clearedFields: { key: keyof AccountFormValues; label: string; prev: string }[] = [];
      for (const k of FORM_KEYS) {
        const before = (prev[k] ?? "").trim();
        const after = (fd[k] ?? "").trim();
        if (before && !after) {
          clearedFields.push({ key: k, label: FORM_FIELD_LABELS[k] ?? String(k), prev: prev[k] });
        }
      }

      const showSpinner = !opts?.quiet;
      if (showSpinner) setIsSaving(true);
      else setIsAutoSaving(true);
      try {
        const res = await updateClient({
          clientId,
          first_name: fd.first_name.trim() || "Unknown",
          last_name: fd.last_name.trim() || "Unknown",
          nickname: fd.nickname.trim() || null,
          verbal_password: fd.verbal_password.trim() || null,
          spouse_first_name: spouseFirst || null,
          spouse_last_name: spouseLast || null,
          spouse_name: spouseCombinedVal,
          spouse_nickname: fd.spouse_nickname.trim() || null,
          email: fd.email.trim() || null,
          phone_mobile: fd.phone_mobile.trim() || null,
          phone_work: fd.phone_work.trim() || null,
          phone_home: fd.phone_home.trim() || null,
          street_address: fd.street_address.trim() || null,
          city: fd.city.trim() || null,
          state: fd.state.trim() || null,
          zip_code: fd.zip_code.trim() || null,
        });

        if (!res || !res.ok) {
          toast.error(toUserFacingError(res?.error ?? "An unexpected error occurred. Please refresh the page."));
          return;
        }

        setFieldErrors({});
        setOriginalValues({ ...fd });

        if (clearedFields.length > 0) {
          const label =
            clearedFields.length === 1
              ? `Cleared ${clearedFields[0]!.label}`
              : `Cleared ${clearedFields.length} fields`;
          toast.warning(label, {
            durationMs: 10000,
            action: {
              label: "Undo",
              onClick: () => {
                setFormData((cur) => {
                  const next = { ...cur };
                  for (const c of clearedFields) next[c.key] = c.prev;
                  return next;
                });
              },
            },
          });
        } else if (!opts?.quiet) {
          toast.success("Client saved");
        } else {
          showSaved("autosave");
        }
        if (!opts?.skipRefresh) {
          router.refresh();
        }
      } catch (err) {
        toast.error("An unexpected error occurred. Please refresh the page.");
      } finally {
        if (showSpinner) setIsSaving(false);
        else setIsAutoSaving(false);
      }
    },
    [clientId, originalValues, router, showSaved, toast]
  );

  useEffect(() => {
    if (!isDirty) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persistFullAccount({ quiet: true, skipRefresh: true });
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formData, isDirty, persistFullAccount]);

  const persistRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    persistRef.current = async () => {
      if (!isDirtyRef.current) return;
      await persistFullAccount({ quiet: true });
    };
  }, [persistFullAccount]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      void persistRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const onAddressChange = useCallback(
    (field: "street_address" | "city" | "state" | "zip_code", value: string) => {
      handleFieldChange(field, value);
    },
    [handleFieldChange]
  );



  return (
    <form
      className="space-y-8"
      onSubmit={async (e) => {
        e.preventDefault();
        await persistFullAccount();
        showSaved("form");
      }}
    >
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Client Information
          </h3>
          {isAutoSaving ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Saving…
            </span>
          ) : savedField === "autosave" ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" aria-hidden />
              Saved
            </span>
          ) : isDirty ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">Unsaved changes</span>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="block text-sm">
            <FieldLabel
              label="Primary First Name"
              fieldKey="first_name"
              htmlFor="acct-first_name"
              savedField={savedField}
            />
            <input
              id="acct-first_name"
              value={formData.first_name}
              onChange={(e) => handleFieldChange("first_name", e.target.value)}
              className={inputClass(!!fieldErrors.first_name)}
            />
            <ErrorMessage fieldKey="first_name" fieldErrors={fieldErrors} />
          </div>
          <div className="block text-sm">
            <FieldLabel
              label="Primary Last Name"
              fieldKey="last_name"
              htmlFor="acct-last_name"
              savedField={savedField}
            />
            <input
              id="acct-last_name"
              value={formData.last_name}
              onChange={(e) => handleFieldChange("last_name", e.target.value)}
              className={inputClass(!!fieldErrors.last_name)}
            />
            <ErrorMessage fieldKey="last_name" fieldErrors={fieldErrors} />
          </div>
          <div className="block text-sm">
            <FieldLabel
              label="Primary Nickname"
              fieldKey="nickname"
              htmlFor="acct-nickname"
              savedField={savedField}
            />
            <input
              id="acct-nickname"
              value={formData.nickname}
              onChange={(e) => handleFieldChange("nickname", e.target.value)}
              className={inputClass(!!fieldErrors.nickname)}
            />
            <ErrorMessage fieldKey="nickname" fieldErrors={fieldErrors} />
          </div>

          <div className="block text-sm">
            <FieldLabel
              label="Secondary First Name"
              fieldKey="spouse_first_name"
              htmlFor="acct-spouse_first_name"
              savedField={savedField}
            />
            <input
              id="acct-spouse_first_name"
              value={formData.spouse_first_name}
              onChange={(e) =>
                handleFieldChange("spouse_first_name", e.target.value)
              }
              className={inputClass(!!fieldErrors.spouse_first_name)}
            />
            <ErrorMessage
              fieldKey="spouse_first_name"
              fieldErrors={fieldErrors}
            />
          </div>
          <div className="block text-sm">
            <FieldLabel
              label="Secondary Last Name"
              fieldKey="spouse_last_name"
              htmlFor="acct-spouse_last_name"
              savedField={savedField}
            />
            <input
              id="acct-spouse_last_name"
              value={formData.spouse_last_name}
              onChange={(e) =>
                handleFieldChange("spouse_last_name", e.target.value)
              }
              className={inputClass(!!fieldErrors.spouse_last_name)}
            />
            <ErrorMessage
              fieldKey="spouse_last_name"
              fieldErrors={fieldErrors}
            />
          </div>
          <div className="block text-sm">
            <FieldLabel
              label="Secondary Nickname"
              fieldKey="spouse_nickname"
              htmlFor="acct-spouse_nickname"
              savedField={savedField}
            />
            <input
              id="acct-spouse_nickname"
              value={formData.spouse_nickname}
              onChange={(e) =>
                handleFieldChange("spouse_nickname", e.target.value)
              }
              className={inputClass(!!fieldErrors.spouse_nickname)}
            />
            <ErrorMessage fieldKey="spouse_nickname" fieldErrors={fieldErrors} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="block text-sm">
            <FieldLabel
              label={
                <>
                  Verbal Password <span className="text-red-500">*</span>
                </>
              }
              fieldKey="verbal_password"
              htmlFor="account_verbal_password"
              savedField={savedField}
            />
            <input
              id="account_verbal_password"
              type="text"
              value={formData.verbal_password}
              onChange={(e) =>
                handleFieldChange("verbal_password", e.target.value)
              }
              placeholder="Used to verify client identity on calls"
              className={inputClass(!!fieldErrors.verbal_password)}
            />
            <ErrorMessage fieldKey="verbal_password" fieldErrors={fieldErrors} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="block text-sm">
            <FieldLabel
              label="Email"
              fieldKey="email"
              htmlFor="acct-email"
              savedField={savedField}
            />
            <input
              id="acct-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              className={inputClass(!!fieldErrors.email)}
            />
            <ErrorMessage fieldKey="email" fieldErrors={fieldErrors} />
          </div>
          <div className="block text-sm">
            <FieldLabel
              label="Mobile phone (primary)"
              fieldKey="phone_mobile"
              htmlFor="acct-phone_mobile"
              savedField={savedField}
            />
            <input
              id="acct-phone_mobile"
              type="tel"
              inputMode="numeric"
              maxLength={14}
              placeholder="(407) 555-0123"
              value={formData.phone_mobile}
              onChange={(e) => handleFieldChange("phone_mobile", formatPhone(e.target.value))}
              className={inputClass(!!fieldErrors.phone_mobile)}
            />
            <ErrorMessage fieldKey="phone_mobile" fieldErrors={fieldErrors} />
          </div>
          <div className="block text-sm">
            <FieldLabel
              label="Work phone"
              fieldKey="phone_work"
              htmlFor="acct-phone_work"
              savedField={savedField}
            />
            <input
              id="acct-phone_work"
              type="tel"
              inputMode="numeric"
              maxLength={14}
              placeholder="(407) 555-0123"
              value={formData.phone_work}
              onChange={(e) => handleFieldChange("phone_work", formatPhone(e.target.value))}
              className={inputClass(!!fieldErrors.phone_work)}
            />
            <ErrorMessage fieldKey="phone_work" fieldErrors={fieldErrors} />
          </div>
          <div className="block text-sm">
            <FieldLabel
              label="Home phone"
              fieldKey="phone_home"
              htmlFor="acct-phone_home"
              savedField={savedField}
            />
            <input
              id="acct-phone_home"
              type="tel"
              inputMode="numeric"
              maxLength={14}
              placeholder="(407) 555-0123"
              value={formData.phone_home}
              onChange={(e) => handleFieldChange("phone_home", formatPhone(e.target.value))}
              className={inputClass(!!fieldErrors.phone_home)}
            />
            <ErrorMessage fieldKey="phone_home" fieldErrors={fieldErrors} />
          </div>
          <div className="col-span-full min-w-0 md:col-span-2">
            <AddressFields
              labels="account"
              streetValue={formData.street_address}
              cityValue={formData.city}
              stateValue={formData.state}
              zipValue={formData.zip_code}
              onStreetChange={(v) => onAddressChange("street_address", v)}
              onCityChange={(v) => onAddressChange("city", v)}
              onStateChange={(v) => onAddressChange("state", v)}
              onZipChange={(v) => onAddressChange("zip_code", v)}
              inputClass={(n, hasErr) =>
                inputClass(hasErr || !!fieldErrors[n])
              }
            />
            {addressWarning ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                {addressWarning} — mail cannot be delivered to this address
              </p>
            ) : null}
            <ErrorMessage fieldKey="street_address" fieldErrors={fieldErrors} />
            <ErrorMessage fieldKey="city" fieldErrors={fieldErrors} />
            <ErrorMessage fieldKey="state" fieldErrors={fieldErrors} />
            <ErrorMessage fieldKey="zip_code" fieldErrors={fieldErrors} />
          </div>
        </div>
      </section>

      <div className="mt-6 flex justify-end border-t border-gray-100 pt-4 dark:border-[#2E2E2E]">
        {savedField === "form" ? (
          <span className="mr-3 flex items-center gap-1 self-center text-sm font-medium text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" aria-hidden />
            Saved
          </span>
        ) : null}
        <button
          type="submit"
          disabled={isSaving}
          className="crm-btn-primary flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
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
  );
}

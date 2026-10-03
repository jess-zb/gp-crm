"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { AddressFields } from "@/components/AddressFields";
import { isHiddenFromRole } from "@/lib/constants/hidden-accounts";
import { enrollWelcomeLeadForNewClientAction } from "./enroll-actions";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { useMids } from "@/lib/hooks/use-mids";

const BRAND_PRIMARY = "#8DE3B5";

type TeamOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_accounts?: boolean | null;
};

type FieldErrors = Partial<Record<string, string>>;

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

/** (XXX) XXX-XXXX for up to 10 digits */
function formatPhoneMask(raw: string) {
  const d = digitsOnly(raw).slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const FIELD_ORDER = [
  "first_name",
  "last_name",
  "email",
  "phone_mobile",
  "street_address",
  "city",
  "state",
  "zip_code",
  "assigned_to",
  "mid_id",
  "verbal_password",
] as const;

export default function NewClientPage() {
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const formRef = useRef<HTMLFormElement>(null);

  const [team, setTeam] = useState<TeamOption[]>([]);
  const { mids, loading: loadingMids } = useMids();
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [phoneMobile, setPhoneMobile] = useState("");
  const [phoneWork, setPhoneWork] = useState("");
  const [phoneHome, setPhoneHome] = useState("");

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [formData, setFormData] = useState({ verbal_password: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let viewerRole = "";
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        viewerRole = (prof?.role as string) ?? "";
      }
      const { data, error: qErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_accounts")
        .eq("is_active", true)
        .eq("is_accounts", true)
        .order("full_name", { ascending: true });

      if (!cancelled) {
        if (!qErr && data) {
          const rows = (data as TeamOption[]).filter(
            (t) => !isHiddenFromRole(t.email, viewerRole)
          );
          setTeam(rows.filter((t) => !!t.is_accounts));
        }
        setLoadingTeam(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const scrollToFirstError = useCallback((errors: FieldErrors) => {
    for (const key of FIELD_ORDER) {
      if (errors[key]) {
        const el = formRef.current?.querySelector(`[data-field="${key}"]`);
        if (el && "scrollIntoView" in el) {
          (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        }
        break;
      }
    }
  }, []);

  const clearFieldError = useCallback((name: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const validateForm = useCallback((): FieldErrors => {
    const errors: FieldErrors = {};

    const fd = new FormData(formRef.current ?? undefined);
    const first_name = String(fd.get("first_name") ?? "").trim();
    const last_name = String(fd.get("last_name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const mobileDigits = digitsOnly(phoneMobile);
    const assigned_to = String(fd.get("assigned_to") ?? "").trim();

    if (!first_name) errors.first_name = "Primary first name is required.";
    if (!last_name) errors.last_name = "Primary last name is required.";
    if (!email) errors.email = "Email is required.";
    if (mobileDigits.length < 10) {
      errors.phone_mobile = "Mobile phone is required (10 digits).";
    }
    if (!street.trim()) errors.street_address = "Street address is required.";
    if (!city.trim()) errors.city = "City is required.";
    if (!state.trim()) errors.state = "State is required.";
    if (!zip.trim()) errors.zip_code = "ZIP code is required.";
    if (!assigned_to) errors.assigned_to = "An Account Manager is required.";
    if (!String(fd.get("mid_id") ?? "").trim()) {
      errors.mid_id = "A MID is required.";
    }

    const verbal = formData.verbal_password.trim();
    if (!verbal) errors.verbal_password = "Verbal Password is required";

    return errors;
  }, [phoneMobile, street, city, state, zip, formData.verbal_password]);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFieldErrors({});
      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        scrollToFirstError(errors);
        return;
      }

      const fd = new FormData(e.currentTarget);
      const first_name = String(fd.get("first_name") ?? "").trim();
      const last_name = String(fd.get("last_name") ?? "").trim();

      const email = String(fd.get("email") ?? "").trim();

      const spouseFirst = String(fd.get("spouse_first_name") ?? "").trim();
      const spouseLast = String(fd.get("spouse_last_name") ?? "").trim();
      const spouseCombined =
        [spouseFirst, spouseLast].filter(Boolean).join(" ").trim() || null;

      const mobile = digitsOnly(phoneMobile) || null;
      const work = digitsOnly(phoneWork) || null;
      const home = digitsOnly(phoneHome) || null;

      const row = {
        first_name,
        last_name,
        nickname: String(fd.get("nickname") ?? "").trim() || null,
        verbal_password: formData.verbal_password.trim() || null,
        spouse_first_name: spouseFirst || null,
        spouse_last_name: spouseLast || null,
        spouse_name: spouseCombined,
        spouse_nickname: String(fd.get("spouse_nickname") ?? "").trim() || null,
        email: email || null,
        phone: mobile,
        phone_mobile: mobile,
        phone_work: work,
        phone_home: home,
        street_address: street.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip_code: zip.trim() || null,
        assigned_to: String(fd.get("assigned_to") ?? "").trim(),
        mid_id: String(fd.get("mid_id") ?? "").trim(),
        stage: "lead" as const,
        is_active: true,
      };

      setSubmitting(true);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        setSubmitting(false);
        toast.error("Not signed in.");
        return;
      }

      const { data: newClient, error: insErr } = await supabase
        .from("clients")
        .insert(row)
        .select("id")
        .single();

      if (insErr) {
        setSubmitting(false);
        toast.error(toUserFacingError(insErr.message));
        return;
      }

      if (!newClient?.id) {
        setSubmitting(false);
        toast.error("Could not read the new client id. Try again.");
        return;
      }

      void enrollWelcomeLeadForNewClientAction(newClient.id, email || null);

      setSubmitting(false);
      toast.success("Client added successfully");
      router.push(`/clients/${newClient.id}`);
      router.refresh();
    },
    [
      router,
      supabase,
      validateForm,
      scrollToFirstError,
      toast,
      phoneMobile,
      phoneWork,
      phoneHome,
      street,
      city,
      state,
      zip,
      formData.verbal_password,
    ]
  );

  const inputClass = (name: string, hasErr: boolean) =>
    `mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-[#071929] dark:text-white ${
      hasErr
        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
        : "border-slate-200 focus:border-[#8DE3B5] focus:ring-[#8DE3B5]/20 dark:border-[#1a3550]"
    }`;

  const labelStrong = "font-medium text-slate-800 dark:text-slate-200";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="New client" />
      <main className="mx-auto min-w-0 w-full max-w-2xl flex-1 px-6 py-5">
      <nav className="text-[13px] text-slate-600 dark:text-slate-400" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/dashboard" className="font-medium text-[#8DE3B5] hover:underline">
              Dashboard
            </Link>
          </li>
          <li className="text-slate-400">/</li>
          <li>
            <Link href="/clients" className="font-medium text-[#8DE3B5] hover:underline">
              Clients
            </Link>
          </li>
          <li className="text-slate-400">/</li>
          <li className="font-medium text-slate-900 dark:text-slate-200">New client</li>
        </ol>
      </nav>

      <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-400">
        Required fields are marked with <span className="text-red-600">*</span>. Start typing the street
        address to see suggestions and fill city, state, and ZIP.
      </p>

      <form ref={formRef} onSubmit={onSubmit} className="mt-6 w-full min-w-0 space-y-6" noValidate>
        <section className="zb-card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Client information
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm" data-field="first_name">
              <span className={labelStrong}>
                Primary first name <span className="text-red-600">*</span>
              </span>
              <input
                name="first_name"
                autoComplete="given-name"
                onChange={() => clearFieldError("first_name")}
                className={inputClass("first_name", Boolean(fieldErrors.first_name))}
              />
              {fieldErrors.first_name ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.first_name}</p>
              ) : null}
            </label>
            <label className="block text-sm" data-field="last_name">
              <span className={labelStrong}>
                Primary last name <span className="text-red-600">*</span>
              </span>
              <input
                name="last_name"
                autoComplete="family-name"
                onChange={() => clearFieldError("last_name")}
                className={inputClass("last_name", Boolean(fieldErrors.last_name))}
              />
              {fieldErrors.last_name ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.last_name}</p>
              ) : null}
            </label>
            <label className="block text-sm">
              <span className={labelStrong}>Primary nickname</span>
              <input
                name="nickname"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              />
            </label>
            <label className="block text-sm">
              <span className={labelStrong}>Secondary first name</span>
              <input
                name="spouse_first_name"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              />
            </label>
            <label className="block text-sm">
              <span className={labelStrong}>Secondary last name</span>
              <input
                name="spouse_last_name"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              />
            </label>
            <label className="block text-sm">
              <span className={labelStrong}>Secondary nickname</span>
              <input
                name="spouse_nickname"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm" data-field="email">
              <span className={labelStrong}>
                Email <span className="text-red-600">*</span>
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                onChange={() => clearFieldError("email")}
                className={inputClass("email", Boolean(fieldErrors.email))}
              />
              {fieldErrors.email ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              ) : null}
            </label>
            <label className="block text-sm" data-field="phone_mobile">
              <span className={labelStrong}>
                Mobile phone <span className="text-red-600">*</span>
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phoneMobile}
                onChange={(e) => {
                  setPhoneMobile(formatPhoneMask(e.target.value));
                  clearFieldError("phone_mobile");
                }}
                placeholder="(555) 555-5555"
                className={inputClass("phone_mobile", Boolean(fieldErrors.phone_mobile))}
              />
              {fieldErrors.phone_mobile ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.phone_mobile}</p>
              ) : null}
            </label>
            <label className="block text-sm">
              <span className={labelStrong}>Work phone</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phoneWork}
                onChange={(e) => setPhoneWork(formatPhoneMask(e.target.value))}
                placeholder="(555) 555-5555"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              />
            </label>
            <label className="block text-sm">
              <span className={labelStrong}>Home phone</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phoneHome}
                onChange={(e) => setPhoneHome(formatPhoneMask(e.target.value))}
                placeholder="(555) 555-5555"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/20 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div data-field="verbal_password">
              <label
                htmlFor="new_client_verbal_password"
                className="text-sm font-medium text-gray-700 dark:text-slate-300"
              >
                Verbal Password <span className="text-red-500">*</span>
              </label>
              <input
                id="new_client_verbal_password"
                type="text"
                name="verbal_password"
                required
                value={formData.verbal_password || ""}
                onChange={(e) => {
                  clearFieldError("verbal_password");
                  setFormData({
                    ...formData,
                    verbal_password: e.target.value,
                  });
                }}
                placeholder="Used to verify client identity on calls"
                className={`mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 dark:bg-[#071929] dark:text-white dark:focus:border-green-500 dark:focus:ring-green-500/40 ${
                  fieldErrors.verbal_password
                    ? "border border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                    : "border border-gray-300 focus:border-green-500 focus:ring-green-500 dark:border-[#1a3550]"
                }`}
              />
              {fieldErrors.verbal_password ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.verbal_password}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="zb-card w-full min-w-0 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Address
          </h2>
          <div className="w-full min-w-0 max-w-full">
            <AddressFields
              labels="account"
              streetValue={street}
              cityValue={city}
              stateValue={state}
              zipValue={zip}
              onStreetChange={(v) => {
                setStreet(v);
                clearFieldError("street_address");
              }}
              onCityChange={(v) => {
                setCity(v);
                clearFieldError("city");
              }}
              onStateChange={(v) => {
                setState(v);
                clearFieldError("state");
              }}
              onZipChange={(v) => {
                setZip(v);
                clearFieldError("zip_code");
              }}
              onAddressFieldsCommit={() => {
                clearFieldError("street_address");
                clearFieldError("city");
                clearFieldError("state");
                clearFieldError("zip_code");
              }}
              fieldErrors={fieldErrors}
              inputClass={inputClass}
            />
          </div>
        </section>

        <section className="zb-card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Case details
          </h2>
          <label className="block text-sm" data-field="assigned_to">
            <span className={labelStrong}>
              Account Manager <span className="text-red-600">*</span>
            </span>
            <select
              name="assigned_to"
              disabled={loadingTeam}
              onChange={() => clearFieldError("assigned_to")}
              className={inputClass("assigned_to", Boolean(fieldErrors.assigned_to))}
            >
              <option value="">Select…</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name?.trim() || "Account manager"}
                </option>
              ))}
            </select>
            {fieldErrors.assigned_to ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.assigned_to}</p>
            ) : null}
            {team.length === 0 && !loadingTeam ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                No active Account Managers found.
              </p>
            ) : null}
          </label>

          <label className="block text-sm" data-field="mid_id">
            <span className={labelStrong}>
              MID <span className="text-red-600">*</span>
            </span>
            <select
              name="mid_id"
              disabled={loadingMids}
              onChange={() => clearFieldError("mid_id")}
              className={inputClass("mid_id", Boolean(fieldErrors.mid_id))}
            >
              <option value="">Select…</option>
              {mids.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {fieldErrors.mid_id ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.mid_id}</p>
            ) : null}
            {mids.length === 0 && !loadingMids ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                No MIDs yet. Add one in Settings → MIDs.
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              The client stays on this MID through to attorney hand-off, and it
              decides which e-sign documents they receive.
            </p>
          </label>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/clients"
            className="text-center text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: BRAND_PRIMARY }}
          >
            {submitting ? "Saving…" : "Add client"}
          </button>
        </div>
      </form>
    </main>
    </div>
  );
}

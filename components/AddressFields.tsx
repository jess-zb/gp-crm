"use client";

import { useCallback } from "react";
import AddressAutocomplete, { type AddressResult } from "@/app/components/AddressAutocomplete";

export function AddressFields({
  streetValue,
  onStreetChange,
  cityValue,
  onCityChange,
  stateValue,
  onStateChange,
  zipValue,
  onZipChange,
  inputClass,
  onAddressFieldsCommit,
  fieldErrors,
  labels = "default",
}: {
  streetValue: string;
  onStreetChange: (v: string) => void;
  cityValue: string;
  onCityChange: (v: string) => void;
  stateValue: string;
  onStateChange: (v: string) => void;
  zipValue: string;
  onZipChange: (v: string) => void;
  inputClass: (name: string, hasErr: boolean) => string;
  onAddressFieldsCommit?: () => void;
  fieldErrors?: Partial<Record<string, string>>;
  labels?: "default" | "account";
}) {
  const onSelectAddress = useCallback(
    (addr: AddressResult) => {
      onStreetChange(addr.street);
      onCityChange(addr.city);
      onStateChange(addr.state);
      onZipChange(addr.zip);
      onAddressFieldsCommit?.();
    },
    [onStreetChange, onCityChange, onStateChange, onZipChange, onAddressFieldsCommit]
  );

  const labelClass =
    labels === "account"
      ? "font-medium text-slate-700 dark:text-slate-300"
      : "font-medium text-slate-800 dark:text-slate-200";

  const streetErr = Boolean(fieldErrors?.street_address);
  const streetClassName = `mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#A87830] focus:outline-none focus:ring-1 focus:ring-[#A87830] dark:bg-[#121212] dark:text-white dark:focus:border-[#A87830] ${
    streetErr
      ? "border-red-500 focus:border-red-500 dark:border-red-500"
      : "border-slate-200 dark:border-[#2E2E2E]"
  }`;

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
      <div
        className="col-span-full min-w-0 md:col-span-2"
        data-field="street_address"
      >
        <label className="block min-w-0 text-sm">
          <span className={labelClass}>
            Street address <span className="text-red-600">*</span>
          </span>
          <AddressAutocomplete
            name="street_address"
            value={streetValue}
            onChange={onStreetChange}
            onSelect={onSelectAddress}
            placeholder="Start typing an address…"
            className={streetClassName}
          />
          {fieldErrors?.street_address ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.street_address}</p>
          ) : null}
        </label>
      </div>
      <label className="block min-w-0 text-sm" data-field="city">
        <span className={labelClass}>
          City <span className="text-red-600">*</span>
        </span>
        <input
          name="city"
          autoComplete="address-level2"
          value={cityValue}
          onChange={(e) => onCityChange(e.target.value)}
          className={inputClass("city", Boolean(fieldErrors?.city))}
        />
        {fieldErrors?.city ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.city}</p>
        ) : null}
      </label>
      <label className="block min-w-0 text-sm" data-field="state">
        <span className={labelClass}>
          State <span className="text-red-600">*</span>
        </span>
        <input
          name="state"
          autoComplete="address-level1"
          value={stateValue}
          onChange={(e) => onStateChange(e.target.value)}
          className={inputClass("state", Boolean(fieldErrors?.state))}
        />
        {fieldErrors?.state ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.state}</p>
        ) : null}
      </label>
      <label className="block min-w-0 text-sm" data-field="zip_code">
        <span className={labelClass}>
          ZIP code <span className="text-red-600">*</span>
        </span>
        <input
          name="zip_code"
          autoComplete="postal-code"
          value={zipValue}
          onChange={(e) => onZipChange(e.target.value)}
          className={inputClass("zip_code", Boolean(fieldErrors?.zip_code))}
        />
        {fieldErrors?.zip_code ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.zip_code}</p>
        ) : null}
      </label>
    </div>
  );
}

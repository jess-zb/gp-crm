"use client";

import { Search } from "lucide-react";

/**
 * Search box for the Refunds queue.
 *
 * Deliberately the same markup and position as the client list's search so the
 * top of every Clients tab looks alike. The behaviour differs, though: Refunds
 * already loads its whole working set, so this filters what is on screen
 * instead of navigating, and it stays inside the current tab rather than
 * spanning every client the way the list's search does.
 */
export function BoardSearchInput({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  /** Screen-reader label; the visible field has no caption, like the list. */
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div
      className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap"
      role="search"
    >
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <div className="relative w-full max-w-md">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          aria-label="Search"
        />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="crm-input w-full pl-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830]"
        />
      </div>
      {value.trim() ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="crm-btn-secondary"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

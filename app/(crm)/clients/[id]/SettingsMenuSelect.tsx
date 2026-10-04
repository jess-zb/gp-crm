"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type MenuOption = {
  value: string;
  label: string;
};

export function SettingsMenuSelect({
  name,
  label,
  defaultValue,
  options,
  emptyLabel,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: MenuOption[];
  emptyLabel: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setSelected(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const items: MenuOption[] = [{ value: "", label: emptyLabel }, ...options];
  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase())
  );
  const current = items.find((item) => item.value === selected) ?? items[0];

  function choose(value: string) {
    setSelected(value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="text-sm">
    <div ref={rootRef} className="relative w-full max-w-xs">
      <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setQuery("");
          setActiveIndex(Math.max(0, items.findIndex((item) => item.value === selected)));
          setOpen((isOpen) => !isOpen);
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 text-left text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
          open
            ? "border-[#A87830]"
            : "border-slate-200 hover:border-slate-300 dark:border-[#3A3A3A] dark:hover:border-[#4A4A4A]"
        }`}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <div className="border-b border-slate-100 p-2 dark:border-[#2E2E2E]">
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index) => Math.max(index - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const pick = filtered[activeIndex];
                  if (pick) choose(pick.value);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder="Search"
              aria-label={`Search ${label}`}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-[#A87830] dark:border-[#3A3A3A] dark:bg-[#121212] dark:text-white"
            />
          </div>
          <ul id={listId} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-slate-400">No matches</li>
            ) : (
              filtered.map((item, index) => {
                const isSelected = item.value === selected;
                const isActive = index === activeIndex;
                return (
                  <li key={item.value || "empty"} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(item.value)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${
                        isSelected
                          ? "bg-[#F7F1E8] text-slate-900 dark:bg-[#2A2418] dark:text-white"
                          : isActive
                            ? "bg-slate-50 text-slate-900 dark:bg-[#242424] dark:text-white"
                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#242424]"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#A87830]" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
    </div>
  );
}

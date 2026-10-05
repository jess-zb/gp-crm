"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type MenuOption = {
  value: string;
  label: string;
};

type MenuPlace = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
};

function measureMenu(button: HTMLButtonElement): MenuPlace {
  const rect = button.getBoundingClientRect();
  const gap = 6;
  const below = window.innerHeight - rect.bottom - gap - 8;
  const above = rect.top - gap - 8;
  const openUp = below < 220 && above > below;
  return {
    top: openUp ? rect.top - gap : rect.bottom + gap,
    left: rect.left,
    width: Math.max(rect.width, 220),
    maxHeight: Math.max(180, Math.min(320, openUp ? above : below)),
    openUp,
  };
}

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [place, setPlace] = useState<MenuPlace | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSelected(defaultValue);
  }, [defaultValue]);

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    if (!button) return;
    const update = () => setPlace(measureMenu(button));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open && place) searchRef.current?.focus();
  }, [open, place]);

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

  const menu =
    open && mounted && place
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: place.top,
              left: place.left,
              width: place.width,
              maxHeight: place.maxHeight,
              transform: place.openUp ? "translateY(-100%)" : undefined,
              zIndex: 80,
            }}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
          >
            <div className="shrink-0 border-b border-slate-100 p-2 dark:border-[#2E2E2E]">
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
                    setActiveIndex((index) =>
                      Math.min(index + 1, Math.max(filtered.length - 1, 0))
                    );
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
            <ul
              id={listId}
              role="listbox"
              aria-label={label}
              className="min-h-0 flex-1 overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-slate-500">No matches</li>
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
                              : "text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-[#242424]"
                        }`}
                      >
                        <span className="min-w-0 flex-1 whitespace-normal break-words">
                          {item.label}
                        </span>
                        {isSelected ? (
                          <Check className="h-4 w-4 shrink-0 text-[#A87830]" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="text-sm">
      <div ref={rootRef} className="relative w-full max-w-xs">
        <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <input type="hidden" name={name} value={selected} />
        <button
          ref={buttonRef}
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
          <span className="min-w-0 flex-1 truncate">{current?.label}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {menu}
      </div>
    </div>
  );
}

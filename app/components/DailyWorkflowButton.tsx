"use client";

import { useEffect, useRef, useState } from "react";
import { Route } from "lucide-react";
import { requestDailyWorkflowTour } from "@/lib/tours/daily-workflow";

const TOURS = [{ id: "daily-workflow", label: "Daily workflow", start: requestDailyWorkflowTour }] as const;

/** Corner launcher, kept with the clock, search, and chat. One click opens the list of tours. */
export function DailyWorkflowButton() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <div
          role="menu"
          aria-label="Guided tours"
          className="absolute bottom-14 right-0 z-50 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Guided tours
          </p>
          {TOURS.map((tour) => (
            <button
              key={tour.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-[#242424]"
              onClick={() => {
                setOpen(false);
                tour.start();
              }}
            >
              {tour.label}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Guided tours"
        aria-label="Guided tours"
        aria-expanded={open}
        aria-haspopup="menu"
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-[#A87830] shadow-sm transition-colors hover:border-[#A87830] hover:bg-[#A87830] hover:text-[#161616] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:hover:border-[#A87830]"
      >
        <Route className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

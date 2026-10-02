import type { ReactNode } from "react";

/**
 * Linear-style top bar for CRM pages (56px). Use inside full-width column layouts.
 */
export function CrmPageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-6 dark:border-[#1a3550] dark:bg-[#0d2035]">
      <h1 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {title}
      </h1>
      {children ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

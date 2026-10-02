"use client";

import type { ReactNode } from "react";

/**
 * Backdrop and centring for a dialog, in a way that cannot strand its own
 * buttons off-screen.
 *
 * The obvious `fixed inset-0 flex items-center justify-center` backdrop looks
 * right until the panel is taller than the window — a modal that reveals extra
 * fields as you fill it in, a laptop with a short window, a zoomed-in browser.
 * A fixed element does not scroll, so the overflow is simply unreachable and
 * only the page behind moves. `min-h-full` keeps a short dialog centred and
 * lets a tall one scroll the backdrop instead.
 *
 * A panel whose height varies a lot should also cap itself and pin its actions
 * — `flex max-h-[calc(100vh-2rem)] flex-col` with the body in a scrolling div —
 * so the buttons need no scrolling at all. The cancellation modal in
 * `ClientStageHeader` is the worked example.
 */
export function ModalOverlay({
  labelledBy,
  className = "z-[200] bg-black/50",
  onBackdropClick,
  children,
}: {
  labelledBy?: string;
  /** Stacking and backdrop tint only; the scrolling behaviour is fixed. */
  className?: string;
  /** Leave unset for a dialog that must be answered rather than dismissed. */
  onBackdropClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 overflow-y-auto ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={
          onBackdropClick
            ? (e) => {
                // Only a click on the backdrop itself; clicks inside the panel
                // bubble up here with a different target.
                if (e.target === e.currentTarget) onBackdropClick();
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

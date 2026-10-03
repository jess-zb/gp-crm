"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ToastType = "success" | "error" | "warning";

export type ToastAction = { label: string; onClick: () => void };

export type ToastOptions = {
  action?: ToastAction;
  durationMs?: number;
};

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
  durationMs: number;
};

type ToastContextValue = {
  success: (message: string, opts?: ToastOptions) => void;
  error: (message: string, opts?: ToastOptions) => void;
  warning: (message: string, opts?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DISMISS_MS = 3000;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

function ToastBubble({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(item.id), item.durationMs);
    return () => clearTimeout(t);
  }, [item.id, item.durationMs, onDismiss]);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition duration-200 ease-out ${
        item.type === "success"
          ? "bg-[#A87830]"
          : item.type === "warning"
            ? "bg-amber-600"
            : "bg-red-600"
      }`}
      role="status"
    >
      <span className="flex-1">{item.message}</span>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className="shrink-0 rounded border border-white/70 px-2 py-0.5 text-xs font-semibold text-white transition hover:bg-white/20"
        >
          {item.action.label}
        </button>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string, opts?: ToastOptions) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now());
      setToasts((t) => [
        ...t,
        {
          id,
          type,
          message,
          action: opts?.action,
          durationMs: opts?.durationMs ?? DEFAULT_DISMISS_MS,
        },
      ]);
    },
    []
  );

  const success = useCallback(
    (message: string, opts?: ToastOptions) => push("success", message, opts),
    [push]
  );
  const error = useCallback(
    (message: string, opts?: ToastOptions) => push("error", message, opts),
    [push]
  );
  const warning = useCallback(
    (message: string, opts?: ToastOptions) => push("warning", message, opts),
    [push]
  );

  return (
    <ToastContext.Provider value={{ success, error, warning }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[200] flex max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastBubble key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

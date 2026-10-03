"use client";

import { Mic, Square } from "lucide-react";
import { useSpeechToText } from "@/lib/hooks/use-speech-to-text";

export function DictationMicButton({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const { supported, listening, error, toggle } = useSpeechToText({
    value,
    onChange,
  });

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || !supported}
        aria-pressed={listening}
        aria-label={
          !supported
            ? "Dictate note (available in Chrome and Edge)"
            : listening
              ? "Stop dictation"
              : "Dictate note"
        }
        title={
          !supported
            ? "Dictation works in Chrome and Edge"
            : listening
              ? "Stop dictation"
              : "Dictate note"
        }
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] disabled:cursor-not-allowed disabled:opacity-50 ${
          listening
            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-300 dark:hover:bg-[#242424]"
        }`}
      >
        {listening ? (
          <Square className="h-4 w-4 fill-current" aria-hidden />
        ) : (
          <Mic className="h-4 w-4" aria-hidden />
        )}
        <span>{listening ? "Stop" : "Dictate"}</span>
      </button>
      {listening ? (
        <p
          className="text-xs font-medium text-red-600 dark:text-red-400"
          aria-live="polite"
        >
          Listening…
        </p>
      ) : null}
      {error ? (
        <p
          className="max-w-[14rem] text-right text-xs font-medium text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

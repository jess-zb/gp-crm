"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HelpDeskRole } from "@/app/(crm)/help/helpContent";
import type { GuideStep } from "@/lib/help/guide-registry";
import "./guide-walkthrough.css";

function readStorageKey(userId: string, role: string, articleId: string) {
  return `zb-help-guide-read:${userId}:${role}:${articleId}`;
}

function GuideMockFrame({
  step,
  stepIndex,
  totalSteps,
}: {
  step: GuideStep;
  stepIndex: number;
  totalSteps: number;
}) {
  const h = step.highlight;

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner dark:border-[#1a3550] dark:bg-[#0a120b]">
      <div className="flex aspect-[16/10] min-h-[220px] w-full">
        {/* Fake sidebar */}
        <div className="flex w-[24%] min-w-[72px] flex-col gap-2 border-r border-slate-200 bg-slate-200/80 p-2 dark:border-[#1a3550] dark:bg-[#0d2035]">
          <div className="h-2 w-12 rounded bg-slate-400/80 dark:bg-slate-600" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-6 rounded-md ${
                i === (stepIndex % 5)
                  ? "bg-[#8DE3B5]/40 ring-2 ring-[#8DE3B5]/60"
                  : "bg-slate-300/60 dark:bg-slate-700/80"
              }`}
            />
          ))}
        </div>
        {/* Fake main */}
        <div className="relative flex flex-1 flex-col gap-2 p-3">
          <div className="h-3 w-1/3 rounded bg-slate-300 dark:bg-slate-600" />
          <div className="h-24 flex-1 rounded-lg border border-slate-200 bg-white dark:border-[#1a3550] dark:bg-[#0d2035]" />
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-lg bg-[#8DE3B5]/30" />
            <div className="h-8 w-20 rounded-lg bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>

      {/* Dim overlay + spotlight hole via huge inset shadow */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden
      >
        <div
          className="zb-guide-spotlight absolute rounded-lg bg-transparent ring-2 ring-[#8DE3B5]"
          style={{
            left: `${h.left}%`,
            top: `${h.top}%`,
            width: `${h.width}%`,
            height: `${h.height}%`,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)",
          }}
        />
      </div>

      {/* Step number */}
      <div
        key={stepIndex}
        className="zb-guide-step-badge absolute left-3 top-3 z-[2] flex h-9 min-w-[2.25rem] items-center justify-center rounded-full bg-[#8DE3B5] px-3 text-sm font-bold text-[#0A2540] shadow-lg"
      >
        {stepIndex + 1} / {totalSteps}
      </div>

      {/* Animated pointer + arrow toward hotspot */}
      <svg
        className="zb-guide-pointer absolute z-[2] h-12 w-12 text-amber-500"
        style={{
          left: `calc(${h.left + h.width * 0.65}% - 24px)`,
          top: `calc(${h.top + h.height}% + 4px)`,
        }}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M8 40 L8 14 L22 26 L18 28 L26 38 L22 40 L14 30 L10 32 Z"
        />
      </svg>
      <svg
        className="zb-guide-arrow absolute z-[2] h-8 w-8 text-[#8DE3B5]"
        style={{
          left: `calc(${h.left + h.width * 0.35}% )`,
          top: `calc(${h.top - 8}% )`,
        }}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M12 4 L20 14 L14 14 L14 22 L10 22 L10 14 L4 14 Z"
        />
      </svg>
    </div>
  );
}

export default function GuideWalkthroughClient({
  role,
  articleId,
  articleTitle,
  categoryTitle,
  steps,
  userId,
}: {
  role: HelpDeskRole;
  articleId: string;
  articleTitle: string;
  categoryTitle: string;
  steps: GuideStep[];
  userId: string;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const storageKey = useMemo(
    () => readStorageKey(userId, role, articleId),
    [userId, role, articleId]
  );

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      setCompleted(Boolean(v));
    } catch {
      setCompleted(false);
    }
  }, [storageKey]);

  const safeStep = Math.min(currentStep, Math.max(0, steps.length - 1));
  const step = steps[safeStep];
  const progressPct =
    steps.length > 0 ? ((safeStep + 1) / steps.length) * 100 : 0;

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    utteranceRef.current = null;
  }, []);

  const speakStep = useCallback(
    (index: number) => {
      if (typeof window === "undefined" || !window.speechSynthesis || !steps[index]) {
        return;
      }
      stopSpeech();
      const text = steps[index].narration;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.pitch = 1;
      utteranceRef.current = u;
      u.onend = () => setPlaying(false);
      u.onerror = () => setPlaying(false);
      window.speechSynthesis.speak(u);
      setPlaying(true);
    },
    [steps, stopSpeech]
  );

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  useEffect(() => {
    stopSpeech();
  }, [safeStep, stopSpeech]);

  function togglePlay() {
    if (!step) return;
    if (playing) {
      stopSpeech();
      return;
    }
    speakStep(safeStep);
  }

  function goPrev() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  function goNext() {
    setCurrentStep((s) => Math.min(steps.length - 1, s + 1));
  }

  function markGotIt() {
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      /* private mode */
    }
    setCompleted(true);
    stopSpeech();
  }

  if (!steps.length || !step) {
    return (
      <p className="text-slate-600 dark:text-slate-400">
        No steps available for this guide.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-600 dark:text-slate-400">
        <Link href="/help" className="font-medium text-[#8DE3B5] hover:underline">
          Help Center
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-500">{categoryTitle}</span>
        <span className="mx-2 text-slate-400">/</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          Guided tour
        </span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {articleTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Interactive walkthrough with voice — browser Text-to-Speech (no audio files).
        </p>
      </header>

      <GuideMockFrame
        step={step}
        stepIndex={safeStep}
        totalSteps={steps.length}
      />

      {/* Progress */}
      <div>
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>
            Step {safeStep + 1} of {steps.length}
          </span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-[#8DE3B5] transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Narration */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {step.title}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
          {step.narration}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-lg bg-[#8DE3B5] px-4 py-2.5 text-sm font-bold text-[#0A2540] shadow-md transition hover:opacity-95"
        >
          {playing ? "Pause voice" : "Play voice"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={safeStep <= 0}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-40 dark:border-[#1a3550] dark:text-slate-200"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={safeStep >= steps.length - 1}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-40 dark:border-[#1a3550] dark:text-slate-200"
          >
            Next
          </button>
        </div>
        <button
          type="button"
          onClick={markGotIt}
          className={`rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm transition ${
            completed
              ? "border border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
              : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-white dark:hover:bg-[#102840]"
          }`}
        >
          {completed ? "Marked as read ✓" : "Got it"}
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Tip: Voice uses your browser&apos;s built-in speech. If nothing plays, check
        system volume and site permissions.
      </p>
    </div>
  );
}

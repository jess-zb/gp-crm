"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  MapPin,
  Monitor,
} from "lucide-react";
import type { Guide, GuideStep } from "@/lib/help/guide-content";
import {
  ATTORNEY_TEACH_ME_ITEMS,
  COURSE_LESSONS,
  guidesForAttorneyPortal,
  guidesForViewer,
  type GuideItem,
} from "@/lib/help/guides-index";
import { useToast } from "@/app/components/Toast";

const LS_PREFIX = "teach-me-guide-complete:";
const LS_COMPLETED = "zb-completed-lessons";

function readCompletedSlugs(): string[] {
  try {
    const raw = localStorage.getItem(LS_COMPLETED);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]).filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function orderedLessonsForSlug(slug: string, viewerRole: string): GuideItem[] {
  if (COURSE_LESSONS.some((l) => l.slug === slug)) {
    return guidesForViewer(viewerRole);
  }
  if (ATTORNEY_TEACH_ME_ITEMS.some((l) => l.slug === slug)) {
    return guidesForAttorneyPortal(viewerRole);
  }
  return [];
}

function confettiStyles() {
  const colors = ["#8DE3B5", "#8DE3B5", "#FFD700", "#FF6B6B"];
  return Array.from({ length: 20 }, (_, i) => ({
    left: `${(i * 47 + 13) % 92}%`,
    top: `${(i * 31 + 7) % 85}%`,
    backgroundColor: colors[i % 4]!,
    animationDelay: `${(i % 10) * 0.05}s`,
    animationDuration: `${0.6 + (i % 5) * 0.12}s`,
  }));
}

function useCourseLessonCompletion(guideSlug: string, nextLesson: GuideItem | null) {
  const toast = useToast();
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setCompleted(readCompletedSlugs().includes(guideSlug));
  }, [guideSlug]);

  const handleMarkComplete = useCallback(() => {
    const saved = readCompletedSlugs();
    if (!saved.includes(guideSlug)) {
      saved.push(guideSlug);
      try {
        localStorage.setItem(LS_COMPLETED, JSON.stringify(saved));
      } catch {
        /* ignore */
      }
    }
    setCompleted(true);

    if (nextLesson) {
      toast.success(`Lesson complete! Up next: ${nextLesson.title}`);
    } else {
      toast.success("🎉 You completed the entire course!");
    }
  }, [guideSlug, nextLesson, toast]);

  return { completed, handleMarkComplete };
}

function CourseDemoView({
  guide,
  viewerRole,
  backHref,
}: {
  guide: Guide;
  viewerRole: string;
  backHref: string;
}) {
  const lessons = useMemo(
    () => orderedLessonsForSlug(guide.slug, viewerRole),
    [guide.slug, viewerRole]
  );
  const currentIdx = lessons.findIndex((l) => l.slug === guide.slug);
  const prevLesson = currentIdx > 0 ? lessons[currentIdx - 1] : null;
  const nextLesson =
    currentIdx >= 0 && currentIdx < lessons.length - 1 ? lessons[currentIdx + 1]! : null;

  const { completed, handleMarkComplete } = useCourseLessonCompletion(guide.slug, nextLesson);

  const guideLink = (slug: string) =>
    backHref.includes("/attorney/help")
      ? `/help/guide/${slug}?back=${encodeURIComponent(backHref)}`
      : `/help/guide/${slug}`;

  const backToAll = backHref.includes("/attorney/help") ? "/attorney/help" : "/help";

  return (
    <div className="mx-auto w-full min-w-0 max-w-[96rem] pb-16">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={backToAll}
            className="flex shrink-0 items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">All Lessons</span>
          </Link>
          <div className="flex items-center gap-1">
            {prevLesson ? (
              <Link
                href={guideLink(prevLesson.slug)}
                className="rounded-lg border border-gray-200 p-1.5 transition-colors hover:bg-gray-50 dark:border-[#1a3550] dark:hover:bg-[#102840]"
                title={prevLesson.title}
              >
                <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              </Link>
            ) : null}
            <span className="px-1 text-xs text-gray-400 dark:text-slate-500">
              {lessons.length > 0 ? `${currentIdx + 1} / ${lessons.length}` : "0 / 0"}
            </span>
            {nextLesson ? (
              <Link
                href={guideLink(nextLesson.slug)}
                className="rounded-lg border border-gray-200 p-1.5 transition-colors hover:bg-gray-50 dark:border-[#1a3550] dark:hover:bg-[#102840]"
                title={nextLesson.title}
              >
                <ChevronRight className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              </Link>
            ) : null}
          </div>
        </div>

        {!completed ? (
          <button
            type="button"
            onClick={handleMarkComplete}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-[#8DE3B5] px-3 py-1.5 text-xs font-medium text-[#8DE3B5] transition-colors hover:bg-green-50 dark:border-[#8DE3B5] dark:text-[#8DE3B5] dark:hover:bg-[#102840] sm:px-4 sm:py-2 sm:text-sm"
          >
            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Mark Complete</span>
            <span className="sm:hidden">Complete</span>
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-[#8DE3B5] bg-green-50 px-3 py-1.5 dark:bg-[#102840] sm:px-4 sm:py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#8DE3B5] dark:text-[#8DE3B5] sm:h-4 sm:w-4" />
            <span className="text-xs font-medium text-[#8DE3B5] dark:text-[#8DE3B5] sm:text-sm">
              <span className="hidden sm:inline">Completed</span>
              <span className="sm:hidden">Done</span>
            </span>
          </div>
        )}
      </div>

      <div className="mb-6">
        {guide.lesson_number ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#8DE3B5] dark:text-[#8DE3B5]">
            Lesson {guide.lesson_number}
          </p>
        ) : null}
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{guide.title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{guide.intro}</p>
      </div>

      {guide.demo_url ? (
        <div className="relative aspect-[1920/839] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-900 shadow-md dark:border-[#1a3550]">
          <iframe
            src={guide.demo_url}
            className="absolute inset-0 h-full w-full border-0"
            title={guide.title}
            allowFullScreen
            allow="fullscreen"
          />
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center dark:border-[#1a3550] dark:bg-[#071929]">
          <p className="text-sm text-gray-500 dark:text-slate-400">Video coming soon</p>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-gray-400 dark:text-slate-500">
        Follow the highlighted steps in the lesson above
      </p>
    </div>
  );
}

function CourseIntroOnlyView({
  guide,
  viewerRole,
  backHref,
}: {
  guide: Guide;
  viewerRole: string;
  backHref: string;
}) {
  const lessons = useMemo(
    () => orderedLessonsForSlug(guide.slug, viewerRole),
    [guide.slug, viewerRole]
  );
  const currentIdx = lessons.findIndex((l) => l.slug === guide.slug);
  const prevLesson = currentIdx > 0 ? lessons[currentIdx - 1] : null;
  const nextLesson =
    currentIdx >= 0 && currentIdx < lessons.length - 1 ? lessons[currentIdx + 1]! : null;

  const guideLink = (slug: string) =>
    backHref.includes("/attorney/help")
      ? `/help/guide/${slug}?back=${encodeURIComponent(backHref)}`
      : `/help/guide/${slug}`;

  const { completed, handleMarkComplete } = useCourseLessonCompletion(guide.slug, nextLesson);
  const backToAll = backHref.includes("/attorney/help") ? "/attorney/help" : "/help";

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl pb-16">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={backToAll}
            className="flex shrink-0 items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">All Lessons</span>
          </Link>
          <div className="flex items-center gap-1">
            {prevLesson ? (
              <Link
                href={guideLink(prevLesson.slug)}
                className="rounded-lg border border-gray-200 p-1.5 transition-colors hover:bg-gray-50 dark:border-[#1a3550] dark:hover:bg-[#102840]"
                title={prevLesson.title}
              >
                <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              </Link>
            ) : null}
            <span className="px-1 text-xs text-gray-400 dark:text-slate-500">
              {lessons.length > 0 ? `${currentIdx + 1} / ${lessons.length}` : "0 / 0"}
            </span>
            {nextLesson ? (
              <Link
                href={guideLink(nextLesson.slug)}
                className="rounded-lg border border-gray-200 p-1.5 transition-colors hover:bg-gray-50 dark:border-[#1a3550] dark:hover:bg-[#102840]"
                title={nextLesson.title}
              >
                <ChevronRight className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              </Link>
            ) : null}
          </div>
        </div>

        {!completed ? (
          <button
            type="button"
            onClick={handleMarkComplete}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-[#8DE3B5] px-3 py-1.5 text-xs font-medium text-[#8DE3B5] transition-colors hover:bg-green-50 dark:border-[#8DE3B5] dark:text-[#8DE3B5] dark:hover:bg-[#102840] sm:px-4 sm:py-2 sm:text-sm"
          >
            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Mark Complete</span>
            <span className="sm:hidden">Complete</span>
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-[#8DE3B5] bg-green-50 px-3 py-1.5 dark:bg-[#102840] sm:px-4 sm:py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#8DE3B5] dark:text-[#8DE3B5] sm:h-4 sm:w-4" />
            <span className="text-xs font-medium text-[#8DE3B5] dark:text-[#8DE3B5] sm:text-sm">
              <span className="hidden sm:inline">Completed</span>
              <span className="sm:hidden">Done</span>
            </span>
          </div>
        )}
      </div>

      <div className="mb-6">
        {guide.lesson_number ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#8DE3B5] dark:text-[#8DE3B5]">
            Lesson {guide.lesson_number}
          </p>
        ) : null}
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{guide.title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{guide.intro}</p>
      </div>

      <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center dark:border-[#1a3550] dark:bg-[#071929]">
        <Monitor className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
          Full interactive lesson coming soon
        </p>
      </div>
    </div>
  );
}

function GuideWrittenMode({ guide, backHref }: { guide: Guide; backHref: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const total = guide.steps.length;
  const step = guide.steps[stepIndex] as GuideStep | undefined;
  const isLast = stepIndex >= total - 1;

  const storageKey = `${LS_PREFIX}${guide.slug}`;

  const stopNarration = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "1") setMarkedComplete(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    stopNarration();
  }, [stepIndex, stopNarration]);

  useEffect(() => {
    return () => {
      stopNarration();
    };
  }, [stopNarration]);

  useEffect(() => {
    setScreenshotUrl(null);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return;
    const publicUrl = `${base}/storage/v1/object/public/guide-screenshots/${guide.slug}/step-${stepIndex + 1}.png`;
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setScreenshotUrl(publicUrl);
    };
    img.onerror = () => {
      if (!cancelled) setScreenshotUrl(null);
    };
    img.src = publicUrl;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [stepIndex, guide.slug]);

  const dots = useMemo(() => confettiStyles(), []);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  function onMarkComplete() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setMarkedComplete(true);
    setShowConfetti(true);
    window.setTimeout(() => setShowConfetti(false), 3500);
  }

  const toggleSpeak = useCallback(async () => {
    if (speaking) {
      stopNarration();
      return;
    }

    if (!step) return;

    const text = `${step.title}. ${step.description}. You can find this at: ${step.location}.${step.tip ? ` Tip: ${step.tip}` : ""}${step.warning ? ` Warning: ${step.warning}` : ""}`;

    setSpeaking(true);

    try {
      const res = await fetch("/api/elevenlabs/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.85;
          utterance.lang = "en-US";
          utterance.onend = () => setSpeaking(false);
          utterance.onerror = () => setSpeaking(false);
          window.speechSynthesis.speak(utterance);
        } else {
          setSpeaking(false);
        }
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setSpeaking(false);
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        audioRef.current = null;
      };

      audio.onerror = () => {
        setSpeaking(false);
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error("Voice error:", err);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.lang = "en-US";
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setSpeaking(false);
      }
    }
  }, [speaking, step, stopNarration]);

  if (!step) return null;

  const pct = Math.round(((stepIndex + 1) / total) * 100);

  return (
    <div className="mx-auto min-w-0 max-w-[min(42rem,calc(100vw-2rem))] px-1 pb-16 sm:px-0">
      {showConfetti ? (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {dots.map((style, i) => (
            <div
              key={i}
              className="absolute h-2 w-2 animate-bounce rounded-full"
              style={style}
            />
          ))}
        </div>
      ) : null}

      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#8DE3B5] hover:text-[#6BC99A] dark:text-[#8DE3B5]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Teach Me
        </Link>
      </div>

      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{guide.title}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{guide.intro}</p>

      <div className="mt-6">
        <div className="mb-1 flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
          <span>
            Step {stepIndex + 1} of {total}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-[#1a3550]">
          <div
            className="h-full rounded-full bg-[#8DE3B5] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-[#1a3550] dark:bg-[#0d2035]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8DE3B5] text-sm font-bold text-[#0A2540]">
            {stepIndex + 1}
          </span>
          <button
            type="button"
            onClick={() => void toggleSpeak()}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              speaking
                ? "bg-green-600 text-white dark:bg-[#6BC99A]"
                : "border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-[#1a3550] dark:text-slate-300 dark:hover:bg-[#102840]"
            }`}
            title={speaking ? "Click to stop" : "Listen to this step"}
          >
            {speaking ? (
              <>
                <span className="flex gap-0.5">
                  <span
                    className="h-3 w-0.5 animate-bounce rounded bg-white"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-3 w-0.5 animate-bounce rounded bg-white"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-3 w-0.5 animate-bounce rounded bg-white"
                    style={{ animationDelay: "300ms" }}
                  />
                </span>
                Stop
              </>
            ) : (
              <>🔊 Listen</>
            )}
          </button>
        </div>

        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {step.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-[#8DE3B5] dark:border-[#1a3550] dark:bg-[#071929] dark:text-[#8DE3B5]">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Where to find it:</span>
          <span>{step.location}</span>
        </div>

        {screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={screenshotUrl}
            alt={step.screenshotDescription}
            className="my-4 w-full rounded-xl border border-gray-200 shadow-sm dark:border-[#1a3550]"
          />
        ) : (
          <div className="my-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-[#1a3550] dark:bg-[#071929]">
            <Monitor className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-slate-600" />
            <p className="text-xs text-gray-400 dark:text-slate-500">{step.screenshotDescription}</p>
            <p className="mt-1 text-xs text-gray-300 dark:text-slate-600">Screenshot coming soon</p>
          </div>
        )}

        {step.tip ? (
          <div className="mb-3 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <span>{step.tip}</span>
          </div>
        ) : null}
        {step.warning ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <span>{step.warning}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={stepIndex === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-40 dark:border-[#1a3550] dark:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        {!isLast ? (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-lg bg-[#8DE3B5] px-4 py-2 text-sm font-semibold text-[#0A2540] hover:bg-[#6BC99A]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex flex-col items-end gap-2">
            {markedComplete ? (
              <p className="text-center text-sm font-semibold text-[#8DE3B5] dark:text-[#8DE3B5]">
                All done! 🎉
              </p>
            ) : (
              <button
                type="button"
                onClick={onMarkComplete}
                className="rounded-lg bg-[#8DE3B5] px-4 py-2 text-sm font-semibold text-[#0A2540] hover:bg-[#6BC99A]"
              >
                Mark as complete
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
        Tip: use ← → arrow keys to move between steps.
      </p>
    </div>
  );
}

export default function GuidePageClient({
  guide,
  viewerRole,
}: {
  guide: Guide;
  viewerRole: string;
}) {
  const searchParams = useSearchParams();
  const backHref = searchParams?.get("back") || "/help";

  const hasDemo = Boolean(guide.demo_url);
  const hasSteps = guide.steps.length > 0;

  if (hasDemo) {
    return <CourseDemoView guide={guide} viewerRole={viewerRole} backHref={backHref} />;
  }

  if (hasSteps) {
    return <GuideWrittenMode guide={guide} backHref={backHref} />;
  }

  return <CourseIntroOnlyView guide={guide} viewerRole={viewerRole} backHref={backHref} />;
}

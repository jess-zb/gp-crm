"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  GraduationCap,
  Play,
} from "lucide-react";
import { GUIDE_CONTENT } from "@/lib/help/guide-content";
import {
  guidesForAttorneyPortal,
  guidesForViewer,
  type GuideItem,
} from "@/lib/help/guides-index";

const LS_COMPLETED = "zb-completed-lessons";

function readCompleted(): string[] {
  try {
    const raw = localStorage.getItem(LS_COMPLETED);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]).filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

type Props = {
  viewerRole: string;
  variant?: "crm" | "attorney";
};

export function TeachMeCourseClient({ viewerRole, variant = "crm" }: Props) {
  const visibleLessons = useMemo<GuideItem[]>(
    () =>
      variant === "attorney"
        ? guidesForAttorneyPortal(viewerRole)
        : guidesForViewer(viewerRole),
    [viewerRole, variant]
  );

  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCompletedLessons(readCompleted());
    setMounted(true);
  }, []);

  const refreshCompleted = useCallback(() => {
    setCompletedLessons(readCompleted());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_COMPLETED) refreshCompleted();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshCompleted]);

  useEffect(() => {
    const onFocus = () => refreshCompleted();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshCompleted]);

  const completedCount = useMemo(
    () => visibleLessons.filter((l) => completedLessons.includes(l.slug)).length,
    [visibleLessons, completedLessons]
  );

  const totalCount = visibleLessons.length;

  const lastLesson = useMemo(
    () => visibleLessons.find((l) => !completedLessons.includes(l.slug)),
    [visibleLessons, completedLessons]
  );

  const pct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const barWidth = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const guideHref = (slug: string) =>
    variant === "attorney"
      ? `/help/guide/${slug}?back=${encodeURIComponent("/attorney/help")}`
      : `/help/guide/${slug}`;

  const courseTitle =
    variant === "attorney" ? "Attorney workspace guides" : "DebtSupportPros CRM course";

  return (
    <div className="mx-auto min-w-0 max-w-3xl">
      {variant === "crm" ? (
        <div className="mb-6 rounded-lg bg-[#0A2540] p-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <GraduationCap className="h-5 w-5 text-white/90" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Teach Me</h1>
              <p className="text-sm text-white/70">
                Step-by-step guides for using DebtSupportPros CRM
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 sm:mb-8 sm:p-6 dark:border-[#1a3550] dark:bg-[#0d2035]">
          <GraduationCap
            className="mx-auto mb-3 h-12 w-12 text-[#8DE3B5] dark:text-[#8DE3B5]"
            strokeWidth={1.75}
          />
          <h1 className="mb-2 text-center text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {courseTitle}
          </h1>
          <p className="mx-auto max-w-lg text-center text-[13px] text-slate-600 dark:text-slate-400">
            Step-by-step guides for your attorney workspace.
          </p>
        </div>
      )}

      {mounted && totalCount > 0 ? (
        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-5 dark:border-[#1a3550] dark:bg-[#0d2035]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-[#E8EAEE]">
                Your Progress
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                {completedCount} of {totalCount} lessons completed
              </p>
            </div>
            <span className="text-2xl font-bold text-[#8DE3B5] dark:text-[#8DE3B5]">
              {pct}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-[#071929]">
            <div
              className="h-2 rounded-full bg-[#8DE3B5] transition-all duration-500 dark:bg-[#8DE3B5]"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          {completedCount === totalCount && totalCount > 0 ? (
            <p className="mt-2 text-center text-xs font-medium text-[#8DE3B5] dark:text-[#8DE3B5]">
              Course complete. You&apos;re a DebtSupportPros CRM pro.
            </p>
          ) : null}
        </div>
      ) : null}

      {mounted && lastLesson && completedCount > 0 && completedCount < totalCount ? (
        <Link
          href={guideHref(lastLesson.slug)}
          className="mb-6 flex items-center justify-between rounded-lg bg-[#8DE3B5] p-4 text-[#0A2540] transition-colors hover:bg-[#6BC99A] group dark:hover:bg-[#6BC99A]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-xl">
              {lastLesson.icon}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-medium opacity-80">Continue where you left off</p>
              <p className="truncate text-sm font-bold">
                Lesson {lastLesson.lesson_number}: {lastLesson.title}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 opacity-80 transition-transform group-hover:translate-x-1" />
        </Link>
      ) : null}

      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8DE3B5] dark:text-[#8DE3B5]">
        {courseTitle}
      </p>

      {totalCount === 0 ? (
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          No lessons are available for your role yet.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleLessons.map((lesson) => {
            const isCompleted = completedLessons.includes(lesson.slug);
            const content = GUIDE_CONTENT[lesson.slug];
            const hasVideo = Boolean(content?.demo_url);
            const isNext = lesson.slug === lastLesson?.slug;

            return (
              <Link
                key={lesson.slug}
                href={guideHref(lesson.slug)}
                className={`group flex items-center gap-4 rounded-lg border p-4 transition-all ${
                  isCompleted
                    ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
                    : isNext
                      ? "border-[#8DE3B5] bg-white shadow-sm dark:border-[#8DE3B5] dark:bg-[#0d2035]"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035] dark:hover:border-[#3d5c40]"
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                    isCompleted
                      ? "bg-[#8DE3B5] text-[#0A2540]"
                      : isNext
                        ? "border-2 border-[#8DE3B5] bg-[#8DE3B5]/10 text-[#8DE3B5] dark:bg-[#102840]"
                        : "bg-gray-100 text-gray-500 dark:bg-[#071929] dark:text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
                  ) : (
                    lesson.lesson_number ?? "—"
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="text-base">{lesson.icon}</span>
                    <p
                      className={`truncate text-sm font-semibold ${
                        isCompleted
                          ? "text-[#8DE3B5] dark:text-[#8DE3B5]"
                          : "text-gray-900 dark:text-[#E8EAEE]"
                      }`}
                    >
                      {lesson.title}
                    </p>
                  </div>
                  <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                    {lesson.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {hasVideo ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-[#8DE3B5] dark:text-[#8DE3B5]">
                        <Play className="h-3 w-3" />
                        Interactive lesson
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                        <Clock className="h-3 w-3" />
                        Lesson coming soon
                      </span>
                    )}
                    {isCompleted ? (
                      <span className="text-xs text-[#8DE3B5] dark:text-[#8DE3B5]">
                        ✓ Completed
                      </span>
                    ) : null}
                    {isNext && !isCompleted ? (
                      <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-medium text-[#8DE3B5] dark:bg-[#102840] dark:text-[#8DE3B5]">
                        Up next
                      </span>
                    ) : null}
                  </div>
                </div>

                <ChevronRight
                  className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${
                    isCompleted ? "text-[#8DE3B5] dark:text-[#8DE3B5]" : "text-gray-300 dark:text-slate-500"
                  }`}
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./daily-workflow-tour.css";
import {
  DAILY_WORKFLOW_CLIENT_KEY,
  DAILY_WORKFLOW_EVENT,
  DAILY_WORKFLOW_INDEX_KEY,
  DAILY_WORKFLOW_RUN_KEY,
  DAILY_WORKFLOW_SEEN_KEY,
  DAILY_WORKFLOW_STEPS,
  clientIdFromPath,
  dailyWorkflowPage,
  hrefForDailyWorkflowStep,
  type DailyWorkflowStep,
} from "@/lib/tours/daily-workflow";

type Included = {
  step: DailyWorkflowStep;
  index: number;
  element?: Element;
  terminal: boolean;
};

function visibleTourTarget(anchor: string): Element | undefined {
  const nodes = document.querySelectorAll(`[data-tour="${anchor}"]`);
  for (const node of Array.from(nodes)) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.getClientRects().length === 0) continue;
    return node;
  }
  return undefined;
}

function rememberClient(pathname: string): string | null {
  const fromPath = clientIdFromPath(pathname);
  if (fromPath) {
    sessionStorage.setItem(DAILY_WORKFLOW_CLIENT_KEY, fromPath);
    return fromPath;
  }
  const fromRow = visibleTourTarget("first-client")?.getAttribute("data-client-id");
  if (fromRow) {
    sessionStorage.setItem(DAILY_WORKFLOW_CLIENT_KEY, fromRow);
    return fromRow;
  }
  return sessionStorage.getItem(DAILY_WORKFLOW_CLIENT_KEY);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Wait until the control is actually on screen. A missing target must not become a card in the middle. */
async function waitForAnchor(anchor: string, isCancelled: () => boolean): Promise<Element | undefined> {
  const deadline = Date.now() + 8000;
  while (!isCancelled() && Date.now() < deadline) {
    const found = visibleTourTarget(anchor);
    if (found) return found;
    await sleep(200);
  }
  return isCancelled() ? undefined : visibleTourTarget(anchor);
}

function stepsForPage(start: number, pathname: string, search: string): Included[] {
  const page = dailyWorkflowPage(pathname, search);
  const included: Included[] = [];
  if (!page) return included;
  for (let index = start; index < DAILY_WORKFLOW_STEPS.length; index++) {
    const step = DAILY_WORKFLOW_STEPS[index];
    if (step.page !== page) break;
    if (!step.anchor) continue;
    const element = visibleTourTarget(step.anchor);
    if (!element) {
      if (step.optional) continue;
      break;
    }
    included.push({ step, index, element, terminal: false });
  }
  return included;
}

export function DailyWorkflowTour() {
  const pathname = usePathname() ?? "";
  const search = useSearchParams().toString();
  const router = useRouter();
  const driverRef = useRef<Driver | null>(null);
  const advancing = useRef(false);
  const starting = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function endRun() {
      sessionStorage.removeItem(DAILY_WORKFLOW_RUN_KEY);
      localStorage.setItem(DAILY_WORKFLOW_SEEN_KEY, "1");
    }

    async function begin() {
      if (cancelled || starting.current || driverRef.current?.isActive()) return;
      if (sessionStorage.getItem(DAILY_WORKFLOW_RUN_KEY) !== "1") return;

      const path = window.location.pathname;
      const query = window.location.search;
      const index = Number(sessionStorage.getItem(DAILY_WORKFLOW_INDEX_KEY) || "0");
      const step = DAILY_WORKFLOW_STEPS[index];
      if (!step) {
        endRun();
        return;
      }

      const page = dailyWorkflowPage(path, query);
      if (page !== step.page) {
        const href = hrefForDailyWorkflowStep(step, rememberClient(path));
        if (!href) {
          endRun();
          return;
        }
        const here = `${path}${query}`;
        if (here !== href) router.push(href);
        return;
      }

      const current = DAILY_WORKFLOW_STEPS[index];
      if (current?.anchor) await waitForAnchor(current.anchor, () => cancelled);
      if (cancelled) return;

      const included = stepsForPage(index, path, query);
      if (included.length === 0 && current?.missing) {
        endRun();
        return;
      }
      if (included.length === 0) {
        const nextIndex = DAILY_WORKFLOW_STEPS.findIndex((item, i) => i >= index && item.page !== page);
        const next = nextIndex === -1 ? undefined : DAILY_WORKFLOW_STEPS[nextIndex];
        if (!next) {
          endRun();
          return;
        }
        const href = hrefForDailyWorkflowStep(next, rememberClient(path));
        if (!href) {
          endRun();
          return;
        }
        sessionStorage.setItem(DAILY_WORKFLOW_INDEX_KEY, String(nextIndex));
        router.push(href);
        return;
      }

      starting.current = true;
      try {
        const { driver } = await import("driver.js");
        if (cancelled) return;

        const last = included[included.length - 1];
        const afterLast = DAILY_WORKFLOW_STEPS[last.index + 1];
        const continues = Boolean(afterLast) && !last.terminal;

        const driveSteps: DriveStep[] = included.map((item) => {
          const missing = item.terminal ? item.step.missing : undefined;
          const isBoundary = item.index === last.index && (continues || item.terminal);
          const popover: DriveStep["popover"] = {
            title: missing?.title ?? item.step.title,
            description: missing?.description ?? item.step.description,
            side: item.element ? item.step.side : undefined,
            align: "start",
            progressText: `${item.index + 1} of ${DAILY_WORKFLOW_STEPS.length}`,
            doneBtnText: continues && item.index === last.index ? "Next" : "Done",
          };
          if (isBoundary) {
            popover.onNextClick = (_element, _step, opts) => {
              if (!continues) {
                opts.driver.destroy();
                return;
              }
              const clientId = rememberClient(window.location.pathname);
              const href = hrefForDailyWorkflowStep(afterLast, clientId);
              if (!href) {
                opts.driver.destroy();
                return;
              }
              advancing.current = true;
              sessionStorage.setItem(DAILY_WORKFLOW_INDEX_KEY, String(last.index + 1));
              opts.driver.destroy();
              router.push(href);
            };
          }
          const anchor = item.step.anchor;
          const driveStep: DriveStep = {
            popover,
            // Re-find the control at highlight time so a page update cannot leave the card floating.
            element: () => visibleTourTarget(anchor ?? "") as Element,
            waitForElement: 4000,
            skipMissingElement: true,
          };
          return driveStep;
        });

        const instance = driver({
          animate: true,
          smoothScroll: true,
          allowClose: true,
          overlayOpacity: 0.55,
          stagePadding: 8,
          stageRadius: 8,
          disableActiveInteraction: true,
          skipMissingElement: true,
          waitForElement: 4000,
          showProgress: true,
          nextBtnText: "Next",
          prevBtnText: "Back",
          doneBtnText: "Done",
          popoverClass: "gp-tour-popover",
          steps: driveSteps,
          // Closing waits until destroy() is called. destroy() itself skips this hook.
          onDestroyStarted: (_element, _step, opts) => {
            opts.driver.destroy();
          },
          onDestroyed: () => {
            driverRef.current = null;
            const moved = advancing.current;
            advancing.current = false;
            if (!moved) endRun();
          },
        });
        driverRef.current = instance;
        localStorage.setItem(DAILY_WORKFLOW_SEEN_KEY, "1");
        instance.drive();
      } finally {
        starting.current = false;
      }
    }

    const active = driverRef.current;
    if (active?.isActive()) {
      const index = Number(sessionStorage.getItem(DAILY_WORKFLOW_INDEX_KEY) || "0");
      const step = DAILY_WORKFLOW_STEPS[index];
      const page = dailyWorkflowPage(pathname, `?${search}`);
      if (step && page && step.page !== page) {
        const nextIndex = DAILY_WORKFLOW_STEPS.findIndex((item, i) => i > index && item.page === page);
        if (nextIndex !== -1) {
          advancing.current = true;
          sessionStorage.setItem(DAILY_WORKFLOW_INDEX_KEY, String(nextIndex));
          rememberClient(pathname);
          active.destroy();
        } else {
          advancing.current = false;
          active.destroy();
        }
      } else if (!step || step.page !== page) {
        advancing.current = false;
        active.destroy();
      }
    }

    const onRequest = () => {
      if (driverRef.current?.isActive()) {
        advancing.current = true;
        driverRef.current.destroy();
      }
      void begin();
    };

    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem(DAILY_WORKFLOW_RUN_KEY) === "1") {
        void begin();
        return;
      }
      if (localStorage.getItem(DAILY_WORKFLOW_SEEN_KEY) === "1") return;
      if (dailyWorkflowPage(window.location.pathname, window.location.search) !== "list") return;
      sessionStorage.setItem(DAILY_WORKFLOW_RUN_KEY, "1");
      sessionStorage.setItem(DAILY_WORKFLOW_INDEX_KEY, "0");
      void begin();
    }, 800);

    window.addEventListener(DAILY_WORKFLOW_EVENT, onRequest);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener(DAILY_WORKFLOW_EVENT, onRequest);
    };
  }, [pathname, router, search]);

  return null;
}

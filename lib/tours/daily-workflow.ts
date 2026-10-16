/**
 * Daily workflow tour. The written version is the Knowledge Base article
 * "The path of a client". This is the same path, pointed at the real screens.
 */

export const DAILY_WORKFLOW_EVENT = "gp-daily-workflow-start";
export const DAILY_WORKFLOW_RUN_KEY = "gp-daily-workflow-run";
export const DAILY_WORKFLOW_INDEX_KEY = "gp-daily-workflow-index";
export const DAILY_WORKFLOW_CLIENT_KEY = "gp-daily-workflow-client";
export const DAILY_WORKFLOW_SEEN_KEY = "gp-daily-workflow-seen";

export type DailyWorkflowPage = "list" | "pipeline" | "file" | "documents";

export type DailyWorkflowStep = {
  page: DailyWorkflowPage;
  /** `[data-tour]` value. Omit for a card in the middle of the screen. */
  anchor?: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
  /** Skip when that part of the screen is not there. */
  optional?: boolean;
  /** Shown instead, and the tour ends, when the anchor is missing. */
  missing?: { title: string; description: string };
};

const CLIENT_PATH =
  /^\/clients\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const DAILY_WORKFLOW_STEPS: readonly DailyWorkflowStep[] = [
  {
    page: "list",
    anchor: "lead-drop",
    side: "bottom",
    title: "Start with a text file",
    description:
      "Drop the text file here. That creates a New Lead. Nobody is assigned yet. The same file is saved under Documents.",
  },
  {
    page: "pipeline",
    anchor: "tab-successful",
    side: "bottom",
    title: "Successful is the win",
    description:
      "This is Pipeline, on Service. Successful is the last tab, after Case Sent to Attorneys. Everyone who made it is here. Do not use Closed for a win. Closed means they stopped.",
  },
  {
    page: "list",
    anchor: "first-client",
    side: "top",
    title: "Open the client",
    description:
      "This row is one client. Next opens it and keeps pointing at the stage, the people, and Documents.",
    missing: {
      title: "No client on this page yet",
      description:
        "Drop a text file first, then open that client. On their page you will see the stage, who they talk to, and Documents.",
    },
  },
  {
    page: "file",
    anchor: "client-stage",
    side: "bottom",
    title: "The stage",
    description:
      "This is the step they are on. After the card charges, move a New Lead to Account Manager and pick who they talk to. The uploads after that move the stage for you.",
  },
  {
    page: "file",
    anchor: "client-people",
    side: "bottom",
    title: "Who they talk to",
    description:
      "Account Manager is the person on the phone. Client Services handles the Welcome Packet. Use Edit if nobody is picked.",
  },
  {
    page: "file",
    anchor: "client-tab-documents",
    side: "bottom",
    title: "Documents",
    description:
      "The credit card form goes on first. Then the Welcome Packet. Later, the collection letter. Next opens this tab.",
  },
  {
    page: "documents",
    anchor: "upload-button",
    side: "left",
    title: "Upload in this order",
    description:
      "This button is the rest of the path. Choose CC Authorization first. The client moves to Client Services, or to Awaiting Collections if the Welcome Packet is already on the file. Then upload the Welcome Packet. When the collection letter arrives, upload that. The client moves to Case Sent to Attorneys. They show on Pipeline, under Service, on Successful.",
  },
];

export function clientIdFromPath(pathname: string): string | null {
  return pathname.match(CLIENT_PATH)?.[1] ?? null;
}

export function dailyWorkflowPage(pathname: string, search: string): DailyWorkflowPage | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const tab = new URLSearchParams(raw).get("tab");
  if (pathname === "/pipeline") return "pipeline";
  if (pathname === "/clients") {
    // Refunds is a different screen. The tour starts on the client list.
    if (tab === "refunds") return null;
    return "list";
  }
  if (!clientIdFromPath(pathname)) return null;
  return tab === "documents" ? "documents" : "file";
}

export function hrefForDailyWorkflowStep(
  step: DailyWorkflowStep,
  clientId: string | null
): string | null {
  if (step.page === "list") return "/clients";
  if (step.page === "pipeline") return "/pipeline?stage=successful";
  if (!clientId) return null;
  if (step.page === "documents") return `/clients/${clientId}?tab=documents`;
  return `/clients/${clientId}`;
}

/** Starts or replays the tour from the first step. Safe to call from any staff page. */
export function requestDailyWorkflowTour() {
  try {
    sessionStorage.setItem(DAILY_WORKFLOW_RUN_KEY, "1");
    sessionStorage.setItem(DAILY_WORKFLOW_INDEX_KEY, "0");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(DAILY_WORKFLOW_EVENT));
}

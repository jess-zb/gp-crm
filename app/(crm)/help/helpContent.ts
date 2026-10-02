import { ACCT_MANAGER_HELP_CATEGORIES } from "@/app/(crm)/help/acct-manager-content";
import { getRoleDisplayName } from "@/lib/utils/roles";

export type HelpCalloutVariant = "tip" | "note" | "warning";

export type HelpContentBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ol"; items: string[] }
  | { type: "ul"; items: string[] }
  | { type: "callout"; variant: HelpCalloutVariant; text: string };

export type HelpArticle = {
  id: string;
  title: string;
  /** Plain text used for search and fallback when `blocks` is absent */
  body: string;
  blocks?: HelpContentBlock[];
};

export function articleSearchText(article: HelpArticle): string {
  const parts: string[] = [article.body];
  if (!article.blocks?.length) return parts.join(" ");
  for (const b of article.blocks) {
    switch (b.type) {
      case "p":
      case "h3":
        parts.push(b.text);
        break;
      case "ol":
      case "ul":
        parts.push(...b.items);
        break;
      case "callout":
        parts.push(b.text);
        break;
      default:
        break;
    }
  }
  return parts.join(" ");
}

export type HelpCategory = {
  id: string;
  title: string;
  articles: HelpArticle[];
};

export type HelpDeskRole =
  | "dev"
  | "admin"
  | "acct_manager"
  | "attorney";

export function roleSubtitle(role: HelpDeskRole): string {
  switch (role) {
    case "dev":
      return "Developer & system guides";
    case "admin":
      return "Administrator guides";
    case "acct_manager":
      return `${getRoleDisplayName("acct_manager")} guides`;
    case "attorney":
      return "Attorney guides";
    default:
      return "Help guides";
  }
}

const DEV_INTEGRATION: HelpCategory = {
  id: "system-integration",
  title: "System integration",
  articles: [
    {
      id: "ringcentral-setup",
      title: "RingCentral webhook (developer)",
      body:
        "RingCentral registration is restricted to developer accounts. In Settings → Workspace, use Connect RingCentral after environment variables are configured for the tenant.",
    },
    {
      id: "supabase-env",
      title: "Environment & migrations",
      body:
        "Developers coordinate database schema updates and file storage with staging before production. Apply migrations when user roles or access control policies change.",
    },
  ],
};

export const HELP_CONTENT: Record<
  Exclude<HelpDeskRole, "dev">,
  HelpCategory[]
> = {
  admin: [
    {
      id: "team-management",
      title: "Team Management",
      articles: [
        {
          id: "add-team-member",
          title: "How to add a new team member",
          body:
            "Go to Team in the sidebar. Click Invite Team Member. Fill in their name, email, and role. Click Send Invite. A temporary password will be shown — share it securely with them. They can change it in Settings after first login.",
        },
        {
          id: "deactivate-member",
          title: "How to deactivate a team member",
          body:
            "Go to Team. Find the member. Click the Active toggle to deactivate. They will lose access immediately. Their assigned clients remain assigned but should be reassigned to another team member.",
        },
        {
          id: "change-role",
          title: "How to change a team member's role",
          body:
            "Go to Team. Click the pencil icon next to the member. Select the new role from the dropdown. Click Save.",
        },
      ],
    },
    {
      id: "fedex-postlogic",
      title: "FedEx & Print Partner",
      articles: [
        {
          id: "send-fedex-batch",
          title: "How to send a FedEx batch",
          body:
            "Go to FedEx Batches in the sidebar. Clients whose CC has been charged and have FedEx as delivery method will appear in Ready to Send. Click Send Batch to Print Partner. Batches auto-send every Sunday and Wednesday at 11PM PST.",
        },
        {
          id: "track-fedex",
          title: "How to track a FedEx shipment",
          body:
            "In FedEx Batches, find the client in Sent — Awaiting Tracking. Enter their Print Partner ID (format: ZB0001) and click Save. Click Poll Status to check for a tracking number. Once tracking appears, click the tracking link to open the carrier’s site.",
        },
        {
          id: "resend-welcome",
          title: "How to resend a welcome packet",
          body:
            "Go to the client profile. In the checklist, click Send Welcome Packet + POA. Click Resend Packet and choose FedEx.",
        },
      ],
    },
    {
      id: "settings-integrations",
      title: "Settings & Integrations",
      articles: [
        {
          id: "ringcentral",
          title: "How to connect RingCentral",
          body:
            "Go to Settings. Scroll to RingCentral Integration. Click Connect RingCentral. A green Connected status confirms success. Calls and texts to/from client phone numbers will now auto-log in their Activity tab.",
        },
        {
          id: "message-templates",
          title: "How to manage message templates",
          body:
            "Go to Settings. Click Message Templates. Add Email or Text templates with merge tags like {{client_name}} and {{tracking_number}}. Templates appear in the Activity tab when adding emails or texts.",
        },
        {
          id: "export-reports",
          title: "How to export reports",
          body:
            "CSV exports from the CRM are turned off. Staff can still view the same data on screen. Ask a developer when an export needs to be turned back on.",
        },
        {
          id: "bypass-checklist",
          title: "How to bypass a checklist item",
          body:
            "On a client profile, find the checklist item. Click Bypass. Enter a reason for bypassing. Only developers and administrators can bypass items.",
        },
      ],
    },
    {
      id: "client-portal",
      title: "Client Portal",
      articles: [
        {
          id: "portal-invite",
          title: "How to send a portal invite",
          body:
            "On the client profile, go to Account tab. Toggle Portal Access to ON. Click Send Portal Invite. Share the invite link with the client. They will set their own password and can log in through your organization's portal link.",
        },
      ],
    },
  ],
  acct_manager: ACCT_MANAGER_HELP_CATEGORIES as HelpCategory[],
  attorney: [
    {
      id: "viewing-cases",
      title: "Viewing Cases",
      articles: [
        {
          id: "find-cases",
          title: "How to find your assigned cases",
          body:
            "After you sign in, you are taken directly to your cases list. Only cases that have been sent to attorneys are shown here.",
        },
        {
          id: "case-documents",
          title: "How to view case documents",
          body:
            "Click View on any case. Scroll to the Documents section. Click Download next to any file to download it securely.",
        },
        {
          id: "collection-letters",
          title: "How to view collection letters",
          body:
            "Open the case and scroll to Documents. Collection letters are listed there with type Collection letter — there is no separate Letters tab.",
        },
        {
          id: "timeline",
          title: "How to read the case timeline",
          body:
            "In the right sidebar of the case detail, the Case Timeline shows every stage change and key action with dates.",
        },
      ],
    },
    {
      id: "attorney-comms",
      title: "Communications",
      articles: [
        {
          id: "msg-client",
          title: "How to message a client",
          body:
            "Go to Communications in the sidebar. Click Client Messages tab. Find the client. Type your message and click Send. The client sees your message in their portal.",
        },
        {
          id: "msg-team",
          title: "How to message the team",
          body:
            "Go to Communications. Click Team Chat. Select a team member to start a direct conversation.",
        },
      ],
    },
  ],
};

export function getHelpCategories(role: HelpDeskRole): HelpCategory[] {
  if (role === "dev") {
    return [...HELP_CONTENT.admin, DEV_INTEGRATION];
  }
  return HELP_CONTENT[role];
}

/** Resolve category + article for guided tours (same catalog as Help Center for that role). */
export function findHelpArticle(
  role: HelpDeskRole,
  articleId: string
): { category: HelpCategory; article: HelpArticle } | null {
  const cats = getHelpCategories(role);
  for (const category of cats) {
    const article = category.articles.find((a) => a.id === articleId);
    if (article) return { category, article };
  }
  return null;
}

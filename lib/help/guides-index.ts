export interface GuideItem {
  slug: string;
  icon: string;
  title: string;
  description: string;
  steps: number;
  category: string;
  roles: string[];
  lesson_number?: number;
  admin_only?: boolean;
}

export const COURSE_LESSONS: GuideItem[] = [
  {
    slug: "getting-started",
    icon: "🚀",
    title: "Getting Started — Add Your First Client",
    description: "Add a new client, set up notes and schedule appointments",
    steps: 0,
    category: "Course",
    roles: ["dev", "admin", "acct_manager"],
    lesson_number: 1,
  },
  {
    slug: "welcome-packet-fedex",
    icon: "📦",
    title: "Welcome Packet & Tracking Number",
    description: "Send welcome packets and track delivery status",
    steps: 0,
    category: "Course",
    roles: ["dev", "admin", "acct_manager"],
    lesson_number: 2,
  },
  {
    slug: "working-the-checklist",
    icon: "✅",
    title: "Working the Checklist",
    description: "Send packet, upload POA and collection letter",
    steps: 0,
    category: "Course",
    roles: ["dev", "admin", "acct_manager"],
    lesson_number: 3,
  },
  {
    slug: "logging-communications",
    icon: "📞",
    title: "Logging Communications",
    description: "Log calls, texts, emails and notes for every interaction",
    steps: 0,
    category: "Course",
    roles: ["dev", "admin", "acct_manager"],
    lesson_number: 4,
  },
  {
    slug: "managing-team-pipeline",
    icon: "👥",
    title: "Managing Your Team & Pipeline",
    description: "Pipeline overview, team management, announcements and reports",
    steps: 0,
    category: "Course",
    roles: ["dev", "admin"],
    lesson_number: 5,
    admin_only: true,
  },
];

/** Attorney workspace Teach Me (separate from CRM operator course). */
export const ATTORNEY_TEACH_ME_ITEMS: GuideItem[] = [
  {
    slug: "attorney-view-cases",
    icon: "⚖️",
    title: "Viewing your assigned cases",
    description: "Find and review cases sent to you by the team",
    steps: 3,
    category: "Attorney",
    roles: ["attorney", "dev", "admin"],
    lesson_number: 1,
  },
  {
    slug: "attorney-download-documents",
    icon: "📥",
    title: "Downloading case documents",
    description: "Access collection letters and case files",
    steps: 3,
    category: "Attorney",
    roles: ["attorney", "dev", "admin"],
    lesson_number: 2,
  },
  {
    slug: "attorney-close-case",
    icon: "✅",
    title: "Closing a case",
    description: "Mark a case as complete when work is done",
    steps: 3,
    category: "Attorney",
    roles: ["attorney", "dev", "admin"],
    lesson_number: 3,
  },
  {
    slug: "team-chat",
    icon: "👥",
    title: "Using Team Chat",
    description: "Send direct messages to teammates",
    steps: 3,
    category: "Attorney",
    roles: ["attorney", "dev", "admin", "acct_manager"],
    lesson_number: 4,
  },
];

export const ALL_GUIDES = COURSE_LESSONS;

export function guidesForViewer(role: string): GuideItem[] {
  return COURSE_LESSONS.filter((g) => g.roles.includes(role) || role === "dev");
}

export function guidesForAttorneyPortal(role: string): GuideItem[] {
  if (role === "dev" || role === "admin") {
    return [...ATTORNEY_TEACH_ME_ITEMS];
  }
  return ATTORNEY_TEACH_ME_ITEMS.filter((g) => g.roles.includes("attorney"));
}

export function guideMetaBySlug(slug: string): GuideItem | undefined {
  return (
    COURSE_LESSONS.find((g) => g.slug === slug) ??
    ATTORNEY_TEACH_ME_ITEMS.find((g) => g.slug === slug)
  );
}

export function canViewerAccessGuide(slug: string, role: string): boolean {
  const meta = guideMetaBySlug(slug);
  if (!meta) return false;
  if (role === "dev") return true;
  if (!meta.roles.includes(role)) return false;
  if (meta.admin_only && role !== "admin" && role !== "dev") return false;
  return true;
}

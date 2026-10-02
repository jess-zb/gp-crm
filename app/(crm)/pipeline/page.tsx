import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import {
  PIPELINE_PAGE_STAGES,
  type PipelinePageStage,
} from "@/lib/crm/pipeline-stage-counts";
import { countActiveClientsByStages } from "@/lib/crm/client-stage-count-queries";
import { PipelinePageClient, type PipelinePageRow } from "./PipelinePageClient";
import { toUserFacingError } from "@/lib/user-facing-error";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";

const PIPELINE_COUNT_STAGES = [
  "lead",
  "welcome_packet",
  "retention",
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
  "dnc",
  "not_interested",
  "dnq",
  "mortgage",
  "closed",
] as const;

const PIPELINE_SELECT =
  "id, first_name, last_name, phone_mobile, email, stage, created_at, stage_entered_at, is_active, dnc_reason, assigned_to, assigned_services_id, assigned_user:profiles!assigned_to(full_name), services_manager:profiles!assigned_services_id(full_name)";

function parseActiveStage(raw: string | undefined): PipelinePageStage {
  const s = (raw ?? "").trim();
  if (PIPELINE_PAGE_STAGES.includes(s as PipelinePageStage)) {
    return s as PipelinePageStage;
  }
  return "lead";
}

type SearchParams = { stage?: string };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error: profileError } = await getProfileForUser(supabase, user);
  if (profileError || !profile) redirect("/login");
  if (profile.role === "client") redirect("/portal");
  if (profile.role === "attorney") redirect("/attorney/cases");

  const admin = createServiceClient();
  const deptProfile = await getCurrentProfile(supabase);
  const elevated =
    deptProfile?.role === "dev" ||
    deptProfile?.role === "admin" ||
    profile.role === "dev" ||
    profile.role === "admin";

  const activeStage = parseActiveStage(searchParams.stage);

  const PIPELINE_PAGE_SIZE = 1000;

  // Start counts in parallel while paginating clients
  const stageCountsPromise = countActiveClientsByStages(admin, PIPELINE_COUNT_STAGES);

  let allRows: Record<string, unknown>[] = [];
  let fetchError: { message: string } | null = null;
  let pageFrom = 0;

  while (true) {
    let q = admin
      .from("clients")
      .select(PIPELINE_SELECT)
      .eq("stage", activeStage)
      .eq("is_active", true);

    if (!elevated && deptProfile?.is_accounts) {
      q = q.or(`assigned_to.eq.${user.id},assigned_to.is.null`);
    } else if (!elevated && deptProfile?.is_services && !deptProfile.is_accounts) {
      q = q.or(`assigned_services_id.eq.${user.id},assigned_services_id.is.null`);
    }

    const { data, error: pageErr } = await q
      .order("created_at", { ascending: false })
      .range(pageFrom, pageFrom + PIPELINE_PAGE_SIZE - 1);

    if (pageErr) { fetchError = pageErr; break; }
    if (!data?.length) break;
    allRows = [...allRows, ...data];
    if (data.length < PIPELINE_PAGE_SIZE) break;
    pageFrom += PIPELINE_PAGE_SIZE;
  }

  const stageCounts = await stageCountsPromise;
  const rows = fetchError ? null : allRows;
  const error = fetchError;

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <CrmPageHeader title="Pipeline" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">
          <p className="text-sm text-red-600">{toUserFacingError(error.message)}</p>
          <p className="mt-2 text-xs text-slate-600">
            If the problem continues, contact your administrator.
          </p>
        </main>
      </div>
    );
  }

  const clients: PipelinePageRow[] = (rows ?? []).map((r) => {
    const auRaw = r.assigned_user as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null
      | undefined;
    const au: { full_name: string | null } | null = Array.isArray(auRaw)
      ? auRaw[0]
        ? { full_name: auRaw[0].full_name ?? null }
        : null
      : auRaw ?? null;

    const smRaw = r.services_manager as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null
      | undefined;
    const sm: { full_name: string | null } | null = Array.isArray(smRaw)
      ? smRaw[0]
        ? { full_name: smRaw[0].full_name ?? null }
        : null
      : smRaw ?? null;

    return {
      id: r.id as string,
      first_name: r.first_name as string | null,
      last_name: r.last_name as string | null,
      phone_mobile: (r.phone_mobile as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      stage: r.stage as string,
      created_at: (r.created_at as string | null) ?? null,
      stage_entered_at: (r.stage_entered_at as string | null) ?? null,
      assigned_user: au,
      services_manager: sm,
    };
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Pipeline" />
      <main className="mx-auto w-full min-w-0 max-w-[1920px] flex-1 px-4 py-5 sm:px-6">
        <PipelinePageClient
          rows={clients}
          stageCounts={stageCounts}
          activeStage={activeStage}
        />
      </main>
    </div>
  );
}

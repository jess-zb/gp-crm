import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canManageMids } from "@/lib/roles";
import { loadAllMids } from "@/lib/mids/queries";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { MidsClient, type MidListRow } from "./MidsClient";

export const metadata = { title: "MIDs" };

export default async function MidsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");
  if (!canManageMids(profile.role)) redirect("/settings");

  const mids = await loadAllMids(supabase);

  const [{ data: clientRows }, { data: templateRows }] = await Promise.all([
    supabase.from("clients").select("mid_id").not("mid_id", "is", null),
    supabase.from("esign_templates").select("mid_id"),
  ]);

  const clientCounts = new Map<string, number>();
  for (const row of clientRows ?? []) {
    const id = row.mid_id as string;
    clientCounts.set(id, (clientCounts.get(id) ?? 0) + 1);
  }
  const templateCounts = new Map<string, number>();
  for (const row of templateRows ?? []) {
    const id = row.mid_id as string;
    templateCounts.set(id, (templateCounts.get(id) ?? 0) + 1);
  }

  const rows: MidListRow[] = mids.map((mid) => ({
    ...mid,
    clientCount: clientCounts.get(mid.id) ?? 0,
    templateCount: templateCounts.get(mid.id) ?? 0,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="MIDs" />
      <main className="mx-auto min-w-0 w-full max-w-3xl flex-1 px-6 py-5">
        <nav
          className="text-[13px] text-slate-600 dark:text-slate-400"
          aria-label="Breadcrumb"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                href="/settings"
                className="font-medium text-[#A87830] hover:underline"
              >
                Settings
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li className="font-medium text-slate-900 dark:text-slate-200">
              MIDs
            </li>
          </ol>
        </nav>

        <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-400">
          A MID is the merchant a client is enrolled under. It is chosen when the
          client is created and follows them through to attorney hand-off. Each
          MID owns its own set of e-sign documents.
        </p>

        <div className="mt-6">
          <MidsClient mids={rows} />
        </div>
      </main>
    </div>
  );
}

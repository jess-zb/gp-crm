import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { loadAllMids } from "@/lib/mids/queries";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { MidsClient, type MidListRow } from "../settings/mids/MidsClient";

export const metadata = { title: "E-Sign Documents" };

export default async function EsignDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");
  // Dev and admin. Account managers can send; they do not manage templates.
  if (profile.role !== "dev" && profile.role !== "admin") redirect("/dashboard");

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
      <CrmPageHeader title="E-Sign Documents" />
      <main className="mx-auto min-w-0 w-full max-w-3xl flex-1 px-6 py-5">
        <p className="text-[13px] text-slate-600 dark:text-slate-400">
          Each MID owns its own documents. Add a MID, upload a PDF, then place the
          fields. Replacing a placeholder with a real PDF later does not require a
          code change.
        </p>
        <p className="mt-2 text-[13px]">
          <Link href="/settings" className="font-medium text-[#A87830] hover:underline">
            Settings
          </Link>
        </p>
        <div className="mt-6">
          <MidsClient mids={rows} />
        </div>
      </main>
    </div>
  );
}

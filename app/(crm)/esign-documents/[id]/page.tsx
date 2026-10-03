import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { loadMidById } from "@/lib/mids/queries";
import { ESIGN_TEMPLATE_SELECT, type EsignTemplateRow } from "@/lib/esign/types";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { MidDocumentsClient } from "../../settings/mids/[id]/MidDocumentsClient";

export const metadata = { title: "E-Sign documents" };

export default async function EsignMidDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await Promise.resolve(params);
  const midId = resolved.id?.trim() ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");
  if (profile.role !== "dev" && profile.role !== "admin") redirect("/dashboard");

  const mid = await loadMidById(supabase, midId);
  if (!mid) notFound();

  const { data } = await supabase
    .from("esign_templates")
    .select(ESIGN_TEMPLATE_SELECT)
    .eq("mid_id", mid.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const templates = (data ?? []) as EsignTemplateRow[];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title={mid.name} />
      <main className="mx-auto min-w-0 w-full max-w-3xl flex-1 px-6 py-5">
        <nav className="text-[13px] text-slate-600 dark:text-slate-400" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/esign-documents" className="font-medium text-[#A87830] hover:underline">
                E-Sign Documents
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li className="font-medium text-slate-900 dark:text-slate-200">{mid.name}</li>
          </ol>
        </nav>

        <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-400">
          Documents listed here are the only ones a {mid.name} client can be sent.
          Upload a PDF, then place the fields on it.
        </p>

        <div className="mt-6">
          <MidDocumentsClient midId={mid.id} midName={mid.name} templates={templates} />
        </div>
      </main>
    </div>
  );
}

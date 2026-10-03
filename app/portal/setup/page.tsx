import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { isHexPortalInviteToken } from "@/lib/portal-invite-token";
import PortalSetupClient from "./PortalSetupClient";

export default async function PortalSetupPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token?.trim() ?? "";
  if (!token || !isHexPortalInviteToken(token)) {
    redirect("/portal/invalid-token");
  }

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email")
    .eq("portal_invite_token", token)
    .maybeSingle();

  if (error || !row) {
    redirect("/portal/invalid-token");
  }

  const client = row as {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  };

  const emailNorm = client.email?.trim().toLowerCase();
  if (emailNorm) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", emailNorm)
      .eq("role", "client")
      .maybeSingle();

    if (existingProfile?.id) {
      return (
        <main className="min-h-screen bg-[#F5F6F8] px-4 py-10 dark:bg-[#121212]">
          <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Your account is already set up.
            </p>
            <Link
              href="/portal/login"
              className="mt-4 inline-block text-sm font-semibold text-[#A87830] underline"
            >
              Sign in to the portal
            </Link>
          </div>
        </main>
      );
    }
  }

  if (!client.email?.trim()) {
    return (
      <InvalidInvite message="We don&apos;t have an email on file for your account. Please contact your case manager." />
    );
  }

  return (
    <PortalSetupClient
      token={token}
      firstName={client.first_name?.trim() || "there"}
    />
  );
}

function InvalidInvite({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#F5F6F8] px-4 py-10 dark:bg-[#121212]">
      <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <p>{message}</p>
        <Link
          href="/portal/login"
          className="mt-4 inline-block font-medium text-[#A87830] underline"
        >
          Portal sign in
        </Link>
      </div>
    </main>
  );
}

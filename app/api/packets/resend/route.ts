import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canUsePostLogicApi } from "@/lib/roles";
import { queuePendingPrimaryFedex } from "@/lib/packets/queue-pending-fedex";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canUsePostLogicApi(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { clientId?: string };
  const { clientId } = body;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const queued = await queuePendingPrimaryFedex(createAdminClient(), clientId);
  if (queued === "failed") {
    return NextResponse.json({ error: "Could not queue packet" }, { status: 500 });
  }

  return NextResponse.json({ success: true, queued });
}

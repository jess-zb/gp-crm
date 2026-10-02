import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canUsePostLogicApi } from "@/lib/roles";
import { toUserFacingError } from "@/lib/user-facing-error";
import { canonicalizeMerchantName } from "@/lib/constants/merchants";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { profile } = await getProfileForUser(supabase, user);
    if (!profile || !canUsePostLogicApi(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as { clientId?: unknown; merchant?: unknown };
    const clientId =
      typeof body.clientId === "string" ? body.clientId.trim() : "";
    const merchant = canonicalizeMerchantName(
      typeof body.merchant === "string" ? body.merchant : ""
    );
    if (!clientId || !merchant) {
      return NextResponse.json(
        { error: "clientId and merchant are required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { error: updateErr } = await admin
      .from("clients")
      .update({ fedex_merchant: merchant })
      .eq("id", clientId);

    if (updateErr) {
      return NextResponse.json(
        { error: toUserFacingError(updateErr.message) },
        { status: 500 }
      );
    }

    // Merchant is persisted only. PDF generator is written at batch send time
    // in Packets Needed Date Created order alongside PostLogic.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/packets/set-merchant]", err);
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canEditPacketMid } from "@/lib/roles";
import { toUserFacingError } from "@/lib/user-facing-error";
import { canonicalizeMerchantName } from "@/lib/constants/merchants";

async function requireMidEditAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canEditPacketMid(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, profile };
}

export async function POST(req: Request) {
  try {
    const auth = await requireMidEditAccess();
    if ("error" in auth && auth.error) return auth.error;

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

    const { data: existing } = await admin
      .from("client_cards")
      .select("id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error: cardErr } = await admin
        .from("client_cards")
        .update({ merchant_name: merchant })
        .eq("id", existing.id);
      if (cardErr) {
        return NextResponse.json(
          { error: toUserFacingError(cardErr.message) },
          { status: 500 }
        );
      }
    } else {
      const { error: insertErr } = await admin.from("client_cards").insert({
        client_id: clientId,
        creditor_name: merchant,
        card_type: "other",
        last_four: "0000",
        merchant_name: merchant,
        added_by: auth.user!.id,
      });
      if (insertErr) {
        return NextResponse.json(
          { error: toUserFacingError(insertErr.message) },
          { status: 500 }
        );
      }
    }

    const { error: clientErr } = await admin
      .from("clients")
      .update({ fedex_merchant: merchant })
      .eq("id", clientId);
    if (clientErr) {
      return NextResponse.json(
        { error: toUserFacingError(clientErr.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/packets/save-mid]", err);
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

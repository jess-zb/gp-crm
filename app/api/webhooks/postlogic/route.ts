import { NextResponse } from "next/server";

/**
 * PostLogic → CRM webhook (tracking numbers, Print IDs, delivery status).
 *
 * Set POSTLOGIC_WEBHOOK_SECRET in env when PostLogic provides signing docs.
 * Implement signature verification and shipment/client updates per their payload spec.
 */
export async function POST(request: Request) {
  const secret = process.env.POSTLOGIC_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "PostLogic webhook not configured. Set POSTLOGIC_WEBHOOK_SECRET when docs are available.",
      },
      { status: 501 }
    );
  }

  // TODO(PostLogic): verify request signature using `secret`, then upsert
  // client_fedex_shipments.tracking_number / status and clients.postlogic_unique_id.
  void request;
  void secret;

  return NextResponse.json(
    { ok: false, message: "PostLogic webhook handler not implemented yet" },
    { status: 501 }
  );
}

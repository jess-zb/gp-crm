import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * DocuSign webhook — envelope status updates.
 * Secured via HMAC-SHA256 signature verification.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
    const signature = request.headers.get("x-docusign-signature-1");

    if (!secret || !signature) {
      console.error("[docusign webhook] Unauthorized: Missing secret or signature");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bodyText = await request.text();
    const hmac = createHmac("sha256", secret);
    const computedSignature = hmac.update(bodyText).digest("base64");

    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);

    if (
      signatureBuffer.length !== computedBuffer.length ||
      !timingSafeEqual(signatureBuffer, computedBuffer)
    ) {
      console.error("[docusign webhook] Unauthorized: Signature mismatch");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = JSON.parse(bodyText);
    const envelopeId = body.envelopeId || body.data?.envelopeId;
    const status = body.status || body.data?.status;

    if (!envelopeId) {
      return NextResponse.json({ received: true });
    }

    console.log("[docusign webhook] envelope:", envelopeId, "status:", status);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("DocuSign webhook error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

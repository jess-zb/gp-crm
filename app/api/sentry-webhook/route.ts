import { tasks } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.SENTRY_WEBHOOK_SECRET;
    const signature = req.headers.get("sentry-hook-signature");

    if (!secret) {
      console.error("SENTRY_WEBHOOK_SECRET is not configured");
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bodyText = await req.text();
    const hmac = createHmac("sha256", secret);
    const computedSignature = hmac.update(bodyText).digest("hex");

    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);

    if (
      signatureBuffer.length !== computedBuffer.length ||
      !timingSafeEqual(signatureBuffer, computedBuffer)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = JSON.parse(bodyText);

    // Sentry sends different payload shapes - handle both
    const issue = body.data?.issue || body.issue;

    if (!issue) {
      return NextResponse.json({ ok: true });
    }

    console.log("Triggering diagnosis for issue:", issue.id, issue.title);

    await tasks.trigger("diagnose-bug", {
      issueId: issue.id ?? "unknown",
      title: issue.title ?? "Unknown error",
      errorMessage: issue.culprit ?? issue.metadata?.value ?? issue.title ?? "No message",
      stackTrace: issue.metadata?.value ?? "No stack trace available",
      url: issue.permalink ?? "",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sentry webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 so Sentry doesn't retry forever
  }
}
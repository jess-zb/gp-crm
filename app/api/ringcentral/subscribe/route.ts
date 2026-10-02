import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";

export async function POST() {
  try {
    // Step 1 - check auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { profile } = await getProfileForUser(supabase, user);
    if (!profile || profile.role !== "dev") {
      return NextResponse.json(
        { error: "Forbidden — developer role required" },
        { status: 403 }
      );
    }

    // Step 2 - check env vars
    const clientId = process.env.RINGCENTRAL_CLIENT_ID;
    const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET;
    const jwtToken = process.env.RINGCENTRAL_JWT_TOKEN?.trim();
    const webhookSecret = process.env.RINGCENTRAL_WEBHOOK_SECRET;

    if (!clientId || !clientSecret || !jwtToken || !webhookSecret) {
      console.error("[RingCentral Subscribe] Missing environment variables:", {
        has_client_id: !!clientId,
        has_client_secret: !!clientSecret,
        has_jwt_token: !!jwtToken,
        has_webhook_secret: !!webhookSecret,
      });
      return NextResponse.json(
        { error: "Configuration error" },
        { status: 500 }
      );
    }

    // Step 3 - JWT bearer token (RingCentral app credentials)
    let tokenRes: Response;
    try {
      tokenRes = await fetch(
        "https://platform.ringcentral.com/restapi/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(
                `${process.env.RINGCENTRAL_CLIENT_ID}:${process.env.RINGCENTRAL_CLIENT_SECRET}`
              ).toString("base64"),
          },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: process.env.RINGCENTRAL_JWT_TOKEN || "",
          }),
        }
      );
    } catch (err) {
      console.error("[RingCentral Subscribe] Token fetch error:", err);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("RC token error:", errText);
      return NextResponse.json(
        {
          error: "RingCentral token failed",
        },
        { status: 500 }
      );
    }

    let access_token: string | undefined;
    try {
      const body = (await tokenRes.json()) as { access_token?: string };
      access_token = body.access_token;
    } catch (err) {
      console.error("RC JSON parse error:", err instanceof Error ? err.message : String(err));
      return NextResponse.json(
        {
          error: "RingCentral token response was invalid",
        },
        { status: 500 }
      );
    }

    console.log("RC token obtained successfully");

    return NextResponse.json({
      success: true,
      has_token: !!access_token,
    });
  } catch (err) {
    console.error("[RingCentral Subscribe Error]:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      {
        error: "Something went wrong",
      },
      { status: 500 }
    );
  }
}

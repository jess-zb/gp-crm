import { NextResponse } from "next/server";
import { consumeLeadIntakeSlot } from "@/lib/leads/intake-rate";
import { savePartnerExport } from "@/lib/leads/save-partner-export";
import { verifyLeadsApiKey } from "@/lib/leads/verify-leads-api-key";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000;

function json(body: unknown, status: number, extra?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

async function guardedSave(
  args: { text: string; fileName?: string | null; source?: string | null }
) {
  const admin = createAdminClient();
  const rate = await consumeLeadIntakeSlot(admin);
  if (rate === "limited") {
    return json({ ok: false, error: "Too many requests." }, 429, { "Retry-After": "60" });
  }
  if (rate === "unavailable") {
    return json({ ok: false, error: "Could not save the lead." }, 503);
  }
  const result = await savePartnerExport(admin, args);
  return json(result.body, result.status);
}

function fileNameFrom(request: Request, fallback?: string | null): string | null {
  const header = request.headers.get("x-file-name")?.trim();
  return header || fallback || null;
}

/**
 * Partner lead intake. The body must be the text file.
 * Auth is LEADS_API_KEY, not a user session.
 */
export async function POST(request: Request) {
  const auth = verifyLeadsApiKey(request);
  if (auth === "missing") {
    return json({ ok: false, error: "Lead API is not configured." }, 500);
  }
  if (auth === "unauthorized") {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: "Request body must be a text file." }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ ok: false, error: "Attach the export as a file field named file." }, 400);
    }
    if (file.size > MAX_BODY_BYTES) {
      return json({ ok: false, error: "Request body is too large." }, 413);
    }
    const text = await file.text();
    const source = form.get("source");
    return guardedSave({
      text,
      fileName: file.name,
      source: typeof source === "string" ? source : null,
    });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Request body is too large." }, 413);
  }

  if (contentType.includes("text/plain")) {
    return guardedSave({
      text: raw,
      fileName: fileNameFrom(request),
    });
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return json({ ok: false, error: "Request body must be a text file." }, 400);
  }

  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as { text?: unknown }).text === "string"
  ) {
    const record = body as { text: string; file_name?: unknown; fileName?: unknown; source?: unknown };
    const fileName =
      typeof record.file_name === "string"
        ? record.file_name
        : typeof record.fileName === "string"
          ? record.fileName
          : null;
    return guardedSave({
      text: record.text,
      fileName,
      source: typeof record.source === "string" ? record.source : null,
    });
  }

  return json({ ok: false, error: "Request body must be a text file." }, 400);
}

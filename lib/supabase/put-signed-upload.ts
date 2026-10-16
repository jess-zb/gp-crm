import { createClient } from "@/lib/supabase/client";

/**
 * PUT file bytes to a signed upload URL.
 *
 * `uploadToSignedUrl()` wraps a File in FormData. Safari 18 sends the CORS
 * preflight for that request, then aborts the multipart PUT with
 * `TypeError: Load failed`, so the file never reaches Storage. A raw file
 * body is the request Chrome completes, and Storage accepts it.
 */
export async function putFileToSignedUploadUrl(
  signedUrl: string,
  file: File,
  contentType: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Upload is not configured.");

  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${session?.access_token || anonKey}`,
    "Content-Type": contentType,
    "cache-control": "max-age=3600",
    "x-upsert": "false",
  };

  let res: Response;
  try {
    res = await fetch(signedUrl, { method: "PUT", body: file, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload to storage failed";
    throw new Error(
      message === "Load failed" || message === "Failed to fetch"
        ? "The browser blocked the upload before the file was sent. Try again."
        : message
    );
  }

  if (res.ok) return;

  let message = res.statusText || "Upload to storage failed";
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    if (typeof body.message === "string" && body.message) message = body.message;
    else if (typeof body.error === "string" && body.error) message = body.error;
  } catch {
    // Storage sometimes returns a non-JSON error page.
  }
  if (message.includes("already exists")) {
    throw new Error(
      "A file with this name already exists. Rename the file and try again."
    );
  }
  throw new Error(message);
}

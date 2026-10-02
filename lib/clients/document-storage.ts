import type { SupabaseClient } from "@supabase/supabase-js";

export const CLIENT_DOCUMENTS_BUCKET = "client-documents";

export async function createClientDocumentSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not get document URL.");
  }

  return data.signedUrl;
}

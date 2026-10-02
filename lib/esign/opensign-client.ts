import { opensignApiBase, opensignApiToken, templateIdForKind } from "./config";
import { signerDisplayName, type EsignClientPrefill } from "./map-client-prefill";
import {
  buildCreatePayloadFromTemplate,
  fetchOpensignTemplate,
} from "./opensign-template";
import { esignKindTitle, type EsignKind } from "./types";

type CreateDocumentResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

function extractDocumentId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  for (const key of ["objectId", "id", "documentId"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (row.result && typeof row.result === "object") {
    return extractDocumentId(row.result);
  }
  return null;
}

export async function createOpensignDocumentFromTemplate(args: {
  kind: EsignKind;
  client: EsignClientPrefill;
}): Promise<CreateDocumentResult> {
  const token = opensignApiToken();
  if (!token) return { ok: false, error: "OpenSign is not configured (missing API token)." };

  const templateId = templateIdForKind(args.kind);
  if (!templateId) {
    return {
      ok: false,
      error: `${esignKindTitle(args.kind)} template is not configured.`,
    };
  }

  let template;
  try {
    template = await fetchOpensignTemplate(templateId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load template.";
    return { ok: false, error: message };
  }
  if (!template) {
    return { ok: false, error: "OpenSign template was not found. Check the template ID." };
  }

  const name = signerDisplayName(args.client);
  const title = `${esignKindTitle(args.kind)} — ${name}`;
  const body = buildCreatePayloadFromTemplate({
    title,
    template,
    client: args.client,
    signerName: name,
  });

  const url = `${opensignApiBase()}/createdocument/${encodeURIComponent(templateId)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": token,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: `Could not reach OpenSign (${message}).` };
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const fromApi =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : text.slice(0, 180);
    console.error("[opensign] create document failed", res.status, fromApi);
    return { ok: false, error: fromApi || `OpenSign returned ${res.status}.` };
  }

  const documentId = extractDocumentId(parsed);
  if (!documentId) {
    console.error("[opensign] create document missing id", text.slice(0, 300));
    return { ok: false, error: "OpenSign did not return a document id." };
  }
  return { ok: true, documentId };
}

export async function downloadOpensignFile(
  fileUrl: string
): Promise<{ ok: true; bytes: Buffer; contentType: string } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(fileUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: message };
  }
  if (!res.ok) {
    return { ok: false, error: `Download failed (${res.status})` };
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "application/pdf";
  return { ok: true, bytes, contentType };
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { EsignKind } from "./types";

export function esignTemplateFileName(kind: EsignKind): string {
  switch (kind) {
    case "welcome_packet":
      return "welcome-packet.pdf";
    case "ac_welcome_packet":
      return "ac-welcome-packet.pdf";
    case "ac_cc_authorization":
      return "ac-cc-auth.pdf";
    case "cc_authorization":
      return "cc-auth.pdf";
  }
}

/** Local/dev path. Live also serves the same files from /esign-templates/. */
export function esignTemplatePath(kind: EsignKind): string {
  return join(process.cwd(), "lib/esign/templates", esignTemplateFileName(kind));
}

function publicTemplatePath(kind: EsignKind): string {
  return join(process.cwd(), "public/esign-templates", esignTemplateFileName(kind));
}

function deployedTemplateUrl(kind: EsignKind): string | null {
  const file = esignTemplateFileName(kind);
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (app) return `${app}/esign-templates/${file}`;
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}/esign-templates/${file}`;
  return null;
}

/** Uploaded replacement first, then the PDFs shipped with the app. */
export async function readEsignTemplateFile(kind: EsignKind): Promise<Buffer> {
  try {
    const { readStoredEsignTemplate } = await import("./template-storage");
    const stored = await readStoredEsignTemplate(kind);
    if (stored) return stored;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.includes("server-only") && !message.includes("Cannot find module")) {
      console.error("[esign template] storage", message);
    }
  }
  for (const path of [esignTemplatePath(kind), publicTemplatePath(kind)]) {
    try {
      return await readFile(path);
    } catch {
      /* try the next location */
    }
  }
  const url = deployedTemplateUrl(kind);
  if (url) {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    console.error("[esign template] fetch failed", url, res.status);
  }
  throw new Error(`E-Sign template not found: ${esignTemplateFileName(kind)}`);
}

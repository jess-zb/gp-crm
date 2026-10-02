import { opensignApiBase, opensignApiToken } from "./config";
import {
  shouldPrefillWidgetType,
  valueForWidgetName,
  type EsignClientPrefill,
} from "./map-client-prefill";

export type OpensignTemplateSummary = {
  objectId: string;
  title: string;
  signerRole: string;
  widgetNames: string[];
};

type RawWidget = {
  type?: string;
  name?: string;
  options?: { name?: string };
};

function widgetName(widget: RawWidget): string {
  return String(widget.options?.name ?? widget.name ?? "").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function templateFromPayload(payload: unknown): {
  objectId: string;
  title: string;
  signerRole: string;
  signerWidgets: RawWidget[];
  prefillWidgets: RawWidget[];
} | null {
  const root = asRecord(payload);
  const row = asRecord(root?.result) ?? root;
  if (!row) return null;
  const objectId = String(row.objectId ?? row.id ?? "").trim();
  if (!objectId) return null;
  const signers = Array.isArray(row.signers) ? row.signers : [];
  const first = asRecord(signers[0]);
  const prefill = asRecord(row.prefill);
  const prefillWidgets = Array.isArray(prefill?.widgets) ? (prefill.widgets as RawWidget[]) : [];
  return {
    objectId,
    title: String(row.title ?? ""),
    signerRole: String(first?.role ?? "signer"),
    signerWidgets: Array.isArray(first?.widgets) ? (first.widgets as RawWidget[]) : [],
    prefillWidgets,
  };
}

async function opensignGet(path: string): Promise<unknown> {
  const token = opensignApiToken();
  const res = await fetch(`${opensignApiBase()}${path}`, {
    headers: { Accept: "application/json", "x-api-token": token },
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const err =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : text.slice(0, 180);
    throw new Error(err || `OpenSign ${res.status}`);
  }
  return parsed;
}

export async function fetchOpensignTemplate(templateId: string) {
  return templateFromPayload(await opensignGet(`/template/${encodeURIComponent(templateId)}`));
}

export async function listOpensignTemplates(): Promise<OpensignTemplateSummary[]> {
  const parsed = await opensignGet("/templatelist");
  const root = asRecord(parsed);
  const rows = Array.isArray(root?.result) ? root.result : Array.isArray(parsed) ? parsed : [];
  return rows
    .map((row) => templateFromPayload(row))
    .filter((row): row is NonNullable<typeof row> => !!row)
    .map((row) => ({
      objectId: row.objectId,
      title: row.title,
      signerRole: row.signerRole,
      widgetNames: [...row.signerWidgets, ...row.prefillWidgets]
        .map(widgetName)
        .filter(Boolean),
    }));
}

export function buildCreatePayloadFromTemplate(args: {
  title: string;
  template: NonNullable<ReturnType<typeof templateFromPayload>>;
  client: EsignClientPrefill;
  signerName: string;
}) {
  const signerWidgets = args.template.signerWidgets
    .filter((w) => shouldPrefillWidgetType(w.type) && widgetName(w))
    .map((w) => ({
      name: widgetName(w),
      readonly: false,
      default: valueForWidgetName(widgetName(w), args.client),
    }))
    .filter((w) => w.default);

  const prefillWidgets = args.template.prefillWidgets
    .filter((w) => shouldPrefillWidgetType(w.type) && widgetName(w))
    .map((w) => ({
      name: widgetName(w),
      response: valueForWidgetName(widgetName(w), args.client),
    }))
    .filter((w) => w.response);

  return {
    title: args.title,
    note: "Please review, complete, and sign this document.",
    sendInOrder: false,
    enableOTP: false,
    send_email: true,
    timeToCompleteDays: 14,
    signers: [
      {
        role: args.template.signerRole || "signer",
        email: args.client.email,
        name: args.signerName,
        phone: args.client.phone || undefined,
        widgets: signerWidgets,
      },
    ],
    ...(prefillWidgets.length ? { prefill: prefillWidgets } : {}),
  };
}

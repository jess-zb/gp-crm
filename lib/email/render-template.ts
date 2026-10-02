import * as React from "react";
import { render } from "@react-email/render";
import { Text } from "@react-email/components";
import Layout from "@/emails/_layout";
import { templateRegistry, type TemplateKey } from "@/emails";
import { supabaseService } from "@/lib/supabase/service";
import type { EmailProps } from "@/emails/_types";
import { EMAIL_SUBJECTS } from "@/lib/constants/business-contact";

type RenderInput = {
  template_key: string;
  variables: EmailProps;
};

type RenderOutput = { subject: string; html: string };

type TemplateOverride = {
  subject: string | null;
  body: string | null;
  isOverridden: boolean;
};

export async function renderTemplate(
  input: RenderInput & { draft?: { subject?: string | null; body?: string | null } }
): Promise<RenderOutput> {
  const draftSubject = input.draft?.subject?.trim() || null;
  const draftBody = input.draft?.body?.trim() || null;

  // Explicit draft body (preview / test send)
  if (draftBody) {
    const subject = interpolate(draftSubject ?? "", input.variables);
    const html = await renderTextBodyWithLayout(interpolate(draftBody, input.variables), input.variables);
    return { subject, html };
  }

  const dbOverride = await fetchTemplateOverride(input.template_key);

  // Staff-edited override in the database
  if (dbOverride?.isOverridden && dbOverride.body?.trim()) {
    const subject = interpolate(
      draftSubject ?? dbOverride.subject ?? defaultSubjectFor(input.template_key),
      input.variables
    );
    const html = await renderTextBodyWithLayout(
      interpolate(dbOverride.body, input.variables),
      input.variables
    );
    return { subject, html };
  }

  // Default: React Email component (deployed with the app — always current contact info)
  const templateKey = input.template_key as TemplateKey;
  const Component = templateRegistry[templateKey];
  if (!Component) throw new Error(`Unknown template: ${input.template_key}`);

  const subject = interpolate(
    draftSubject ?? dbOverride?.subject ?? defaultSubjectFor(input.template_key),
    input.variables
  );
  const html = await render(Component(input.variables), { pretty: false });
  return { subject, html };
}

function defaultSubjectFor(templateKey: string): string {
  if (templateKey in EMAIL_SUBJECTS) {
    return EMAIL_SUBJECTS[templateKey as keyof typeof EMAIL_SUBJECTS];
  }
  return "";
}

async function fetchTemplateOverride(templateKey: string): Promise<TemplateOverride | null> {
  const { data: msgRow, error: msgErr } = await supabaseService
    .from("email_message_templates")
    .select("default_subject, default_body, is_overridden")
    .eq("template_key", templateKey)
    .maybeSingle();

  if (!msgErr && msgRow) {
    return {
      subject: (msgRow.default_subject as string | null) ?? null,
      body: (msgRow.default_body as string | null) ?? null,
      isOverridden: Boolean(msgRow.is_overridden),
    };
  }

  const { data: commRow, error: commErr } = await supabaseService
    .from("comm_templates")
    .select("subject, body, is_overridden")
    .eq("template_key", templateKey)
    .maybeSingle();

  if (!commErr && commRow) {
    return {
      subject: (commRow.subject as string | null) ?? null,
      body: (commRow.body as string | null) ?? null,
      isOverridden: Boolean(commRow.is_overridden),
    };
  }

  return null;
}

// Simple {client.firstName} substitution
function interpolate(template: string, vars: EmailProps): string {
  return template.replace(/\{([\w.]+)\}/g, (_, p) => {
    const parts = String(p).split(".");
    let v: unknown = vars;
    for (const key of parts) {
      v = (v as Record<string, unknown>)?.[key];
    }
    return v == null ? "" : String(v);
  });
}

function isBulletLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("• ") || t.startsWith("- ");
}

function normalizeBullet(line: string): string {
  const t = line.trimStart();
  if (t.startsWith("• ")) return t.slice(2).trim();
  if (t.startsWith("- ")) return t.slice(2).trim();
  return t.trim();
}

// Wrap plain-text body in <Layout> with paragraph/bullet parsing
async function renderTextBodyWithLayout(bodyText: string, vars: EmailProps): Promise<string> {
  const blocks = bodyText
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const children: React.ReactNode[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const allBullets = lines.length > 1 && lines.every((l) => !l.trim() || isBulletLine(l));

    if (allBullets) {
      const items = lines
        .filter((l) => l.trim())
        .map((l) => normalizeBullet(l))
        .filter(Boolean);

      children.push(
        React.createElement(
          "ul",
          {
            key: `ul-${children.length}`,
            style: {
              margin: "8px 0 16px",
              paddingLeft: "18px",
              color: "#0f172a",
              fontSize: "14px",
              lineHeight: "20px",
            },
          },
          items.map((it, idx) =>
            React.createElement("li", { key: idx, style: { margin: "0 0 6px" } }, it)
          )
        )
      );
      continue;
    }

    const paragraph = lines.join("\n").trim();
    children.push(
      React.createElement(
        Text,
        { key: `p-${children.length}` },
        ...paragraph.split("\n").flatMap((line, idx, arr) => {
          const parts: React.ReactNode[] = [line];
          if (idx < arr.length - 1) parts.push(React.createElement("br", { key: `br-${idx}` }));
          return parts;
        })
      )
    );
  }

  const node = React.createElement(
    Layout as React.ComponentType<EmailProps & { children?: React.ReactNode }>,
    {
      client: vars.client,
      accountManager: vars.accountManager,
      portalUrl: vars.portalUrl,
      unsubscribeUrl: vars.unsubscribeUrl,
    },
    ...children
  );

  return await render(node, { pretty: false });
}

export type { RenderInput, RenderOutput };

/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  EMAIL_SUBJECTS,
  scrubLegacyContactText,
  type EmailSubjectKey,
} from "../lib/constants/business-contact";

const FILES: Record<EmailSubjectKey, string> = {
  welcome_lead: "welcome-lead.tsx",
  welcome_cs: "welcome-cs.tsx",
  follow_up_24hr: "follow-up-24hr.tsx",
  active_1: "active-1.tsx",
  active_2: "active-2.tsx",
  active_3: "active-3.tsx",
  active_4: "active-4.tsx",
  active_5: "active-5.tsx",
  active_6: "active-6.tsx",
  active_7: "active-7.tsx",
  partial_1: "partial-1.tsx",
  partial_2: "partial-2.tsx",
  partial_3: "partial-3.tsx",
  partial_4: "partial-4.tsx",
  case_referred: "case-referred.tsx",
  holiday: "holiday.tsx",
};

function extractDefaultBodyFromTsx(source: string): string {
  const blocks: string[] = [];
  const re = /<Text(?:\s[^>]*)?>([\s\S]*?)<\/Text>/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(source))) {
    let t = m[1] ?? "";

    t = t.replace(/\{\s*([A-Z_]+)\s*\}/g, (_, key: string) => {
      if (key === "SUPPORT_PHONE") return "888-885-6042";
      if (key === "SUPPORT_EMAIL") return "support@debtsupportpros.com";
      if (key === "WEBSITE_URL") return "https://debtsupportpros.com/";
      if (key === "BUSINESS_NAME") return "DebtSupportPros";
      return `{${key}}`;
    });

    t = t.replace(/\{\s*\" \"\s*\}/g, " ");
    t = t.replace(/<br\s*\/>\s*/g, "\n");
    t = t.replace(/[ \t]+\n/g, "\n");
    t = t.replace(/\n[ \t]+/g, "\n");
    t = t.trim();
    if (!t) continue;

    t = t
      .split("\n")
      .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
      .join("\n")
      .trim();

    blocks.push(t);
  }

  return blocks.join("\n\n").trim();
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const emailsDir = path.join(process.cwd(), "emails");
  const keys = Object.keys(FILES) as EmailSubjectKey[];

  for (const key of keys) {
    const filePath = path.join(emailsDir, FILES[key]);
    const src = fs.readFileSync(filePath, "utf8");
    const body = scrubLegacyContactText(extractDefaultBodyFromTsx(src));
    const subject = EMAIL_SUBJECTS[key];

    const { error: msgErr } = await supabase
      .from("email_message_templates")
      .update({
        default_subject: subject,
        default_body: body,
        is_overridden: false,
      })
      .eq("template_key", key);

    if (msgErr) {
      console.warn(`[sync-templates] email_message_templates ${key}:`, msgErr.message);
    } else {
      console.log(`[sync-templates] email_message_templates updated ${key}`);
    }

    const { error: commErr } = await supabase
      .from("comm_templates")
      .update({
        subject,
        body,
        is_overridden: false,
      })
      .eq("template_key", key);

    if (commErr) {
      console.warn(`[sync-templates] comm_templates ${key}:`, commErr.message);
    } else {
      console.log(`[sync-templates] comm_templates updated ${key}`);
    }

    const { error: stepErr } = await supabase
      .from("email_sequence_steps")
      .update({ subject })
      .eq("template_key", key);

    if (stepErr) {
      console.warn(`[sync-templates] email_sequence_steps ${key}:`, stepErr.message);
    }
  }

  console.log("[sync-templates] done");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

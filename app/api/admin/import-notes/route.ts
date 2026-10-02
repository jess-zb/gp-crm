import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";

type ImportNote = {
  phone: string;
  body: string;
  created_at: string;
  creator_email: string;
};

function digits10(p: string): string | null {
  const d = p.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") return d.slice(1);
  if (d.length === 10) return d;
  if (d.length > 10) return d.slice(-10);
  return null;
}

function formatCrmPhone(d10: string): string {
  return `(${d10.slice(0, 3)}) ${d10.slice(3, 6)}-${d10.slice(6)}`;
}

/** Match `clients.phone_mobile` / `phone` across common Shape vs CRM formats. */
async function findClientIdByPhone(
  supabase: ReturnType<typeof createAdminClient>,
  rawPhone: string
): Promise<string | null> {
  const trimmed = rawPhone.trim();
  const variants = new Set<string>([trimmed]);
  const d10 = digits10(trimmed);
  if (d10) {
    variants.add(formatCrmPhone(d10));
    variants.add(d10);
  }
  for (const v of Array.from(variants)) {
    const { data: byMobile } = await supabase
      .from("clients")
      .select("id")
      .eq("phone_mobile", v)
      .maybeSingle();
    if (byMobile?.id) return byMobile.id;
    const { data: byPhone } = await supabase
      .from("clients")
      .select("id")
      .eq("phone", v)
      .maybeSingle();
    if (byPhone?.id) return byPhone.id;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { profile } = await getProfileForUser(supabaseAuth, user);
  if (!profile || profile.role !== "dev") {
    return NextResponse.json({ error: "Dev access only" }, { status: 403 });
  }

  let body: { notes?: ImportNote[]; leadPhoneMap?: Record<string, string> };
  try {
    body = (await req.json()) as {
      notes?: ImportNote[];
      leadPhoneMap?: Record<string, string>;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const notes = Array.isArray(body.notes) ? body.notes : [];
  if (notes.length === 0) {
    return NextResponse.json(
      { error: "missing_notes", imported: 0, skipped: 0, errors: 0 },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const results = { imported: 0, skipped: 0, errors: 0 };

  const { data: support } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", "support@debtsupportpros.com")
    .maybeSingle();
  const supportId = support?.id ?? null;

  for (const note of notes) {
    try {
      const clientId = await findClientIdByPhone(supabase, note.phone);
      if (!clientId) {
        results.skipped++;
        continue;
      }

      let creatorId = supportId;
      if (note.creator_email?.trim()) {
        const { data: creator } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", note.creator_email.trim().toLowerCase())
          .maybeSingle();
        if (creator?.id) creatorId = creator.id;
      }

      const { data: existing } = await supabase
        .from("communications")
        .select("id")
        .eq("client_id", clientId)
        .eq("sent_at", note.created_at)
        .eq("type", "note")
        .maybeSingle();

      if (existing) {
        results.skipped++;
        continue;
      }

      const { error } = await supabase.from("communications").insert({
        client_id: clientId,
        type: "note",
        direction: "internal",
        body: note.body,
        recorded_by: creatorId,
        sent_at: note.created_at,
        subject: null,
      });

      if (error) {
        results.errors++;
        continue;
      }
      results.imported++;
    } catch {
      results.errors++;
    }
  }

  return NextResponse.json(results);
}

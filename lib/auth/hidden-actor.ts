import { createAdminClient } from "@/lib/supabase/admin";
import { HIDDEN_FROM_NON_DEV_EMAILS } from "@/lib/constants/hidden-accounts";

export type HiddenActorSet = {
  ids: Set<string>;
  labels: Set<string>;
};

const EMPTY: HiddenActorSet = { ids: new Set(), labels: new Set() };

/** Names and ids of the hidden dev account. Empty when the viewer is dev. */
export async function loadHiddenActors(viewerRole: string): Promise<HiddenActorSet> {
  if (viewerRole === "dev") return EMPTY;
  const admin = createAdminClient();
  const [byRole, byEmail] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").eq("role", "dev"),
    admin
      .from("profiles")
      .select("id, full_name, email")
      .in("email", [...HIDDEN_FROM_NON_DEV_EMAILS]),
  ]);
  if (byRole.error) console.error("[hidden-actor]", byRole.error.message);
  if (byEmail.error) console.error("[hidden-actor]", byEmail.error.message);

  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const row of [...(byRole.data ?? []), ...(byEmail.data ?? [])]) {
    if (row.id) ids.add(row.id as string);
    const name = (row.full_name as string | null)?.trim().toLowerCase();
    const email = (row.email as string | null)?.trim().toLowerCase();
    if (name) labels.add(name);
    if (email) labels.add(email);
  }
  for (const email of HIDDEN_FROM_NON_DEV_EMAILS) labels.add(email.toLowerCase());
  return { ids, labels };
}

export function redactActorName(
  name: string | null | undefined,
  actorId: string | null | undefined,
  hidden: HiddenActorSet
): string | null {
  if (hidden.ids.size === 0 && hidden.labels.size === 0) return name ?? null;
  if (actorId && hidden.ids.has(actorId)) return "System";
  const trimmed = (name ?? "").trim().toLowerCase();
  if (trimmed && hidden.labels.has(trimmed)) return "System";
  return name ?? null;
}

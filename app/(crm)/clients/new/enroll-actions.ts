"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { enrollClientInEmailSequence } from "@/lib/email/sequence-enrollment";

/** Best-effort welcome drip for new CRM clients (bypasses enrollment RLS). */
export async function enrollWelcomeLeadForNewClientAction(
  clientId: string,
  email: string | null
): Promise<void> {
  const supabase = createServiceClient();
  await enrollClientInEmailSequence(supabase, {
    clientId,
    sequenceKey: "welcome_lead",
    clientEmail: email,
  });
}

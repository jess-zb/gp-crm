"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { EsignDripSection } from "./EsignDripSection";

const FLAG_KEY = "client_esign_section";

export function ClientEsignSection({
  initiallyVisible,
  canToggle,
  clientId,
  clientFirstName,
  clientLastName,
  advisorName,
  canSend,
}: {
  initiallyVisible: boolean;
  canToggle: boolean;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  advisorName: string;
  canSend: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [visible, setVisible] = useState(initiallyVisible);
  const [saving, setSaving] = useState(false);

  async function setFlag(next: boolean) {
    if (saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("staff_feature_flags")
      .update({ visible: next })
      .eq("key", FLAG_KEY);
    setSaving(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    setVisible(next);
    router.refresh();
  }

  if (!visible) {
    if (!canToggle) return null;
    return (
      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void setFlag(true)}
          className="rounded-md px-1.5 py-1 text-xs font-semibold text-[#A87830] hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] disabled:opacity-50 dark:hover:bg-[#2A2418]"
        >
          Show E-Sign
        </button>
      </div>
    );
  }

  return (
    <EsignDripSection
      clientId={clientId}
      clientFirstName={clientFirstName}
      clientLastName={clientLastName}
      advisorName={advisorName}
      canSend={canSend}
      onHide={canToggle ? () => void setFlag(false) : undefined}
    />
  );
}

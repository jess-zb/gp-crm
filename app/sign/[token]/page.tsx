import { createAdminClient } from "@/lib/supabase/admin";
import { esignKindTitle, isEsignKind } from "@/lib/esign/types";
import { SignDocumentClient } from "./SignDocumentClient";
import { SignPageShell } from "../SignPageShell";

export const dynamic = "force-dynamic";

export default async function SignDocumentPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token?.trim() ?? "";
  const admin = createAdminClient();
  const { data } = await admin
    .from("esign_requests")
    .select("id, kind, status, signer_name, token_expires_at")
    .eq("sign_token", token)
    .maybeSingle();

  if (!data) {
    return (
      <SignUnavailable
        title="Invalid link"
        body="This signing link is not valid. Ask your representative to send a new one."
      />
    );
  }
  const expires = data.token_expires_at ? new Date(data.token_expires_at) : null;
  if (expires && expires.getTime() < Date.now()) {
    return (
      <SignUnavailable
        title="Link expired"
        body="This signing link has expired. Ask your representative to resend the document."
      />
    );
  }
  if (data.status === "superseded" || data.status === "revoked") {
    return (
      <SignUnavailable
        title="Link replaced"
        body="A newer signing request was sent. Use the latest email."
      />
    );
  }
  if (data.status === "completed") {
    return (
      <SignUnavailable
        title="Already signed"
        body="This document has already been completed. Thank you."
      />
    );
  }

  const title = isEsignKind(data.kind) ? esignKindTitle(data.kind) : "Document";

  return (
    <SignDocumentClient
      token={token}
      signerName={data.signer_name}
      documentTitle={title}
    />
  );
}

function SignUnavailable({ title, body }: { title: string; body: string }) {
  return (
    <SignPageShell>
      <div className="crm-card p-8 text-center">
        <h1 className="text-[22px] font-semibold text-[#0f172a]">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">{body}</p>
      </div>
    </SignPageShell>
  );
}

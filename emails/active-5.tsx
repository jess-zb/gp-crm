import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Active5Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        Staying confident helps the process. Quick tips:
        <br />- If creditors call, don't engage—ignore the call.
        <br />- Forward any emails, texts, or letters to us immediately.
        <br />- Keep our number handy: {SUPPORT_PHONE}.
      </Text>

      <Text>You're doing great—every week is progress.</Text>

      <Text>
        With you,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


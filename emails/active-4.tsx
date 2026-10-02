import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Active4Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>You're about a month in—great job staying consistent.</Text>

      <Text>
        Remember:
        <br />- Ignore phone calls from creditors (don't engage).
        <br />- Forward any emails, texts, or letters to me.
        <br />- Your Welcome packet may take up to 10 days (if you haven't received it, call {SUPPORT_PHONE}).
      </Text>

      <Text>Need anything right now? Hit reply—we're here.</Text>

      <Text>
        Onward,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


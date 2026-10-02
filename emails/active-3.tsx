import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_EMAIL } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Active3Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        A quick reminder: forward any creditor emails, texts, snap a photo of any mail and send it over to
        {SUPPORT_EMAIL}. Our nationwide network of attorneys relies on this information to challenge and
        invalidate the enrolled debts.
      </Text>

      <Text>Thanks for staying on top of it—this is a big help.</Text>

      <Text>
        Best,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


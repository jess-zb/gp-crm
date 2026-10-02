import * as React from "react";
import { Text } from "@react-email/components";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Active7Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        You've been steady for 90 days—great work. Keep forwarding any emails, texts, or letters you receive. Your
        consistency helps our nationwide network of attorneys continue challenging the enrolled debts.
      </Text>

      <Text>As always, we're always here for you—reply anytime.</Text>

      <Text>
        Thank you for trusting us,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


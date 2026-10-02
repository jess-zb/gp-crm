import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Active6Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        You're making solid progress. Thank you for forwarding communications and sticking to the plan. If anything
        feels unclear—or if your situation changes—reply here or contact us at {SUPPORT_PHONE} and we'll adjust together.
      </Text>

      <Text>
        Proud to be on your team,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


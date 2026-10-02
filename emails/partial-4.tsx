import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Partial4Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        This is our final attempt to help you finish enrollment. Without completing the retainer on your enrolled card,
        we cannot activate your program or move your file forward.
      </Text>

      <Text>If you'd like to proceed, call {SUPPORT_PHONE} or reply within the next 24 hours.</Text>

      <Text>If you no longer wish to continue, let us know and we'll close your file.</Text>

      <Text>
        Sincerely,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


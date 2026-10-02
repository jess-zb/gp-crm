import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Partial3Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        We're still holding your file so you don't lose your place in line. To activate your program, we need to
        complete the retainer payment you authorized.
      </Text>

      <Text>Please call {SUPPORT_PHONE} or reply to this email and we'll take care of it.</Text>

      <Text>
        Thanks,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


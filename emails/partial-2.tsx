import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Partial2Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        Your program isn't active yet. Once we finalize your retainer on the enrolled card, your file moves forward and
        your accounts are protected.
      </Text>

      <Text>Call us at {SUPPORT_PHONE} or reply with a good time—we'll make this quick and easy.</Text>

      <Text>You're almost there.</Text>

      <Text>
        Best regards,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


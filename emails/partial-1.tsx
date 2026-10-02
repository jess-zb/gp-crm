import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Partial1Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        We noticed we missed you for the final step of enrollment. To activate your program and protect your enrolled
        accounts, we just need to complete your retainer.
      </Text>

      <Text>Please call us today at {SUPPORT_PHONE} and we'll wrap this up in a couple of minutes.</Text>

      <Text>If it's easier, reply to this email with a good time to call you.</Text>

      <Text>
        Best,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


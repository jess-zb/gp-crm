import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Active2Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        Just checking in to say you're on the right track. If you get emails, texts, or letters from creditors, please
        send them to me right away. This documentation strengthens your case with our nationwide network of attorneys.
      </Text>

      <Text>Questions? Reply here or call {SUPPORT_PHONE}.</Text>

      <Text>
        Warmly,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


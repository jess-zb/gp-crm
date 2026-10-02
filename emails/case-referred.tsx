import * as React from "react";
import { Text } from "@react-email/components";
import { BUSINESS_NAME, SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function CaseReferredEmail({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        Congratulations—your program is fully active and your file has been referred to our nationwide network of
        attorneys for ongoing work on your behalf.
      </Text>

      <Text>
        At {BUSINESS_NAME}, your Account Manager remains the same and our Client Services department too. If you receive
        emails, texts, or letters from any creditors, continue to forward them to us right away.
      </Text>

      <Text>We're here for you—reply to this email or call {SUPPORT_PHONE} with any questions.</Text>

      <Text>
        Warm regards,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


import * as React from "react";
import { Text } from "@react-email/components";
import { SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function FollowUp24hrEmail({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        We tried reaching you for your scheduled follow-up today but weren't able to connect. This call is important —
        it's where we confirm your account details, review your goals, and officially activate your program.
      </Text>

      <Text>
        Please give us a call at {SUPPORT_PHONE} or reply to this email to pick a new time that works best for you.
      </Text>

      <Text>
        Warm regards,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


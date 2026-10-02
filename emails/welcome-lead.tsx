import * as React from "react";
import { Text } from "@react-email/components";
import { BUSINESS_NAME, WEBSITE_URL } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function WelcomeLeadEmail({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        Welcome to {BUSINESS_NAME}! Thank you for your authorization, we're excited to have you with us and to help you
        take this important step toward financial independence.
      </Text>

      <Text>
        Our team works with a nationwide network of experienced attorneys who are dedicated to protecting your rights
        and helping you resolve your enrolled accounts. We are here to make sure you feel supported every step of the
        way.
      </Text>

      <Text>You can learn more about us and our process anytime at {WEBSITE_URL}</Text>

      <Text>
        Thank you again for trusting us to help you through this journey. We look forward to working with you and
        celebrating your progress along the way.
      </Text>

      <Text>
        Best regards,
        <br />
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


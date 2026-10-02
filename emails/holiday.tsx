import * as React from "react";
import { Text } from "@react-email/components";
import { BUSINESS_NAME } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function HolidayEmail({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Dear {client.firstName},</Text>

      <Text>
        Please be advised that our offices are currently closed in observance of the holiday season. We will resume
        standard business operations on the following business day, at which time we will attend to all inquiries with
        priority.
      </Text>

      <Text>
        We appreciate your patience and apologize for any inconvenience this temporary closure may cause. Should you
        have any matters requiring immediate attention, we invite you to contact us in advance so that we may provide
        the necessary assistance.
      </Text>

      <Text>Thank you for your continued partnership and support.</Text>

      <Text>
        Sincerely,
        <br />
        The {BUSINESS_NAME} Team
      </Text>
    </Layout>
  );
}


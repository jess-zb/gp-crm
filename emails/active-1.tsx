import * as React from "react";
import { Text } from "@react-email/components";
import { BUSINESS_NAME } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function Active1Email({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>Welcome again to {BUSINESS_NAME}—we're excited to support you.</Text>

      <Text>
        What we've completed:
        <br />- Your accounts are officially enrolled.
        <br />- Your authorization/retainer was secured on your enrolled card(s).
        <br />- We reviewed your goals and we're focused on helping you accomplish all of them.
      </Text>

      <Text>
        What to expect next:
        <br />- Welcome Packet: we email you a link to review and sign it.
        <br />- Creditor communications: If you receive emails, texts, or letters, forward them to me. For mail, snap a
        photo and email/text it to me. Our nationwide network of attorneys uses this information to help challenge and
        invalidate debts.
      </Text>

      <Text>
        Your main contacts are me (your Account Manager) and our Client Services team. We'll check in regularly and keep
        you updated.
      </Text>

      <Text>We're with you every step of the way.</Text>

      <Text>
        {accountManager.firstName} {accountManager.lastName}
      </Text>
    </Layout>
  );
}


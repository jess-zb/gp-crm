import * as React from "react";
import { Text } from "@react-email/components";
import { BUSINESS_NAME, SUPPORT_PHONE } from "@/lib/constants/business-contact";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export default function WelcomeCsEmail({ client, accountManager, portalUrl, unsubscribeUrl }: EmailProps) {
  return (
    <Layout
      client={client}
      accountManager={accountManager}
      portalUrl={portalUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {client.firstName},</Text>

      <Text>
        It was great speaking with you today! I want to officially welcome you to the next phase of your program with{" "}
        {BUSINESS_NAME}. My name is Emile Points, and I'm the Manager of the Client Services Department.
      </Text>

      <Text>
        From this point forward, Client Services will be your main point of contact throughout the next stage of your
        program. While you will always have access to your Account Manager, our team will now handle your ongoing
        communication, progress updates, and any creditor correspondence related to your enrolled accounts.
      </Text>

      <Text>
        Over the next 90 days, my team and I will be helping to organize and prepare your case file for review by our
        nationwide network of attorneys and paralegals. This process ensures that your enrolled accounts are fully
        documented and positioned for the next step in your program.
      </Text>

      <Text>
        You may hear from me directly or another member of my team — but rest assured, we all work closely together and
        share the same goal. Keeping your case on track to make this process as smooth and successful as possible.
      </Text>

      <Text>
        Here's how to reach us anytime:
        <br />
        📞 Client Services Department: {SUPPORT_PHONE}
        <br />
        📞 Direct Line (Emile Points, Manager): 520-689-8843
        <br />
        📧 Email: emile@debtsupportpros.com
      </Text>

      <Text>
        What to expect next:
        <br />- Continue to forward any emails, letters, or text messages you receive from your creditors.
        <br />- Our team will log and review these communications — they are important in helping the attorneys build
        your case.
        <br />- Once enough documentation has been gathered, your file will be assigned to the attorney team best suited
        to your specific situation.
      </Text>

      <Text>
        We're honored to be part of your journey toward financial freedom, and we'll be in touch often to make sure
        everything stays on track. If you ever have questions, please don't hesitate to reach out — we're here for you
        every step of the way.
      </Text>

      <Text>
        Warm regards,
        <br />
        Emile Points
        <br />
        Manager, Client Services
      </Text>
    </Layout>
  );
}


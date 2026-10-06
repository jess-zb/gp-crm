import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import { BUSINESS_NAME, publicAppUrl } from "@/lib/constants/business-contact";
import type { AttorneyPortalAssignmentEmailProps } from "./_staff-types";

export default function AttorneyPortalAssignmentEmail({
  attorney,
  casesUrl,
  clients,
}: AttorneyPortalAssignmentEmailProps) {
  const count = clients.length;
  return (
    <Html>
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img
              src={`${publicAppUrl()}/logo.png`}
              alt={BUSINESS_NAME}
              width={180}
              style={styles.logo}
            />
          </Section>
          <Section style={styles.content}>
            <Text style={styles.text}>Hi {attorney.firstName},</Text>
            <Text style={styles.text}>
              {count === 1
                ? "A new case has been assigned to you in the Golden Pathway attorney portal."
                : `${count} new cases have been assigned to you in the Golden Pathway attorney portal.`}
            </Text>
            {clients.map((c) => (
              <Text key={c.caseUrl} style={styles.text}>
                • {c.name} —{" "}
                <Link href={c.caseUrl} style={styles.link}>
                  View case
                </Link>
              </Text>
            ))}
            <Text style={styles.text}>
              <Link href={casesUrl} style={styles.link}>
                View all cases
              </Link>
            </Text>
            <Text style={styles.text}>
              Sign in with your attorney CRM credentials to review client contact
              info, the signed Welcome Packet, and collection letters.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#f8fafc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    margin: "0 auto",
    padding: "24px 16px",
    maxWidth: "560px",
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "16px",
  },
  logo: {
    margin: "0 auto",
  },
  content: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "24px",
    border: "1px solid #e2e8f0",
  },
  text: {
    color: "#0f172a",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 12px",
  },
  link: {
    color: "#161616",
    textDecoration: "underline",
  },
};

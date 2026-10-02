import * as React from "react";
import { Body, Container, Head, Html, Img, Link, Section, Text } from "@react-email/components";
import {
  BUSINESS_NAME,
  publicAppUrl,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from "@/lib/constants/business-contact";
import type { EmailProps } from "./_types";

type LayoutProps = EmailProps & {
  children: React.ReactNode;
};

const NAVY = "#0A2540";
const BRAND = "#8DE3B5";
const SLATE_900 = "#0f172a";
const SLATE_600 = "#475569";
const SLATE_500 = "#64748b";
const BORDER = "#e2e8f0";

export default function Layout({ children, unsubscribeUrl }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Body style={styles.body}>
        <Container style={styles.card}>
          <Section style={styles.banner}>
            <Img
              src={`${publicAppUrl()}/logo.png`}
              alt={BUSINESS_NAME}
              width={160}
              style={styles.logoImg}
            />
          </Section>

          <Section style={styles.content}>{children}</Section>

          <Section style={styles.footer}>
            <Text style={styles.footerContact}>
              {BUSINESS_NAME}{" "}
              <span style={styles.dot}>•</span> {SUPPORT_EMAIL}{" "}
              <span style={styles.dot}>•</span> {SUPPORT_PHONE}
            </Text>
            <Text style={styles.footerUnsubscribe}>
              <Link href={unsubscribeUrl} style={styles.unsubscribe}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#f8fafc",
    margin: 0,
    padding: "24px 16px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    color: SLATE_900,
  },
  card: {
    maxWidth: "560px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    border: `1px solid ${BORDER}`,
    borderRadius: "12px",
    overflow: "hidden",
  },
  banner: {
    backgroundColor: NAVY,
    padding: "20px 24px",
  },
  logoImg: {
    display: "block",
    border: 0,
    margin: 0,
  },
  content: {
    padding: "24px",
  },
  footer: {
    borderTop: `1px solid ${BORDER}`,
    padding: "16px 24px",
  },
  footerContact: {
    margin: "0 0 8px",
    fontSize: "13px",
    lineHeight: "1.55",
    color: SLATE_600,
  },
  dot: {
    fontSize: "18px",
    fontWeight: 700,
    color: BRAND,
  },
  footerUnsubscribe: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "18px",
    color: SLATE_500,
  },
  unsubscribe: {
    color: SLATE_500,
    textDecoration: "underline",
  },
};

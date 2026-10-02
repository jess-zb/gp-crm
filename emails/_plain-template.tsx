import * as React from "react";
import { Text } from "@react-email/components";
import Layout from "./_layout";
import type { EmailProps } from "./_types";

export type PlainTemplateProps = EmailProps & {
  body: string;
};

function renderParagraphLines(paragraph: string) {
  const lines = paragraph.split("\n");
  return (
    <>
      {lines.map((line, idx) => (
        <React.Fragment key={idx}>
          {line}
          {idx < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </>
  );
}

export default function PlainTemplateEmail({
  client,
  accountManager,
  portalUrl,
  unsubscribeUrl,
  body,
}: PlainTemplateProps) {
  const paragraphs = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Layout client={client} accountManager={accountManager} portalUrl={portalUrl} unsubscribeUrl={unsubscribeUrl}>
      {paragraphs.map((p, idx) => (
        <Text key={idx}>{renderParagraphLines(p)}</Text>
      ))}
    </Layout>
  );
}


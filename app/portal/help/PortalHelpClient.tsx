"use client";

import Link from "next/link";
import { useState } from "react";

type FaqItem = { q: string; a: string };

const SECTIONS: { title: string; items: FaqItem[] }[] = [
  {
    title: "Your Case Progress",
    items: [
      {
        q: "What do the progress steps mean?",
        a:
          "Your case moves through these steps:\n\n1) Lead Intake — we have your information\n2) Account Manager — your welcome packet is sent to you to sign\n3) Client Services — your case manager is assigned\n4) Awaiting Collection Letter — please send us any debt collection letters you receive\n5) Case Sent to Attorneys — our attorneys are working your case\n6) Complete — your case is finished",
      },
      {
        q: "How long does each step take?",
        a:
          "Steps 1-3 typically take 1-3 business days once you have signed your welcome packet. Steps 5-6 depend on when collection letters arrive. Your case manager will keep you updated.",
      },
    ],
  },
  {
    title: "Your Account Manager",
    items: [
      {
        q: "How do I receive my welcome packet?",
        a:
          "By email. We send you a secure link to review and sign it electronically, so there is nothing to print, post, or mail back.",
      },
      {
        q: "I opened the link — what do I do next?",
        a:
          "Read through the packet, including the POA (Power of Attorney), then type your name and sign at the bottom. Your signed copy is saved to the Documents section on this page as soon as you finish.",
      },
      {
        q: "I never received the email",
        a:
          "Check your spam or junk folder first. If it is not there, message your case manager through the Messages section below and they will resend the link.",
      },
    ],
  },
  {
    title: "Collection Letters",
    items: [
      {
        q: "What is a collection letter?",
        a:
          "A collection letter is any written notice from a debt collector or creditor demanding payment. It may come by mail or email.",
      },
      {
        q: "What do I do when I receive one?",
        a:
          "Take a clear photo or scan the letter. Contact your case manager through Messages and let them know. They will guide you on how to submit it.",
      },
    ],
  },
  {
    title: "Your Documents",
    items: [
      {
        q: "How do I download my documents?",
        a:
          "Go to the Documents section on this page. Click Download next to any file to save it to your device.",
      },
    ],
  },
  {
    title: "Messages",
    items: [
      {
        q: "How do I contact my case manager?",
        a:
          "Use the Messages section at the bottom of this page. Type your message and click Send. Your case manager will respond within 1 business day.",
      },
      {
        q: "Can I message my attorney?",
        a:
          "Yes. Once your case reaches the attorneys, your attorney can also see and reply to your messages.",
      },
    ],
  },
];

export default function PortalHelpClient() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-[#F5F6F8] pb-12 dark:bg-[#121212]">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/portal"
            className="inline-flex text-sm font-semibold text-[#A87830] hover:underline"
          >
            ← Back to portal
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Help Center
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Frequently asked questions
        </p>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">
                {section.title}
              </h2>
              <div className="space-y-2">
                {section.items.map((item) => {
                  const key = `${section.title}::${item.q}`;
                  const open = openKey === key;
                  return (
                    <div
                      key={key}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenKey(open ? null : key)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white"
                        aria-expanded={open}
                      >
                        <span>{item.q}</span>
                        <span className="shrink-0 text-slate-400" aria-hidden>
                          {open ? "−" : "+"}
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-slate-100 px-4 py-3 text-sm leading-loose text-slate-700 dark:border-[#2E2E2E] dark:text-slate-300">
                          {item.a.split("\n\n").map((para, i) => (
                            <p key={i} className={i > 0 ? "mt-3" : ""}>
                              {para}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

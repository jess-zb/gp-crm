/**
 * ZB-CRM Guide Screenshot Capture Script
 *
 * Logs into the CRM, navigates to each guide step's location, takes a
 * screenshot, and uploads it to the Supabase `guide-screenshots` storage
 * bucket at `{slug}/step-{n}.png`.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/capture-guide-screenshots.ts
 *
 * Required env vars (add to .env.local or pass inline):
 *   NEXT_PUBLIC_SUPABASE_URL       — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY      — service role key (bypasses RLS)
 *   CAPTURE_CRM_URL                — local or prod URL, e.g. http://localhost:3000
 *   CAPTURE_CRM_EMAIL              — staff login email
 *   CAPTURE_CRM_PASSWORD           — staff login password
 *   CAPTURE_SLUG                   — (optional) only capture this guide slug
 *
 * Install deps (once):
 *   pnpm add -D playwright @playwright/test
 *   npx playwright install chromium
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// ─── Env ─────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRM_URL = (process.env.CAPTURE_CRM_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.CAPTURE_CRM_EMAIL!;
const PASSWORD = process.env.CAPTURE_CRM_PASSWORD!;
const ONLY_SLUG = process.env.CAPTURE_SLUG ?? null;

if (!SUPABASE_URL || !SERVICE_KEY || !EMAIL || !PASSWORD) {
  console.error(
    "Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CAPTURE_CRM_EMAIL, CAPTURE_CRM_PASSWORD"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "guide-screenshots";
const VIEWPORT = { width: 1440, height: 900 };

// ─── Step scenario definitions ───────────────────────────────────────────────
// Each step has:
//   url     — where to navigate (relative to CRM_URL)
//   actions — optional async fn to run before screenshot (open modal, click, etc.)

type Scenario = {
  slug: string;
  stepNumber: number; // 1-based
  url: string;
  actions?: (page: import("playwright").Page) => Promise<void>;
};

const SCENARIOS: Scenario[] = [
  // ── Lesson 1: Getting Started ─────────────────────────────────────────────
  { slug: "getting-started", stepNumber: 1, url: "/clients" },
  {
    slug: "getting-started",
    stepNumber: 2,
    url: "/clients",
  },
  {
    slug: "getting-started",
    stepNumber: 3,
    url: "/clients/new",
  },
  {
    slug: "getting-started",
    stepNumber: 4,
    url: "/clients/new",
    actions: async (p) => {
      // scroll to contact section
      await p.evaluate(() => window.scrollBy(0, 300));
    },
  },
  {
    slug: "getting-started",
    stepNumber: 5,
    url: "/clients/new",
    actions: async (p) => {
      await p.evaluate(() => window.scrollBy(0, 500));
    },
  },
  {
    slug: "getting-started",
    stepNumber: 6,
    url: "/clients/new",
    actions: async (p) => {
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    },
  },
  { slug: "getting-started", stepNumber: 7, url: "/clients" },
  { slug: "getting-started", stepNumber: 8, url: "/clients" },

  // ── Lesson 2: Welcome Packet & FedEx ─────────────────────────────────────
  { slug: "welcome-packet-fedex", stepNumber: 1, url: "/clients" },
  { slug: "welcome-packet-fedex", stepNumber: 2, url: "/clients" },
  { slug: "welcome-packet-fedex", stepNumber: 3, url: "/packets" },
  { slug: "welcome-packet-fedex", stepNumber: 4, url: "/packets" },
  { slug: "welcome-packet-fedex", stepNumber: 5, url: "/packets" },
  { slug: "welcome-packet-fedex", stepNumber: 6, url: "/packets" },
  { slug: "welcome-packet-fedex", stepNumber: 7, url: "/packets" },

  // ── Lesson 3: Working the Checklist ──────────────────────────────────────
  { slug: "working-the-checklist", stepNumber: 1, url: "/clients" },
  { slug: "working-the-checklist", stepNumber: 2, url: "/clients" },
  { slug: "working-the-checklist", stepNumber: 3, url: "/clients" },
  { slug: "working-the-checklist", stepNumber: 4, url: "/clients" },
  { slug: "working-the-checklist", stepNumber: 5, url: "/clients" },
  { slug: "working-the-checklist", stepNumber: 6, url: "/clients" },
  { slug: "working-the-checklist", stepNumber: 7, url: "/clients" },

  // ── Lesson 4: Logging Communications ─────────────────────────────────────
  { slug: "logging-communications", stepNumber: 1, url: "/clients" },
  { slug: "logging-communications", stepNumber: 2, url: "/clients" },
  { slug: "logging-communications", stepNumber: 3, url: "/clients" },
  { slug: "logging-communications", stepNumber: 4, url: "/clients" },
  { slug: "logging-communications", stepNumber: 5, url: "/clients" },
  { slug: "logging-communications", stepNumber: 6, url: "/clients" },

  // ── Lesson 5: Managing Team & Pipeline ───────────────────────────────────
  { slug: "managing-team-pipeline", stepNumber: 1, url: "/team" },
  { slug: "managing-team-pipeline", stepNumber: 2, url: "/team" },
  { slug: "managing-team-pipeline", stepNumber: 3, url: "/team" },
  { slug: "managing-team-pipeline", stepNumber: 4, url: "/pipeline" },
  { slug: "managing-team-pipeline", stepNumber: 5, url: "/pipeline" },
  { slug: "managing-team-pipeline", stepNumber: 6, url: "/communications" },
  { slug: "managing-team-pipeline", stepNumber: 7, url: "/reports" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadToSupabase(
  slug: string,
  stepNumber: number,
  pngBuffer: Buffer
): Promise<void> {
  const storagePath = `${slug}/step-${stepNumber}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, pngBuffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) {
    throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);
  }
  console.log(`  ✓ uploaded → ${BUCKET}/${storagePath}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Dynamic import of playwright so the file compiles even if playwright isn't installed yet
  let chromium: import("playwright").BrowserType;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    console.error(
      "\nPlaywright is not installed. Run:\n  pnpm add -D playwright\n  npx playwright install chromium\n"
    );
    process.exit(1);
  }

  const scenarios = ONLY_SLUG
    ? SCENARIOS.filter((s) => s.slug === ONLY_SLUG)
    : SCENARIOS;

  if (!scenarios.length) {
    console.error(`No scenarios found${ONLY_SLUG ? ` for slug "${ONLY_SLUG}"` : ""}.`);
    process.exit(1);
  }

  console.log(`\nZB-CRM guide screenshot capture`);
  console.log(`CRM URL : ${CRM_URL}`);
  console.log(`Bucket  : ${BUCKET}`);
  console.log(`Steps   : ${scenarios.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // ── Login ──────────────────────────────────────────────────────────────
  console.log("Logging in…");
  await page.goto(`${CRM_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Wait for React to hydrate and the form to be interactive
  await page.waitForSelector('input[type="email"]', { state: "visible", timeout: 15_000 });
  // Use pressSequentially so each keystroke fires and React's onChange updates state
  await page.locator('input[type="email"]').click();
  await page.locator('input[type="email"]').pressSequentially(EMAIL, { delay: 30 });
  await page.locator('input[name="password"]').click();
  await page.locator('input[name="password"]').pressSequentially(PASSWORD, { delay: 30 });
  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from /login — Supabase auth + profile lookup can take a few seconds
  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 30_000,
    });
  } catch {
    // Dump the page state to help diagnose
    const debugPng = await page.screenshot({ type: "png" });
    require("fs").writeFileSync("/tmp/zb-crm-login-debug.png", Buffer.from(debugPng));
    const bodyText = await page.locator("body").innerText().catch(() => "(could not read body)");
    console.error("\nLogin redirect timed out. Current URL:", page.url());
    console.error("Page text:", bodyText.slice(0, 400));
    console.error("Debug screenshot saved to /tmp/zb-crm-login-debug.png");
    throw new Error("Login redirect timed out");
  }
  // Allow the dashboard to settle after redirect
  await page.waitForTimeout(2000);
  console.log("Logged in ✓\n");

  // ── Capture loop ───────────────────────────────────────────────────────
  const errors: string[] = [];

  for (const scenario of scenarios) {
    const label = `${scenario.slug} / step-${scenario.stepNumber}`;
    process.stdout.write(`Capturing ${label}…`);

    try {
      const fullUrl = `${CRM_URL}${scenario.url}`;
      await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(800); // allow animations to settle

      if (scenario.actions) {
        await scenario.actions(page);
        await page.waitForTimeout(400);
      }

      const pngBuffer = await page.screenshot({ fullPage: false, type: "png" });
      await uploadToSupabase(scenario.slug, scenario.stepNumber, Buffer.from(pngBuffer));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(` ✗ ERROR: ${msg}\n`);
      errors.push(`${label}: ${msg}`);
    }
  }

  await browser.close();

  console.log("\n─────────────────────────────────");
  if (errors.length === 0) {
    console.log(`All ${scenarios.length} screenshots captured and uploaded ✓`);
  } else {
    console.log(`${scenarios.length - errors.length} succeeded, ${errors.length} failed:`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Quick mobile layout smoke test (iPhone viewport).
 * Usage: npm run dev (separate terminal), then node scripts/mobile-ui-check.mjs
 * Optional: BASE_URL=https://your-app-host LOGIN_EMAIL=... LOGIN_PASSWORD=...
 */
import { chromium, devices } from "playwright";

const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.LOGIN_EMAIL?.trim();
const password = process.env.LOGIN_PASSWORD?.trim();

const iPhone = devices["iPhone 13"];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...iPhone });
  const page = await context.newPage();

  const issues = [];

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    if (email && password) {
      await page.fill('input[type="email"], input[name="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(clients|dashboard)/, { timeout: 60_000 });
    } else {
      console.warn("Skipping login — set LOGIN_EMAIL and LOGIN_PASSWORD to test authenticated pages.");
      await browser.close();
      return;
    }

    await page.goto(`${baseUrl}/clients`, { waitUntil: "networkidle", timeout: 60_000 });

    const nameCells = page.locator("table tbody tr").first().locator("td").nth(1);
    const nameText = (await nameCells.innerText()).trim();
    const nameBox = await nameCells.boundingBox();
    if (nameText.endsWith("…") || nameText.length <= 4) {
      issues.push(`Client name appears truncated: "${nameText}"`);
    }
    if (nameBox && nameBox.width < 80) {
      issues.push(`Client name column very narrow: ${Math.round(nameBox.width)}px`);
    }

    await page.click('button[aria-label="Open chat"], button:has-text("Messages")').catch(() => null);
    const chatPanel = page.locator(".chat-panel-mobile");
    if (await chatPanel.count()) {
      await chatPanel.first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => null);
      const panelBox = await chatPanel.first().boundingBox();
      const viewport = page.viewportSize();
      if (panelBox && viewport && panelBox.y < 0) {
        issues.push(`Chat panel top clipped (${Math.round(panelBox.y)}px above viewport)`);
      }
      if (panelBox && viewport && panelBox.y > 80) {
        issues.push(`Chat panel starts low (${Math.round(panelBox.y)}px from top)`);
      }
    }

    if (issues.length) {
      console.error("Mobile UI issues:\n", issues.map((i) => `  - ${i}`).join("\n"));
      process.exitCode = 1;
    } else {
      console.log("Mobile UI check passed (clients list + chat panel).");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

/**
 * Lists OpenSign Cloud templates and prints IDs + widget names.
 * Needs OPENSIGN_API_TOKEN in .env.local (sandbox is fine).
 *
 *   npm run sync:opensign-templates
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { listOpensignTemplates, fetchOpensignTemplate } from "../lib/esign/opensign-template";
import {
  isEsignFeatureEnabled,
  opensignApiBase,
  opensignApiToken,
  opensignWebhookSecret,
  templateIdForKind,
} from "../lib/esign/config";
import { valueForWidgetName, type EsignClientPrefill } from "../lib/esign/map-client-prefill";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  if (!opensignApiToken()) {
    console.error("Set OPENSIGN_API_TOKEN in .env.local first (sandbox token is OK).");
    process.exit(1);
  }
  console.log(`OpenSign base: ${opensignApiBase()}`);
  console.log(`Flag on: ${isEsignFeatureEnabled() ? "yes" : "NO — set OPENSIGN_ESIGN_ENABLED=true"}`);
  console.log(`Webhook secret set: ${opensignWebhookSecret() ? "yes" : "NO"}\n`);

  const templates = await listOpensignTemplates();
  if (!templates.length) {
    console.log("No templates on this account yet.");
  }
  for (const t of templates) {
    const bound =
      t.objectId === templateIdForKind("cc_authorization")
        ? "  ← bound as CC Auth"
        : t.objectId === templateIdForKind("welcome_packet")
          ? "  ← bound as Welcome Packet"
          : "";
    console.log(`${t.title || "(untitled)"}`);
    console.log(`  id:    ${t.objectId}${bound}`);
    console.log(`  role:  ${t.signerRole}`);
    console.log(`  fields: ${t.widgetNames.join(", ") || "(none named)"}`);
    console.log("");
  }

  const sample: EsignClientPrefill = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "5551112222",
    street: "1 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    dateOfBirth: "1815-12-10",
    spouseName: "William",
    advisor: "Jordan",
    mid: "SUNSET",
    amountAuthorized: "150.00",
    card1Last4: "4242",
    card1Amount: "100.00",
    card2Last4: "1111",
    card2Amount: "50.00",
    card3Last4: "",
    card3Amount: "",
    card4Last4: "",
    card4Amount: "",
    card5Last4: "",
    card5Amount: "",
  };
    card2Amount: "50.00",
  };

  for (const kind of ["cc_authorization", "welcome_packet"] as const) {
    const id = templateIdForKind(kind);
    console.log(`Bound ${kind}: ${id || "(missing)"}`);
    if (!id) continue;
    const detail = await fetchOpensignTemplate(id);
    if (!detail) {
      console.log("  could not load this template id\n");
      continue;
    }
    const names = [...detail.signerWidgets, ...detail.prefillWidgets]
      .map((w) => String(w.options?.name ?? w.name ?? "").trim())
      .filter(Boolean);
    const unmapped = names.filter((n) => !valueForWidgetName(n, sample));
    console.log(`  title: ${detail.title}`);
    console.log(`  role:  ${detail.signerRole}`);
    console.log(`  fields: ${names.join(", ") || "(none)"}`);
    if (unmapped.length) {
      console.log(`  unmapped (client leaves blank): ${unmapped.join(", ")}`);
    } else {
      console.log("  all named fields map to the client file");
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

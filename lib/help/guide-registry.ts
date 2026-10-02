import type { HelpArticle } from "@/app/(crm)/help/helpContent";

/** Percent-based box inside the mock CRM frame (0–100). */
export type GuideHighlight = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type GuideStep = {
  title: string;
  narration: string;
  highlight: GuideHighlight;
};

const HIGHLIGHT_PRESETS: GuideHighlight[] = [
  { left: 4, top: 18, width: 18, height: 12 },
  { left: 4, top: 34, width: 18, height: 12 },
  { left: 26, top: 14, width: 68, height: 14 },
  { left: 26, top: 34, width: 42, height: 38 },
  { left: 58, top: 52, width: 36, height: 22 },
];

function presetForIndex(i: number): GuideHighlight {
  return HIGHLIGHT_PRESETS[i % HIGHLIGHT_PRESETS.length];
}

function chunkBodyToNarrations(body: string, maxSteps: number): string[] {
  const t = body.trim();
  if (!t) return ["Follow the steps in this guide."];
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    buf = buf ? `${buf} ${p}` : p;
    if (buf.length >= 100 || /[.!?]$/.test(p)) {
      out.push(buf.trim());
      buf = "";
      if (out.length >= maxSteps) break;
    }
  }
  if (buf.trim() && out.length < maxSteps) out.push(buf.trim());
  return out.length ? out.slice(0, maxSteps) : [t];
}

function blocksToNarrations(article: HelpArticle, maxSteps: number): string[] {
  const narrations: string[] = [];
  if (!article.blocks?.length) return [];
  for (const b of article.blocks) {
    if (b.type === "ol" || b.type === "ul") {
      for (const item of b.items) {
        narrations.push(item.trim());
        if (narrations.length >= maxSteps) return narrations;
      }
    } else if (b.type === "p" && b.text.trim().length > 0) {
      narrations.push(b.text.trim());
      if (narrations.length >= maxSteps) return narrations;
    } else if (b.type === "callout" && b.text.trim().length > 0) {
      narrations.push(`Note: ${b.text.trim()}`);
      if (narrations.length >= maxSteps) return narrations;
    }
  }
  return narrations;
}

/**
 * Build tour steps from help article content (ordered lists preferred, else body sentences).
 */
export function buildGuideStepsFromArticle(article: HelpArticle): GuideStep[] {
  const maxSteps = 8;
  let narrations = blocksToNarrations(article, maxSteps);
  if (narrations.length === 0) {
    narrations = chunkBodyToNarrations(article.body, maxSteps);
  }
  return narrations.map((narration, i) => ({
    title: `Step ${i + 1}`,
    narration,
    highlight: presetForIndex(i),
  }));
}

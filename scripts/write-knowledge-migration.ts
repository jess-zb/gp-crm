import { writeFileSync } from "node:fs";
import path from "node:path";
import { KNOWLEDGE_CURRICULUM, RETIRED_KNOWLEDGE_TITLES } from "../lib/knowledge-base/curriculum";

function quote(value: string): string {
  let tag = "kb";
  while (value.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${value}$${tag}$`;
}

const retired = RETIRED_KNOWLEDGE_TITLES.map((title) => quote(title)).join(",\n  ");

const inserts = KNOWLEDGE_CURRICULUM.map(
  (article) => `INSERT INTO public.knowledge_base_articles (title, body, category, sort_order)
SELECT ${quote(article.title)}, ${quote(article.body)}, ${quote(article.category)}, ${article.sortOrder}
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_base_articles WHERE title = ${quote(article.title)}
);`
).join("\n\n");

const sql = `-- Staff walkthrough. Replaces the short starter articles, including the
-- retired claim that a missing card authorization does not block a stage change.

ALTER TABLE public.knowledge_base_articles
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Start here';

DELETE FROM public.knowledge_base_articles
WHERE title IN (
  ${retired}
);

${inserts}
`;

const out = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "supabase",
  "migrations",
  "0022_knowledge_base_curriculum.sql"
);

writeFileSync(out, sql);
console.log(`Wrote ${out} (${sql.length} bytes)`);

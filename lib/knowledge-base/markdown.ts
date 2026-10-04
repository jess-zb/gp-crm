export type MarkdownBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "image"; alt: string; src: string };

const IMAGE_LINE = /^!\[([^\]]*)\]\((\/kb\/[a-z0-9-]+\.(?:png|jpe?g|webp))\)$/;

/** Small markdown subset: headings, paragraphs, lists, pictures, and **bold**. */
export function parseKnowledgeMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered = false;

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text) blocks.push({ type: "paragraph", text });
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "list", items: list, ordered });
    list = [];
    ordered = false;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const image = IMAGE_LINE.exec(line);
    if (image) {
      flushParagraph();
      flushList();
      blocks.push({ type: "image", alt: image[1].trim(), src: image[2] });
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: line.slice(2).trim() });
      continue;
    }
    const numbered = /^(\d+)\.\s+(.+)$/.exec(line);
    if (numbered) {
      flushParagraph();
      if (list.length && !ordered) flushList();
      ordered = true;
      list.push(numbered[2].trim());
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      if (list.length && ordered) flushList();
      ordered = false;
      list.push(line.slice(2).trim());
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

import type { Chunk, Doc } from "../types.js";

/** ~4 characters per token is a decent estimate for English prose. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const MAX_CHUNK_TOKENS = 600;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "section";

/**
 * Chunk by markdown heading (## through ####), not by fixed size, so each chunk
 * is one coherent section. Oversized sections are split on paragraphs.
 */
export function chunkDoc(doc: Doc): Chunk[] {
  const lines = doc.body.split("\n");
  const sections: { path: string[]; lines: string[] }[] = [];
  const stack: string[] = [];
  let current = { path: [] as string[], lines: [] as string[] };

  for (const line of lines) {
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      if (current.lines.join("").trim()) sections.push(current);
      const level = h[1].length;
      // Track headings by level so skipped levels (## then ####) don't leave holes
      for (let i = level; i < 5; i++) stack[i] = "";
      if (level > 1) stack[level] = h[2].trim();
      current = { path: stack.filter(Boolean), lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.join("").trim()) sections.push(current);

  const chunks: Chunk[] = [];
  const seen = new Map<string, number>();

  for (const section of sections) {
    for (const piece of splitOversized(section.lines.join("\n").trim())) {
      const headingPath = [doc.title, ...section.path];
      let slug = slugify(section.path.join(" ") || "intro");
      const n = seen.get(slug) ?? 0;
      seen.set(slug, n + 1);
      if (n > 0) slug = `${slug}-${n + 1}`;

      chunks.push({
        id: `${doc.id}#${slug}`,
        docId: doc.id,
        headingPath,
        text: piece,
        contextHeader: contextHeader(doc, headingPath),
        tokens: estimateTokens(piece),
        meta: stripBody(doc),
      });
    }
  }
  return chunks;
}

function splitOversized(text: string): string[] {
  if (estimateTokens(text) <= MAX_CHUNK_TOKENS) return [text];
  const parts: string[] = [];
  let buf = "";
  for (const para of text.split(/\n{2,}/)) {
    if (buf && estimateTokens(buf + para) > MAX_CHUNK_TOKENS) {
      parts.push(buf.trim());
      buf = "";
    }
    buf += para + "\n\n";
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/** The "contextual retrieval" header: makes a chunk understandable on its own. */
function contextHeader(doc: Doc, path: string[]): string {
  const bits = [
    `From: ${doc.team} › ${path.join(" › ")}`,
    `Status: ${doc.status}`,
    `Scope: ${doc.scope}${doc.appliesTo ? ` (${doc.appliesTo})` : ""}`,
    `Type: ${doc.docType}`,
  ];
  if (doc.updated) bits.push(`Updated: ${doc.updated}`);
  return bits.join(". ") + ".";
}

function stripBody({ body: _body, ...meta }: Doc) {
  return meta;
}

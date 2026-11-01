/**
 * L0 candidate generation: a small, dependency-free BM25 keyword index.
 * Cheap and high-recall. Embeddings get added alongside this (hybrid search)
 * in milestone 2; keep this as the keyword half.
 */
const STOPWORDS = new Set(
  "a an and are as at be by can do does for from has have how i in is it its of on or should that the their them there these this to use used using was what when where which who why will with you your".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** Tiny suffix stemmer: buttons → button, dismissed → dismiss. */
function stem(t: string): string {
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 4 && t.endsWith("es") && !t.endsWith("ses")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  if (t.length > 5 && t.endsWith("ed")) return t.slice(0, -2);
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  return t;
}

export class Bm25Index {
  private docs: { id: string; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;

  constructor(private k1 = 1.2, private b = 0.75) {}

  add(id: string, text: string) {
    const tokens = tokenize(text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.docs.push({ id, tf, len: tokens.length });
  }

  finalize() {
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length);
  }

  search(query: string, limit = 50): { id: string; score: number }[] {
    const terms = [...new Set(tokenize(query))];
    const N = this.docs.length;
    const scored: { id: string; score: number }[] = [];

    for (const d of this.docs) {
      let score = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += (idf * (f * (this.k1 + 1))) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen));
      }
      if (score > 0) scored.push({ id: d.id, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

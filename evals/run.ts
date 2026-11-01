/**
 * Retrieval evals. Measures whether the right section reaches the agent, and at
 * what token cost. Run after every retrieval change and commit the results file
 * so improvements (and regressions) are visible over time.
 *
 *   npm run eval
 *   npm run eval -- --label "added synonyms"
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { searchKnowledge } from "../src/knowledge.js";

interface Question {
  id: string;
  type: string;
  question: string;
  /** A result counts as correct if its id starts with any of these. */
  expected: string[];
  /** Results that must not appear in the top 5 (e.g. deprecated guidance). */
  mustNotInclude?: string[];
}

const K = 5;
const labelIdx = process.argv.indexOf("--label");
const label = labelIdx > -1 ? process.argv[labelIdx + 1] : "";
const questions: Question[] = JSON.parse(readFileSync(join(import.meta.dirname, "questions.json"), "utf8"));

const rows = questions.map((q) => {
  const res = searchKnowledge(q.question, { limit: K });
  const ids = res.results.map((r) => r.id);
  const rank = ids.findIndex((id) => q.expected.some((e) => id.startsWith(e))) + 1; // 0 = miss
  const violations = ids.filter((id) => q.mustNotInclude?.some((bad) => id.startsWith(bad)));
  return {
    id: q.id,
    type: q.type,
    rank,
    hit1: rank === 1,
    hitK: rank > 0,
    rr: rank > 0 ? 1 / rank : 0,
    tokens: res.tokensReturned,
    violations,
    top: ids.slice(0, 3),
  };
});

const n = rows.length;
const summary = {
  label,
  date: new Date().toISOString(),
  questions: n,
  [`recall@${K}`]: +(rows.filter((r) => r.hitK).length / n).toFixed(3),
  "hit@1": +(rows.filter((r) => r.hit1).length / n).toFixed(3),
  mrr: +(rows.reduce((s, r) => s + r.rr, 0) / n).toFixed(3),
  avgTokensReturned: Math.round(rows.reduce((s, r) => s + r.tokens, 0) / n),
  outdatedLeaks: rows.reduce((s, r) => s + r.violations.length, 0),
};

console.log("\n  rank  tokens  type        question");
for (const r of rows) {
  const mark = r.rank === 1 ? "✓" : r.rank > 0 ? "~" : "✗";
  console.log(`  ${mark} ${String(r.rank || "-").padEnd(3)} ${String(r.tokens).padStart(6)}  ${r.type.padEnd(10)}  ${r.id}`);
  if (!r.hitK) console.log(`        got: ${r.top.join(", ")}`);
  if (r.violations.length) console.log(`        ⚠ outdated in results: ${r.violations.join(", ")}`);
}
console.log("\n", summary, "\n");

const outDir = join(import.meta.dirname, "results");
mkdirSync(outDir, { recursive: true });
const file = join(outDir, `${summary.date.slice(0, 19).replace(/[:T]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ summary, rows }, null, 2));
console.log(`Saved ${file}`);

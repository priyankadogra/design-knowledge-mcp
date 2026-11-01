/**
 * Try retrieval without an MCP client.
 *
 *   npm run search -- "how long should toasts stay on screen"
 *   npm run search -- --component cta
 *   npm run search -- --doc "carbon/components/button/usage#button-sizes"
 *   npm run search -- --sources
 */
import { getComponent, getDocument, listSources, searchKnowledge } from "../src/knowledge.js";

const [flag, ...rest] = process.argv.slice(2);
const arg = rest.join(" ");
const print = (x: unknown) => console.log(JSON.stringify(x, null, 2));

if (flag === "--component") print(getComponent(arg));
else if (flag === "--doc") print(getDocument(arg));
else if (flag === "--sources") print(listSources());
else if (flag) {
  const res = searchKnowledge([flag, ...rest].join(" "));
  for (const [i, r] of res.results.entries()) {
    console.log(`\n${i + 1}. [${r.score}] ${r.title} › ${r.section}`);
    console.log(`   ${r.team} · ${r.status} · ${r.scope}${r.appliesTo ? ` (${r.appliesTo})` : ""} · ${r.fullTokens} tok`);
    console.log(`   id: ${r.id}`);
    console.log(`   ${r.snippet}`);
  }
  if (res.notes.length) console.log(`\nNotes:\n- ${res.notes.join("\n- ")}`);
  console.log(`\n~${res.tokensReturned} tokens returned`);
} else {
  console.log('Usage: npm run search -- "<query>" | --component <name> | --doc <id> | --sources');
}

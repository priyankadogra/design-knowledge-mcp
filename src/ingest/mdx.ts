/**
 * Turns Carbon's MDX pages into plain markdown an index (and a model) can use.
 * Deliberately simple: line-based rules, no MDX parser. Good enough for docs
 * where JSX is mostly layout wrappers; revisit if quality evals say otherwise.
 */
export function cleanMdx(src: string): string {
  const out: string[] = [];
  let inExportBlock = false;
  let inFence = false;

  for (const raw of src.split("\n")) {
    let line = raw;

    if (line.trim().startsWith("```")) inFence = !inFence;
    if (inFence) {
      out.push(line);
      continue;
    }

    // Multi-line `export const x = {...}` and `import {...} from` blocks
    if (/^(import|export)\b/.test(line)) {
      inExportBlock = !/;\s*$/.test(line) && !/from\s+['"].+['"]\s*;?$/.test(line);
      continue;
    }
    if (inExportBlock) {
      if (/(;|from\s+['"].+['"];?)\s*$/.test(line) || /^}/.test(line)) inExportBlock = false;
      continue;
    }

    // Keep the text of Do/Don't captions; they carry real guidance
    const caption = line.match(/<DoDont[^>]*type="(do|dont)"[^>]*caption="([^"]+)"/);
    if (caption) {
      out.push(`- ${caption[1] === "do" ? "Do" : "Don't"}: ${caption[2].replace(/^(Do not|Don't|Don’t|Do)\s+/i, "")}`);
      continue;
    }

    // Images add nothing for text retrieval
    if (/^\s*!\[.*\]\(.*\)\s*$/.test(line)) continue;

    // <Title>Foo</Title> → bold line; <Caption>…</Caption> → plain text
    line = line.replace(/<Title>(.*?)<\/Title>/g, "**$1**");
    line = line.replace(/<\/?(Caption|PageDescription|AnchorLink|ListItem|UnorderedList)>/g, " ");

    // Lines that are only JSX tags (layout wrappers) are dropped
    if (/^\s*<\/?[A-Z][\w.]*[^>]*\/?>\s*$/.test(line)) continue;
    if (/^\s*<\/?[A-Z][\w.]*\s*$/.test(line)) continue; // multi-line tag opener
    if (/^\s*[\w-]+=(\{|").*$/.test(line) && !/[.!?]$/.test(line)) continue; // dangling props
    if (/^\s*\/?>\s*$/.test(line)) continue;

    line = line
      .replace(/&#123;/g, "{")
      .replace(/&#125;/g, "}")
      .replace(/\s{2,}/g, " ")
      .trimEnd();

    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

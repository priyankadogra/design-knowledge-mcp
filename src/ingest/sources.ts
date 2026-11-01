import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import matter from "gray-matter";
import type { Doc, DocType, Scope, Status } from "../types.js";
import { cleanMdx } from "./mdx.js";

export const ROOT = process.env.DKM_ROOT ?? process.cwd();
const VENDOR = join(ROOT, "corpus", "vendor");
const SYNTHETIC = join(ROOT, "corpus", "synthetic");

const titleCase = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p, ext);
    return p.endsWith(ext) ? [p] : [];
  });
}

/** IBM Carbon: one doc per component tab (usage / style / code / accessibility). */
function loadCarbon(): Doc[] {
  const dir = join(VENDOR, "carbon", "src", "pages", "components");
  return walk(dir, ".mdx").map((file) => {
    const { data, content } = matter(readFileSync(file, "utf8"));
    const component = basename(join(file, ".."));
    const tab = basename(file, ".mdx");
    const title = `${data.title ?? titleCase(component)} — ${titleCase(tab)}`;
    return {
      id: `carbon/components/${component}/${tab}`,
      title,
      source: "carbon",
      team: "Design System (Carbon)",
      scope: "canonical",
      status: "current",
      docType: tab === "code" ? "spec" : "guideline",
      components: [component],
      path: relative(ROOT, file),
      body: cleanMdx(content),
    };
  });
}

/** GitHub Primer: architecture decision records with real status fields. */
function loadPrimerAdrs(): Doc[] {
  const dir = join(VENDOR, "primer", "contributor-docs", "adrs");
  return walk(dir, ".md")
    .filter((f) => !f.includes("template"))
    .map((file) => {
      const raw = readFileSync(file, "utf8");
      const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(file, ".md");
      const statusBlock = raw.split(/^## Status/m)[1]?.split(/^## /m)[0] ?? "";
      const superseded = statusBlock.match(/Superseded by \[[^\]]*\]\(([^)]+)\)/);
      return {
        id: `primer/adrs/${basename(file, ".md")}`,
        title: `Primer ADR: ${title}`,
        source: "primer",
        team: "Design System Engineering (Primer)",
        scope: "canonical",
        status: parseAdrStatus(statusBlock),
        docType: "decision",
        components: [],
        supersededBy: superseded
          ? `primer/adrs/${basename(superseded[1], ".md")}`
          : undefined,
        path: relative(ROOT, file),
        body: raw.replace(/<!--[\s\S]*?-->/g, "").trim(),
      };
    });
}

function parseAdrStatus(block: string): Status {
  const statusRow = block.match(/^\|\s*Status\s*\|(.*)\|/im)?.[1] ?? block;
  if (/Superseded/i.test(statusRow)) return "superseded";
  if (/Deprecated/i.test(statusRow)) return "deprecated";
  if (/Proposed/i.test(statusRow)) return "proposed";
  if (/Accepted|Approved|Adopted|✅/i.test(statusRow)) return "current";
  return "unknown";
}

/** Synthetic team docs: metadata comes from frontmatter. */
function loadSynthetic(): Doc[] {
  return walk(SYNTHETIC, ".md").map((file) => {
    const { data, content } = matter(readFileSync(file, "utf8"));
    const rel = relative(SYNTHETIC, file).replace(/\.md$/, "");
    return {
      id: `synthetic/${rel}`,
      title: data.title ?? titleCase(basename(rel)),
      source: "synthetic",
      team: data.team ?? "Unknown",
      scope: (data.scope as Scope) ?? "team-local",
      status: (data.status as Status) ?? "unknown",
      docType: (data.docType as DocType) ?? "guideline",
      components: String(data.component ?? "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean),
      updated: data.updated ? String(data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : data.updated) : undefined,
      appliesTo: data.appliesTo,
      supersededBy: data.supersededBy,
      path: relative(ROOT, file),
      body: content.trim(),
    };
  });
}

export function loadAllDocs(): Doc[] {
  return [...loadCarbon(), ...loadPrimerAdrs(), ...loadSynthetic()];
}

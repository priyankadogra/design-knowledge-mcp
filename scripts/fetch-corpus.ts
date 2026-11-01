/**
 * Fetches third-party design-system sources into corpus/vendor/.
 *
 * Nothing fetched here is committed (see .gitignore). Each source keeps its own
 * license; we only download what the index needs (markdown + JSON, no images).
 *
 *   npm run fetch-corpus            # fetch everything
 *   npm run fetch-corpus -- carbon  # fetch one source
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VENDOR_DIR = join(process.cwd(), "corpus", "vendor");

interface VendorSource {
  id: string;
  repo: string;
  license: string;
  /** Non-cone sparse-checkout patterns: only these files are downloaded. */
  patterns: string[];
}

const SOURCES: VendorSource[] = [
  {
    id: "carbon",
    repo: "https://github.com/carbon-design-system/carbon-website.git",
    license: "Apache-2.0",
    // Component guidance: usage / style / code / accessibility .mdx per component
    patterns: ["/src/pages/components/*/*.mdx", "/LICENSE"],
  },
  {
    id: "spectrum",
    repo: "https://github.com/adobe/spectrum-design-data.git",
    license: "Apache-2.0",
    // Structured data: design tokens + component API schemas
    patterns: [
      "/packages/tokens/src/*.json",
      "/docs/site/public/schemas/components/*.json",
      "/LICENSE",
    ],
  },
  {
    id: "primer",
    repo: "https://github.com/primer/react.git",
    license: "MIT",
    // Architecture decision records: real decisions with status fields
    patterns: ["/contributor-docs/adrs/*.md", "/LICENSE"],
  },
];

function git(args: string[], cwd?: string) {
  execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "inherit"] });
}

function fetchSource(src: VendorSource) {
  const dest = join(VENDOR_DIR, src.id);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });

  console.log(`→ ${src.id}: cloning ${src.repo}`);
  git(["clone", "--depth", "1", "--filter=blob:none", "--no-checkout", src.repo, dest]);
  git(["sparse-checkout", "init", "--no-cone"], dest);
  git(["sparse-checkout", "set", "--no-cone", ...src.patterns], dest);
  git(["checkout"], dest);

  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dest }).toString().trim();
  writeFileSync(
    join(dest, ".source.json"),
    JSON.stringify(
      { id: src.id, repo: src.repo, license: src.license, commit, fetchedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(`  ✓ ${src.id} @ ${commit.slice(0, 7)}`);
}

const only = process.argv.slice(2);
mkdirSync(VENDOR_DIR, { recursive: true });
for (const src of SOURCES) {
  if (only.length && !only.includes(src.id)) continue;
  fetchSource(src);
}
console.log("Done. Sources are in corpus/vendor/ (git-ignored).");

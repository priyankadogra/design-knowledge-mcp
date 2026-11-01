/**
 * Structured lookup layer: exact facts (component API, design tokens) come from
 * JSON, not from fuzzy search. Backed by Adobe Spectrum's open design data.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../ingest/sources.js";

const SPECTRUM = join(ROOT, "corpus", "vendor", "spectrum");
const SCHEMA_DIR = join(SPECTRUM, "docs", "site", "public", "schemas", "components");
const TOKEN_DIR = join(SPECTRUM, "packages", "tokens", "src");

export interface ComponentSpec {
  name: string;
  title: string;
  description?: string;
  category?: string;
  documentationUrl?: string;
  /** Props with their allowed values and defaults, flattened for readability. */
  props: Record<string, { type?: string; values?: unknown[]; default?: unknown; description?: string }>;
  tokens: Record<string, unknown>;
  tokenCount: number;
}

let tokenCache: Record<string, Record<string, any>> | null = null;

function allTokens() {
  if (tokenCache) return tokenCache;
  tokenCache = {};
  if (!existsSync(TOKEN_DIR)) return tokenCache;
  for (const f of readdirSync(TOKEN_DIR).filter((f) => f.endsWith(".json"))) {
    tokenCache[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(TOKEN_DIR, f), "utf8"));
  }
  return tokenCache;
}

export function listSpectrumComponents(): string[] {
  if (!existsSync(SCHEMA_DIR)) return [];
  return readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/** Simplify a token's value: keep the raw value or the per-mode values. */
function simplifyToken(t: any): unknown {
  if (t.value !== undefined) return t.value;
  if (t.sets) {
    return Object.fromEntries(
      Object.entries(t.sets).map(([mode, v]: [string, any]) => [mode, v.value ?? simplifyToken(v)]),
    );
  }
  return t;
}

export function getSpectrumComponent(name: string, maxTokens = 40): ComponentSpec | null {
  const file = join(SCHEMA_DIR, `${name}.json`);
  if (!existsSync(file)) return null;
  const schema = JSON.parse(readFileSync(file, "utf8"));

  const props: ComponentSpec["props"] = {};
  for (const [key, p] of Object.entries<any>(schema.properties ?? {})) {
    props[key] = {
      type: p.type,
      values: p.enum,
      default: p.default,
      description: p.description,
    };
  }

  // Tokens: anything tagged with this component, or named with its prefix
  const tokens: Record<string, unknown> = {};
  let count = 0;
  for (const group of Object.values(allTokens())) {
    for (const [tokenName, t] of Object.entries<any>(group)) {
      if (t.component === name || tokenName.startsWith(`${name}-`)) {
        count++;
        if (Object.keys(tokens).length < maxTokens) tokens[tokenName] = simplifyToken(t);
      }
    }
  }

  return {
    name,
    title: schema.title ?? name,
    description: schema.description,
    category: schema.meta?.category,
    documentationUrl: schema.meta?.documentationUrl,
    props,
    tokens,
    tokenCount: count,
  };
}

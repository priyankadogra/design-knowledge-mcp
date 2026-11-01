/**
 * The knowledge layer. Everything the MCP tools, CLI, and evals call lives here,
 * so retrieval can be tested without an MCP client.
 *
 * Retrieval is staged like a search ranking pipeline:
 *   L0  candidate generation  — BM25 over chunk text + contextual header (top 50)
 *   L1  metadata ranking      — status / scope / component boosts, outdated filtered
 *   L2  reranking             — TODO (milestone 2): reranker over the top ~20
 *   Final shaping             — per-doc diversity cap, snippets, token budget, notes
 */
import { chunkDoc, estimateTokens } from "./ingest/chunk.js";
import { loadAllDocs } from "./ingest/sources.js";
import { getSpectrumComponent, listSpectrumComponents } from "./lookup/spectrum.js";
import { Bm25Index } from "./search/bm25.js";
import { COMPONENT_ALIASES, expandQuery } from "./search/synonyms.js";
import type { Chunk, Doc, Status } from "./types.js";

interface KnowledgeBase {
  docs: Map<string, Doc>;
  chunks: Map<string, Chunk>;
  index: Bm25Index;
}

let kb: KnowledgeBase | null = null;

export function getKnowledgeBase(): KnowledgeBase {
  if (kb) return kb;
  const docs = new Map(loadAllDocs().map((d) => [d.id, d]));
  const chunks = new Map<string, Chunk>();
  const index = new Bm25Index();

  for (const doc of docs.values()) {
    for (const c of chunkDoc(doc)) {
      chunks.set(c.id, c);
      // Heading path is repeated so section titles weigh more than body text
      index.add(c.id, `${c.contextHeader}\n${c.headingPath.join(" ")}\n${c.headingPath.join(" ")}\n${c.text}`);
    }
  }
  index.finalize();
  kb = { docs, chunks, index };
  return kb;
}

// ---------------------------------------------------------------------------
// search_knowledge
// ---------------------------------------------------------------------------

export interface SearchOptions {
  limit?: number;
  component?: string;
  source?: string;
  docType?: string;
  includeOutdated?: boolean;
  /** Stop adding results once their snippets would exceed this budget. */
  tokenBudget?: number;
}

export interface SearchResult {
  id: string;
  docId: string;
  title: string;
  section: string;
  team: string;
  status: Status;
  scope: string;
  appliesTo?: string;
  updated?: string;
  snippet: string;
  /** Estimated tokens to fetch the full section with get_document. */
  fullTokens: number;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  notes: string[];
  hiddenOutdated: number;
  tokensReturned: number;
}

const STATUS_WEIGHT: Record<Status, number> = {
  current: 1,
  unknown: 0.9,
  proposed: 0.8,
  superseded: 0.5,
  deprecated: 0.4,
};

export function searchKnowledge(query: string, opts: SearchOptions = {}): SearchResponse {
  const { chunks, index } = getKnowledgeBase();
  const limit = opts.limit ?? 5;
  const budget = opts.tokenBudget ?? 1500;
  const component = opts.component ? normalizeComponent(opts.component) : undefined;

  // L0: candidates
  const candidates = index.search(expandQuery(query), 50);

  // L1: filters + metadata boosts
  let hiddenOutdated = 0;
  const ranked: { chunk: Chunk; score: number }[] = [];
  for (const { id, score } of candidates) {
    const chunk = chunks.get(id)!;
    const m = chunk.meta;
    if (opts.source && m.source !== opts.source) continue;
    if (opts.docType && m.docType !== opts.docType) continue;
    if (component && !m.components.includes(component)) continue;
    const outdated = m.status === "superseded" || m.status === "deprecated";
    if (outdated && !opts.includeOutdated) {
      hiddenOutdated++;
      continue;
    }
    let s = score * STATUS_WEIGHT[m.status];
    if (m.scope === "canonical") s *= 1.1;
    ranked.push({ chunk, score: s });
  }
  ranked.sort((a, b) => b.score - a.score);

  // L2: rerank — not implemented yet (see roadmap in CLAUDE.md)

  // Final shaping: at most 2 sections per doc, snippets, token budget
  const perDoc = new Map<string, number>();
  const results: SearchResult[] = [];
  let tokensReturned = 0;
  for (const { chunk, score } of ranked) {
    if (results.length >= limit) break;
    const n = perDoc.get(chunk.docId) ?? 0;
    if (n >= 2) continue;
    const snippet = makeSnippet(chunk.text, query);
    const cost = estimateTokens(snippet) + 40; // + metadata overhead
    if (results.length > 0 && tokensReturned + cost > budget) break;
    perDoc.set(chunk.docId, n + 1);
    tokensReturned += cost;
    const m = chunk.meta;
    results.push({
      id: chunk.id,
      docId: chunk.docId,
      title: m.title,
      section: chunk.headingPath.slice(1).join(" › ") || "Intro",
      team: m.team,
      status: m.status,
      scope: m.scope,
      appliesTo: m.appliesTo,
      updated: m.updated,
      snippet,
      fullTokens: chunk.tokens,
      score: Math.round(score * 100) / 100,
    });
  }

  return { results, notes: buildNotes(results, hiddenOutdated), hiddenOutdated, tokensReturned };
}

/** Pick the ~280-char window with the most query-term hits. */
function makeSnippet(text: string, query: string, size = 280): string {
  const clean = text.replace(/\|[-\s|]+\|/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= size) return clean;
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < clean.length - size; i += 40) {
    const win = clean.slice(i, i + size).toLowerCase();
    const s = terms.reduce((acc, t) => acc + (win.includes(t) ? 1 : 0), 0);
    if (s > bestScore) [best, bestScore] = [i, s];
  }
  return (best > 0 ? "…" : "") + clean.slice(best, best + size).trim() + "…";
}

/** Surface what an agent needs to reason about: overrides and hidden history. */
function buildNotes(results: SearchResult[], hiddenOutdated: number): string[] {
  const notes: string[] = [];
  const local = results.filter((r) => r.scope === "team-local");
  const hasCanonical = results.some((r) => r.scope === "canonical");
  for (const r of local) {
    notes.push(
      `"${r.title}" is a team-local override by ${r.team}${r.appliesTo ? ` (applies to: ${r.appliesTo})` : ""}. ` +
        (hasCanonical ? "Prefer canonical guidance unless the question is about that team's product." : ""),
    );
  }
  if (hiddenOutdated > 0) {
    notes.push(`${hiddenOutdated} superseded or deprecated sections were hidden. Pass includeOutdated: true to see them.`);
  }
  return notes;
}

// ---------------------------------------------------------------------------
// get_document
// ---------------------------------------------------------------------------

export function getDocument(id: string) {
  const { docs, chunks } = getKnowledgeBase();
  const chunk = chunks.get(id);
  if (chunk) {
    return {
      kind: "section" as const,
      id: chunk.id,
      docId: chunk.docId,
      header: chunk.contextHeader,
      text: chunk.text,
      tokens: chunk.tokens,
    };
  }
  const doc = docs.get(id);
  if (!doc) return null;
  const { body, ...meta } = doc;
  return { kind: "document" as const, ...meta, text: body, tokens: estimateTokens(body) };
}

// ---------------------------------------------------------------------------
// get_component
// ---------------------------------------------------------------------------

export function normalizeComponent(name: string): string {
  const n = name.toLowerCase().trim().replace(/\s+/g, " ");
  return COMPONENT_ALIASES[n] ?? n.replace(/\s+/g, "-");
}

export function getComponent(name: string) {
  const { docs } = getKnowledgeBase();
  const component = normalizeComponent(name);
  // Spectrum names some components differently (Carbon "notification" ≈ Spectrum "toast")
  const spectrumName =
    { notification: "toast", "text-input": "text-field", dropdown: "picker", modal: "standard-dialog" }[component] ??
    component;
  const spec = getSpectrumComponent(spectrumName);

  const related = [...docs.values()]
    .filter((d) => d.components.includes(component))
    .map((d) => ({
      id: d.id,
      title: d.title,
      team: d.team,
      scope: d.scope,
      status: d.status,
      appliesTo: d.appliesTo,
      tokens: estimateTokens(d.body),
    }))
    .sort((a, b) => Number(b.scope === "canonical") - Number(a.scope === "canonical"));

  if (!spec && related.length === 0) return null;
  return {
    component,
    spec: spec
      ? { source: "Spectrum design data (component API + design tokens)", ...spec }
      : null,
    guidance: related,
  };
}

// ---------------------------------------------------------------------------
// list_sources
// ---------------------------------------------------------------------------

export function listSources() {
  const { docs, chunks } = getKnowledgeBase();
  const bySource = new Map<string, { teams: Set<string>; docs: number; statuses: Record<string, number> }>();
  for (const d of docs.values()) {
    const s = bySource.get(d.source) ?? { teams: new Set(), docs: 0, statuses: {} };
    s.teams.add(d.team);
    s.docs++;
    s.statuses[d.status] = (s.statuses[d.status] ?? 0) + 1;
    bySource.set(d.source, s);
  }
  return {
    sources: [...bySource.entries()].map(([source, s]) => ({
      source,
      teams: [...s.teams],
      documents: s.docs,
      statuses: s.statuses,
    })),
    totalChunks: chunks.size,
    structuredComponents: listSpectrumComponents().length,
  };
}

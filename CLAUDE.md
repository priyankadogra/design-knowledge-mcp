# Design Knowledge MCP — project context

Read this first. It carries over the planning done before this repo existed.

## What this is

A portfolio project by Priya: an MCP server that gives agents reliable,
token-efficient context from scattered design-system knowledge. The real-world
problem: design orgs end up with dozens of team-local knowledge repos and AI
tools that drift apart (Nubank's "NuBrain" job posting describes exactly this).
The project is deliberately general, not company-specific.

The interesting part is **context architecture**, not RAG plumbing:
- fix content with metadata (status, scope, team, date) and precedence rules
- make chunks self-explanatory (contextual header prepended before indexing)
- route knowledge to the right layer: always-on (skill) vs structured lookup
  (`get_component`) vs semantic search (`search_knowledge`)
- control what reaches the agent: snippets first, token budgets, diversity,
  surfacing overrides and hidden outdated content in `notes`
- measure with evals and categorize every failure

Retrieval is framed as a multi-stage ranking pipeline (L0 candidates → L1
metadata ranking → L2 rerank). Priya saw this pattern in LinkedIn search but did
not work on ranking there; this project is where she builds it hands-on. Don't
overclaim prior ranking experience in any write-up.

## Stack and conventions

- TypeScript (ESM, NodeNext), Node ≥ 20, run with `tsx`
- `@modelcontextprotocol/sdk` (`McpServer.registerTool`), `zod` for input schemas
- No database yet; everything is indexed in memory at startup (~2k sections)
- The stdio server must never write to stdout — use `console.error` or the logger
- Core logic lives in `src/knowledge.ts` so evals and the CLI can call it
  without an MCP client. Keep tools in `src/server.ts` thin.

## Layout

```
src/server.ts           MCP tools: search_knowledge, get_document, get_component, list_sources
src/knowledge.ts        index build + staged retrieval + lookups
src/ingest/             source loaders (carbon mdx, primer ADRs, synthetic md), mdx cleaner, heading chunker
src/search/             bm25 (L0), synonyms / component aliases
src/lookup/spectrum.ts  structured component API + tokens (Adobe Spectrum)
src/log.ts              JSONL tool-call logging → logs/tool-calls.jsonl
corpus/synthetic/       hand-written team docs with deliberate conflicts (committed)
corpus/vendor/          fetched by scripts/fetch-corpus.ts (git-ignored)
evals/                  questions.json, run.ts, results/ (commit results)
.claude/skills/         skill-only baseline for the skill-vs-MCP comparison
```

Sources stand in for different teams: Carbon = canonical guidelines, Spectrum =
structured component data, Primer = decision records, synthetic = team overrides,
stale docs, research, decision log.

## Commands

```
npm run fetch-corpus     # clone sources into corpus/vendor (needed once)
npm run search -- "query" | --component cta | --doc <id> | --sources
npm run eval -- --label "what changed"
npm run typecheck
npm run dev              # run the MCP server on stdio
```

## Current state (baseline, 2026-11-01)

recall@5 0.857 · hit@1 0.571 · MRR 0.696 · ~519 tokens per search · 0 outdated leaks

Known failures to work on first (good write-up material — categorize each):
1. `button-label-case` — misses; generic "typography"/"title" chunks outrank the
   button label section. Likely fix: component inference from the query (boost
   chunks whose component appears in the query).
2. `when-to-use-modal` — the "When to use" section exists but ranks below
   related-patterns/anatomy. Probably heading-match weighting.
3. Padding queries rank the button structure section well but never surface the
   Lending 12px override — decide whether they *should* (it's team-local).

## Roadmap

1. **Skill vs MCP comparison** — answer the eval questions with the skill
   baseline in Claude Code, record tokens and correctness, compare. Write it up.
2. **Fix the known failures**, re-run evals after each change, commit results.
3. **Hybrid search** — add embeddings next to BM25 (local SQLite or simple
   vectors on disk), fuse with reciprocal rank fusion.
4. **L2 rerank** over top ~20, measure lift vs latency/cost per stage.
5. **`find_conflicts(topic)`** tool for explicit canonicalization.
6. **Log analysis script** — zero-result queries, search→get_document follow-ups,
   tokens per answered question.
7. **Remote deployment** — Streamable HTTP transport + auth, so Figma Make can
   connect as a custom connector (requires a public HTTPS URL).
8. README write-up: problem, architecture, trade-offs, metrics chart per stage,
   2-minute demo video (designer in Claude + Claude Code building to spec).

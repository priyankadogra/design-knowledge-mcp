# Design Knowledge MCP

An MCP server that gives AI agents reliable, token-efficient context from
scattered design-system knowledge: guidelines, component specs, decision
records, research, and team-specific overrides that often disagree.

> Status: early. Baseline retrieval and evals work; hybrid search, reranking,
> and remote deployment are next. See [CLAUDE.md](CLAUDE.md) for the roadmap.

## The problem

Design organizations accumulate knowledge in many places. Once teams start
building their own AI tools, each one gets its own copy, and the copies drift.
An agent can't tell that a 2023 team doc was replaced by a 2026 decision, or
that a spacing override applies to one app only. It answers confidently
anyway.

This project treats that as a **context architecture** problem: what reaches
the agent, in what shape, with what provenance, at what token cost.

## How it works

| Layer | Tool | For |
|---|---|---|
| Structured lookup | `get_component` | Exact facts: component API, variants, sizes, design tokens, plus every team's guidance doc for that component |
| Semantic search | `search_knowledge` | Open-ended questions: guidance, rationale, decisions, research |
| Progressive disclosure | `get_document` | Full section only when a snippet isn't enough |
| Orientation | `list_sources` | What the knowledge base covers |

Search runs as a staged pipeline:

1. **L0 candidates** — BM25 over heading-based chunks, each prefixed with a
   contextual header (team, status, scope, date). Synonym expansion maps
   "CTA" / "big purple button" to "primary button".
2. **L1 metadata ranking** — superseded and deprecated content hidden by
   default; status and scope weighting.
3. **L2 rerank** — planned.
4. **Shaping** — max two sections per document, snippets instead of full
   text, a token budget, and `notes` that flag team-local overrides and hidden
   outdated content.

Every tool call is logged to `logs/tool-calls.jsonl` with latency, result
count, and tokens returned.

## Corpus

Third-party sources are fetched at build time, not committed:

- **IBM Carbon** (Apache-2.0): component usage, style, and accessibility guidelines
- **Adobe Spectrum design data** (Apache-2.0): component API schemas and design tokens
- **GitHub Primer** (MIT): architecture decision records with real status fields

On top of these, `corpus/synthetic/` contains a small fictional org (Lending,
Credit Card, Brand, Research Ops, Design Ops) with deliberate mess: a
team-local override, a deprecated doc, informal research language, and a
decision log that supersedes earlier guidance.

## Getting started

```bash
npm install
npm run fetch-corpus
npm run search -- "how long should toasts stay on screen"
npm run eval
```

### Use it in Claude Code

The repo includes `.mcp.json`, so opening the folder in Claude Code offers to
enable the `design-knowledge` server. Then ask things like:

- "What padding should primary buttons have, and does any team override it?"
- "Should payment confirmation toasts auto-dismiss?"

### Use it in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "design-knowledge": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/design-knowledge-mcp/src/server.ts"],
      "env": { "DKM_ROOT": "/absolute/path/to/design-knowledge-mcp" }
    }
  }
}
```

## Evals

`evals/questions.json` holds questions with known correct sections, tagged by
type (fact, synonym, conflict, freshness, decision, research).
`npm run eval` reports recall@5, hit@1, MRR, tokens per search, and outdated
content leaking into results. Results are saved to `evals/results/` so changes
can be compared over time.

| Run | recall@5 | hit@1 | MRR | tokens/search | outdated leaks |
|---|---|---|---|---|---|
| Baseline (BM25 + metadata) | 0.857 | 0.571 | 0.696 | 519 | 0 |

## License

MIT for this project's code and synthetic content. Fetched sources keep their
own licenses.

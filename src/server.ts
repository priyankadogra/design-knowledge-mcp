#!/usr/bin/env node
/**
 * Design Knowledge MCP server (stdio).
 *
 * Tools are designed for progressive disclosure: search returns short snippets
 * with token costs, and the agent fetches full sections only when it needs them.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { estimateTokens } from "./ingest/chunk.js";
import { getComponent, getDocument, getKnowledgeBase, listSources, searchKnowledge } from "./knowledge.js";
import { logToolCall } from "./log.js";

const server = new McpServer({ name: "design-knowledge", version: "0.1.0" });

/** Wrap a handler with timing, logging, and JSON text output. */
function tool<A>(name: string, fn: (args: A) => { data: unknown; resultCount?: number }) {
  return async (args: A) => {
    const start = Date.now();
    try {
      const { data, resultCount } = fn(args);
      const text = JSON.stringify(data, null, 2);
      logToolCall({ tool: name, args, ms: Date.now() - start, resultCount, tokensReturned: estimateTokens(text) });
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logToolCall({ tool: name, args, ms: Date.now() - start, error: message });
      return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
    }
  };
}

server.registerTool(
  "search_knowledge",
  {
    title: "Search design knowledge",
    description:
      "Search design guidelines, decisions, and research across all teams. Returns short ranked snippets " +
      "with source, team, status, scope, and the token cost of fetching each full section. " +
      "Use for open-ended questions (why, when, guidance, past decisions, research findings). " +
      "For exact component specs or tokens, use get_component instead. " +
      "Read the `notes` field: it flags team-local overrides and hidden outdated content.",
    inputSchema: {
      query: z.string().describe("Natural-language question or keywords"),
      component: z.string().optional().describe("Restrict to one component, e.g. 'button', 'notification'"),
      docType: z.enum(["guideline", "decision", "research", "spec"]).optional(),
      limit: z.number().int().min(1).max(10).optional().describe("Max results (default 5)"),
      includeOutdated: z
        .boolean()
        .optional()
        .describe("Include superseded/deprecated content (default false). Use for history questions."),
    },
  },
  tool("search_knowledge", (args: {
    query: string;
    component?: string;
    docType?: string;
    limit?: number;
    includeOutdated?: boolean;
  }) => {
    const res = searchKnowledge(args.query, args);
    return { data: res, resultCount: res.results.length };
  }),
);

server.registerTool(
  "get_document",
  {
    title: "Get a document or section",
    description:
      "Fetch the full text of a section (id from search_knowledge results, contains '#') or a whole document " +
      "(docId). Prefer section ids: whole documents can be thousands of tokens.",
    inputSchema: {
      id: z.string().describe("Section id like 'carbon/components/button/usage#button-sizes' or a document id"),
    },
  },
  tool("get_document", ({ id }: { id: string }) => {
    const doc = getDocument(id);
    if (!doc) throw new Error(`No document or section with id "${id}". Use search_knowledge to find ids.`);
    return { data: doc, resultCount: 1 };
  }),
);

server.registerTool(
  "get_component",
  {
    title: "Get component spec",
    description:
      "Exact, structured lookup for a component: its API (variants, sizes, props, defaults), design tokens, " +
      "and a list of guidance documents from every team (canonical first, with team-local overrides marked). " +
      "Accepts common aliases like 'CTA', 'dialog', 'text field'.",
    inputSchema: {
      name: z.string().describe("Component name, e.g. 'button', 'notification', 'modal'"),
    },
  },
  tool("get_component", ({ name }: { name: string }) => {
    const c = getComponent(name);
    if (!c) throw new Error(`Unknown component "${name}". Try search_knowledge instead.`);
    return { data: c, resultCount: 1 };
  }),
);

server.registerTool(
  "list_sources",
  {
    title: "List knowledge sources",
    description: "Which sources and teams the knowledge base covers, with document counts and status breakdown.",
    inputSchema: {},
  },
  tool("list_sources", () => ({ data: listSources() })),
);

async function main() {
  const t = Date.now();
  const { docs, chunks } = getKnowledgeBase();
  console.error(`[design-knowledge] indexed ${docs.size} docs / ${chunks.size} sections in ${Date.now() - t}ms`);
  if (docs.size === 0) console.error("[design-knowledge] corpus is empty — run `npm run fetch-corpus` first");
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

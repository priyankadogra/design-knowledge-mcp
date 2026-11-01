/**
 * Instrumentation from day one. Every tool call is appended to
 * logs/tool-calls.jsonl. Never write to stdout: the stdio MCP transport uses it.
 *
 * Useful signals to analyze later:
 *  - queries with zero results            → content gaps
 *  - search followed by get_document      → snippet wasn't enough (or was useful)
 *  - tokensReturned per call              → context cost
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./ingest/sources.js";

const LOG_DIR = join(ROOT, "logs");
const LOG_FILE = join(LOG_DIR, "tool-calls.jsonl");
const SESSION = Math.random().toString(36).slice(2, 10);

export interface ToolLog {
  tool: string;
  args: unknown;
  ms: number;
  resultCount?: number;
  tokensReturned?: number;
  error?: string;
}

export function logToolCall(entry: ToolLog) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), session: SESSION, ...entry }) + "\n");
  } catch (err) {
    console.error("[log] failed to write tool log:", err);
  }
}

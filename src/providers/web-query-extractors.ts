import { uniqueStrings } from "./search-execution.js";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function collectStringField(target: string[], value: unknown): void {
  if (typeof value === "string" && value.trim()) target.push(value.trim());
}

function collectQueriesFromObject(target: string[], value: unknown): void {
  const obj = asObject(value);
  if (!obj) return;
  collectStringField(target, obj.query);
  collectStringField(target, obj.search_query);
  const action = asObject(obj.action);
  collectStringField(target, action?.query);
  const input = asObject(obj.input);
  collectStringField(target, input?.query);
}

export function extractResponseWebQueries(raw: unknown): string[] {
  const root = asObject(raw);
  const output = Array.isArray(root?.output) ? root.output : [];
  const queries: string[] = [];
  for (const item of output) collectQueriesFromObject(queries, item);
  return uniqueStrings(queries);
}

export function extractAnthropicWebQueries(raw: unknown): string[] {
  const root = asObject(raw);
  const content = Array.isArray(root?.content) ? root.content : [];
  const queries: string[] = [];
  for (const part of content) collectQueriesFromObject(queries, part);
  return uniqueStrings(queries);
}

export function extractGeminiWebQueries(raw: unknown): string[] {
  const root = asObject(raw);
  const candidates = Array.isArray(root?.candidates) ? root.candidates : [];
  const queries: string[] = [];
  for (const candidate of candidates) {
    const metadata = asObject(asObject(candidate)?.groundingMetadata);
    const webSearchQueries = Array.isArray(metadata?.webSearchQueries) ? metadata.webSearchQueries : [];
    for (const query of webSearchQueries) collectStringField(queries, query);
  }
  return uniqueStrings(queries);
}

export function extractPerplexityWebQueries(raw: unknown): string[] {
  const root = asObject(raw);
  const searchResults = Array.isArray(root?.search_results) ? root.search_results : [];
  const queries: string[] = [];
  for (const result of searchResults) collectQueriesFromObject(queries, result);
  return uniqueStrings(queries);
}

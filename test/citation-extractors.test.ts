import test from "node:test";
import assert from "node:assert/strict";
import type { Citation, CitationSource } from "../src/core/types.js";
import { dedupeCitations } from "../src/providers/citation-extractors.js";

function citation(url: string, source: CitationSource, index: number): Citation {
  return {
    id: `${source}-${index}-${url}`,
    url,
    domain: new URL(url).hostname,
    citationIndex: index,
    source,
    citationType: "unknown",
  };
}

test("dedupeCitations keeps one entry per URL across sources, preferring the native provider citation", () => {
  const provider = citation("https://example.dev/docs", "provider_annotation", 0);
  const answerText = citation("https://example.dev/docs", "answer_text_url", 1);
  const result = dedupeCitations([provider, answerText]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.source, "provider_annotation");
});

test("dedupeCitations reindexes the surviving citations in order", () => {
  const first = citation("https://example.dev/a", "provider_annotation", 0);
  const duplicate = citation("https://example.dev/a", "answer_text_url", 1);
  const second = citation("https://example.dev/b", "answer_text_url", 2);
  const result = dedupeCitations([first, duplicate, second]);
  assert.deepEqual(
    result.map((c) => [c.url, c.citationIndex]),
    [
      ["https://example.dev/a", 0],
      ["https://example.dev/b", 1],
    ],
  );
});

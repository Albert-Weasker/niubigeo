import test from "node:test";
import assert from "node:assert/strict";
import { dedupeCitations } from "../src/providers/citation-extractors.js";

test("deduplicates the same URL across citation sources", () => {
  const citations = dedupeCitations([
    {
      id: "native",
      url: "https://example.com/docs",
      domain: "example.com",
      citationIndex: 0,
      source: "provider_annotation",
      citationType: "unknown",
    },
    {
      id: "text",
      url: "https://example.com/docs",
      domain: "example.com",
      citationIndex: 1,
      source: "answer_text_url",
      citationType: "unknown",
    },
  ]);

  assert.equal(citations.length, 1);
  assert.equal(citations[0]?.source, "provider_annotation");
  assert.equal(citations[0]?.citationIndex, 0);
});

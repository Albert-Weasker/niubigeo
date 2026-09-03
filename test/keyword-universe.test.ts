import test from "node:test";
import assert from "node:assert/strict";
import type { SiteEvidence } from "../src/core/types.js";
import { KeywordUniverseBuilder } from "../src/keywords/keyword-universe.js";
import { KeywordRelevanceScorer } from "../src/keywords/keyword-relevance.js";
import { KeywordPromptPlanner } from "../src/prompts/keyword-prompt-planner.js";
import { entityFromInput } from "../src/utils/domain.js";

const siteEvidence: SiteEvidence = {
  submittedDomain: "www.example.dev",
  canonicalDomain: "example.dev",
  pages: [
    {
      url: "https://www.example.dev/",
      title: "ExampleDev | AI agent audit trails",
      description: "Open-source tools for AI agent audit trails, token usage evidence, and execution verification.",
      metaKeywords: ["AI agent audit", "token usage evidence"],
      headings: ["Verify what coding agents actually did"],
      ogTitle: "ExampleDev AI agent audit",
      ogDescription: "Audit trails for AI coding agents.",
      twitterTitle: undefined,
      twitterDescription: undefined,
      jsonLdKeywords: ["agent observability"],
      jsonLdNames: ["ExampleDev"],
      jsonLdDescriptions: ["Evidence-backed AI agent auditing"],
      textSnippet: "ExampleDev records agent execution evidence and token usage evidence for engineering teams.",
    },
  ],
  sitemapUrls: ["https://www.example.dev/ai-agent-audit-trails"],
  collectedAt: "2026-09-03T00:00:00.000Z",
};

test("keeps user keywords first and scores owned-site relevance from site evidence", () => {
  const universe = new KeywordUniverseBuilder().build({
    siteEvidence,
    userKeywords: ["AI agent audit", "unmentioned buyer keyword"],
    language: "en",
    mode: "site_plus_user",
    limit: 1,
  });

  assert.equal(universe.keywords.length, 2);
  assert.deepEqual(
    universe.keywords.map((keyword) => keyword.phrase),
    ["AI agent audit", "unmentioned buyer keyword"],
  );
  assert.ok(universe.keywords.every((keyword) => keyword.userDefined));

  const relevance = new KeywordRelevanceScorer().score({ keywords: universe.keywords, siteEvidence });
  const aiAgentAudit = relevance.find((row) => row.keywordId === universe.keywords[0]?.id);
  const unmentioned = relevance.find((row) => row.keywordId === universe.keywords[1]?.id);
  assert.ok(aiAgentAudit);
  assert.ok(unmentioned);
  assert.ok(aiAgentAudit.score > unmentioned.score);
  assert.ok(aiAgentAudit.evidenceCount > 0);
  assert.equal(unmentioned.evidenceCount, 0);
});

test("builds keyword prompts that remain traceable to keyword ids", () => {
  const target = entityFromInput({ type: "target", domain: "www.example.dev", name: "ExampleDev" });
  const competitor = entityFromInput({ type: "competitor", domain: "other.dev", name: "OtherDev" });
  const universe = new KeywordUniverseBuilder().build({
    siteEvidence,
    userKeywords: ["AI agent audit"],
    language: "en",
    mode: "site_plus_user",
    limit: 3,
  });
  const prompts = new KeywordPromptPlanner().build({
    target,
    competitors: [competitor],
    keywords: universe.keywords,
    language: "en",
    promptsPerKeyword: 2,
  });

  assert.ok(prompts.length >= 2);
  for (const keyword of universe.keywords) {
    assert.ok(prompts.some((prompt) => prompt.keywordIds?.includes(keyword.id)), `missing prompts for ${keyword.phrase}`);
  }
  assert.ok(prompts.some((prompt) => prompt.targetIncluded === false));
  assert.ok(prompts.every((prompt) => prompt.keywordIntent));
  assert.ok(prompts.every((prompt) => prompt.seedSource));
});

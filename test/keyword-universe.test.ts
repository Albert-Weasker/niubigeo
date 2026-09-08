import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput, SiteEvidence } from "../src/core/types.js";
import { KeywordAnalyzer } from "../src/keywords/keyword-analyzer.js";
import { parseGeneratedPrompts } from "../src/prompts/prompt-generator.js";
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

class KeywordAnalysisProvider implements AnswerProvider {
  readonly definition: ProviderDefinition = {
    id: "test",
    label: "Test",
    sourceType: "api",
    envKeys: [],
    defaultModels: ["test-model"],
    supportsAnyModel: true,
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: "test",
  };

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    assert.equal(input.prompt.includes("Evidence catalog"), true);
    const output = {
      keywords: [
        { phrase: "AI agent audit", userSeedId: "user-keyword-1", relevance: 0.96, evidenceIds: ["evidence-1", "evidence-3"] },
        { phrase: "unmentioned buyer keyword", userSeedId: "user-keyword-2", relevance: 0.08, evidenceIds: [] },
        { phrase: "agent observability", relevance: 0.91, evidenceIds: ["evidence-8"] },
      ],
    };
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: "Source: Test API",
      resultCaveat: "test",
      model: input.model,
      modelVersion: input.model,
      text: JSON.stringify(output),
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: new Date().toISOString(),
    };
  }
}

async function analyzedKeywords() {
  return new KeywordAnalyzer().analyze({
    target: entityFromInput({ type: "target", domain: "www.example.dev", name: "ExampleDev" }),
    siteEvidence,
    userKeywords: ["AI agent audit", "unmentioned buyer keyword"],
    language: "en",
    mode: "site_plus_user",
    limit: 3,
    provider: new KeywordAnalysisProvider(),
    model: "test-model",
    apiKey: "test-key",
  });
}

test("uses Provider judgments and verified site evidence for keyword relevance", async () => {
  const analyzed = await analyzedKeywords();
  assert.deepEqual(
    analyzed.keywords.map((keyword) => keyword.phrase),
    ["AI agent audit", "unmentioned buyer keyword", "agent observability"],
  );
  assert.equal(analyzed.keywords[0]?.userDefined, true);
  assert.equal(analyzed.keywords[2]?.userDefined, false);
  assert.equal(analyzed.relevance[0]?.score, 0.96);
  assert.equal(analyzed.relevance[1]?.score, 0.08);
  assert.equal(analyzed.relevance[1]?.evidenceCount, 0);
  assert.equal(analyzed.relevance[2]?.evidence[0]?.text, "agent observability");
});

test("validates provider-generated keyword prompts and preserves keyword lineage", async () => {
  const target = entityFromInput({ type: "target", domain: "www.example.dev", name: "ExampleDev" });
  const analyzed = await analyzedKeywords();
  const rows = analyzed.keywords.flatMap((keyword, index) => [
    {
      type: "keyword_category",
      topic: keyword.phrase,
      prompt: `Question ${index + 1} for ${keyword.phrase}`,
      auditCategory: "organic_discovery",
      targetIncluded: false,
      keywordIds: [keyword.id],
      keywordIntent: "category",
    },
    {
      type: "keyword_comparison",
      topic: keyword.phrase,
      prompt: `Comparison ${index + 1} for ${keyword.phrase}`,
      auditCategory: "comparison",
      targetIncluded: false,
      keywordIds: [keyword.id],
      keywordIntent: "comparison",
    },
  ]);
  const prompts = parseGeneratedPrompts(JSON.stringify(rows), target, "en", rows.length, analyzed.keywords);

  for (const keyword of analyzed.keywords) {
    assert.equal(prompts.some((prompt) => prompt.keywordIds?.includes(keyword.id)), true);
  }
  assert.equal(prompts.some((prompt) => prompt.targetIncluded === false), true);
  assert.equal(prompts.every((prompt) => Boolean(prompt.keywordIntent)), true);
  assert.equal(prompts.every((prompt) => Boolean(prompt.seedSource)), true);
});

test("rejects incomplete Provider analysis instead of inventing a missing user keyword", async () => {
  class IncompleteProvider extends KeywordAnalysisProvider {
    override async run(input: ProviderRunInput): Promise<AnswerResult> {
      const result = await super.run(input);
      const output = { keywords: [{ phrase: "AI agent audit", userSeedId: "user-keyword-1", relevance: 0.9, evidenceIds: ["evidence-1"] }] };
      return { ...result, text: JSON.stringify(output) };
    }
  }
  await assert.rejects(
    new KeywordAnalyzer().analyze({
      target: entityFromInput({ type: "target", domain: "www.example.dev", name: "ExampleDev" }),
      siteEvidence,
      userKeywords: ["AI agent audit", "unmentioned buyer keyword"],
      language: "en",
      mode: "site_plus_user",
      limit: 3,
      provider: new IncompleteProvider(),
      model: "test-model",
      apiKey: "test-key",
    }),
    (error) => error instanceof Error && error.message === "Keyword analyzer did not return every user keyword.",
  );
});

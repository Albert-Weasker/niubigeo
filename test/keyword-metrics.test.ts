import test from "node:test";
import assert from "node:assert/strict";
import type { KeywordCandidate, KeywordRelevance, Mention, MonitoringPrompt, PromptRun } from "../src/core/types.js";
import { MetricsEngine } from "../src/metrics/metrics-engine.js";
import { entityFromInput } from "../src/utils/domain.js";

const target = entityFromInput({ type: "target", domain: "example.dev", name: "ExampleDev" });
const competitor = entityFromInput({ type: "competitor", domain: "other.dev", name: "OtherDev" });
const keyword: KeywordCandidate = {
  id: "kw-ai-agent-audit-12345678",
  phrase: "AI agent audit",
  normalized: "ai agent audit",
  language: "en",
  source: "user",
  confidence: 0.95,
  enabled: true,
  userDefined: true,
};
const relevance: KeywordRelevance = {
  keywordId: keyword.id,
  score: 0.82,
  evidenceCount: 3,
  sourceBreakdown: { title: 1, description: 1, heading: 1 },
  evidence: [{ source: "title", url: "https://example.dev", text: "ExampleDev | AI agent audit trails" }],
};

function mention(entityType: "target" | "competitor", mentioned: boolean): Mention {
  const entity = entityType === "target" ? target : competitor;
  return {
    entityId: entity.id,
    entityName: entity.name,
    entityType,
    count: mentioned ? 1 : 0,
    firstPosition: mentioned ? (entityType === "target" ? 0 : 12) : null,
    rankPosition: mentioned ? (entityType === "target" ? 1 : 2) : null,
    mentionType: mentioned ? "recommendation" : "not_mentioned",
    sentiment: mentioned ? "positive" : "neutral",
    isMentioned: mentioned,
    isRecommendation: mentioned,
    isFirstPosition: entityType === "target" && mentioned,
    hasCitation: false,
    hasOfficialLink: false,
    context: mentioned ? `${entity.name} is relevant.` : null,
    paragraph: mentioned ? `${entity.name} is relevant.` : null,
  };
}

function keywordPrompt(id: string): MonitoringPrompt {
  return {
    id,
    type: "keyword_recommendation",
    topic: keyword.phrase,
    language: "en",
    text: "What are the best tools for AI agent audit?",
    enabled: true,
    targetIncluded: false,
    keywordIds: [keyword.id],
    keywordClusterId: `cluster-${keyword.id}`,
    keywordIntent: "recommendation",
    seedSource: "user_keyword",
  };
}

function run(id: string, targetMentioned: boolean, competitorMentioned: boolean, officialCitation: boolean): PromptRun {
  return {
    id,
    prompt: keywordPrompt(`p-${id}`),
    target,
    competitors: [competitor],
    providerId: "openrouter",
    model: "openai/gpt-4o-mini",
    webSearchEnabled: false,
    sourceType: "api",
    sourceLabel: "Source: OpenRouter API",
    status: "completed",
    startedAt: "2026-09-03T00:00:00.000Z",
    finishedAt: "2026-09-03T00:00:01.000Z",
    rawJsonPath: `/tmp/${id}.json`,
    analysis: {
      mentions: [mention("target", targetMentioned), mention("competitor", competitorMentioned)],
      citations: officialCitation
        ? [
            {
              id: `c-${id}`,
              url: "https://example.dev/",
              domain: "example.dev",
              citationIndex: 0,
              source: "answer_text_url",
              citationType: "target_official",
              entityId: target.id,
              entityName: target.name,
              promptId: `p-${id}`,
              runId: id,
            },
          ]
        : [],
    },
  };
}

test("computes keyword metrics from run analysis and carries keyword ids into prompt outcomes", () => {
  const metrics = new MetricsEngine().compute(
    [run("target-win", true, false, true), run("competitor-only", false, true, false)],
    { keywords: [keyword], keywordRelevance: [relevance] },
  );

  assert.equal(metrics.keywordSummary.totalKeywords, 1);
  assert.equal(metrics.keywordSummary.aiMentionRate.numerator, 1);
  assert.equal(metrics.keywordSummary.aiMentionRate.denominator, 1);
  assert.equal(metrics.promptOutcomes[0]?.keywordIds[0], keyword.id);
  assert.equal(metrics.promptOutcomes[0]?.keywordIntent, "recommendation");

  const keywordMetric = metrics.keywordMetrics[0];
  assert.ok(keywordMetric);
  assert.equal(keywordMetric.ownedRelevance, 0.82);
  assert.equal(keywordMetric.promptCount, 2);
  assert.equal(keywordMetric.mentionRate.numerator, 1);
  assert.equal(keywordMetric.mentionRate.denominator, 2);
  assert.equal(keywordMetric.citationRate.numerator, 1);
  assert.equal(keywordMetric.citationRate.denominator, 2);
  assert.equal(keywordMetric.competitorOnlyRate.numerator, 1);
  assert.equal(keywordMetric.competitorOnlyRate.denominator, 2);
  assert.equal(keywordMetric.topCompetitors[0]?.name, "OtherDev");
});

import test from "node:test";
import assert from "node:assert/strict";
import { MetricsEngine } from "../src/metrics/metrics-engine.js";
import type { PromptRun } from "../src/core/types.js";
import { entityFromInput } from "../src/utils/domain.js";

const target = entityFromInput({ type: "target", domain: "vercel.com", name: "Vercel" });
const competitor = entityFromInput({ type: "competitor", domain: "netlify.com", name: "Netlify" });

function baseRun(id: string): PromptRun {
  return {
    id,
    prompt: { id: `p-${id}`, type: "category", topic: "category", language: "en", text: "best frontend deployment tools", enabled: true },
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
    rawJsonPath: "/tmp/raw.json",
  };
}

test("uses completed responses as denominator and keeps citation separate", () => {
  const completed = baseRun("ok");
  completed.analysis = {
    mentions: [
      {
        entityId: target.id,
        entityName: target.name,
        entityType: "target",
        count: 1,
        firstPosition: 0,
        rankPosition: 1,
        mentionType: "recommendation",
        sentiment: "positive",
        isMentioned: true,
        isRecommendation: true,
        isFirstPosition: true,
        hasCitation: false,
        hasOfficialLink: false,
        context: "Vercel is recommended.",
        paragraph: "Vercel is recommended.",
      },
      {
        entityId: competitor.id,
        entityName: competitor.name,
        entityType: "competitor",
        count: 1,
        firstPosition: 24,
        rankPosition: 2,
        mentionType: "ordinary",
        sentiment: "neutral",
        isMentioned: true,
        isRecommendation: false,
        isFirstPosition: false,
        hasCitation: false,
        hasOfficialLink: false,
        context: "Netlify also appears.",
        paragraph: "Netlify also appears.",
      },
    ],
    citations: [],
  };
  const failed = { ...baseRun("bad"), status: "failed" as const, error: "provider error" };
  const metrics = new MetricsEngine().compute([completed, failed]);

  assert.equal(metrics.validResponses, 1);
  assert.equal(metrics.failedResponses, 1);
  assert.equal(metrics.mentionRate.numerator, 1);
  assert.equal(metrics.mentionRate.denominator, 1);
  assert.equal(metrics.citationRate.numerator, 0);
  assert.equal(metrics.citationRate.denominator, 1);
  assert.equal(metrics.shareOfVoice.numerator, 1);
  assert.equal(metrics.shareOfVoice.denominator, 2);

  const providerModelSlice = metrics.slices.find((slice) => slice.sliceType === "provider_model" && slice.key === "openrouter:openai/gpt-4o-mini");
  assert.ok(providerModelSlice);
  assert.equal(providerModelSlice.validResponses, 1);
  assert.equal(providerModelSlice.failedResponses, 1);
  assert.equal(providerModelSlice.mentionRate.numerator, 1);
  assert.equal(providerModelSlice.mentionRate.denominator, 1);

  const promptTypeSlice = metrics.slices.find((slice) => slice.sliceType === "prompt_type" && slice.key === "category");
  assert.ok(promptTypeSlice);
  assert.equal(promptTypeSlice.shareOfVoice.numerator, 1);
  assert.equal(promptTypeSlice.shareOfVoice.denominator, 2);

  const promptTargetingSlice = metrics.slices.find((slice) => slice.sliceType === "prompt_targeting" && slice.key === "branded_or_direct");
  assert.ok(promptTargetingSlice);
  assert.equal(promptTargetingSlice.validResponses, 1);
});

test("separates brand awareness from natural discovery", () => {
  const brandRun = baseRun("brand");
  brandRun.prompt = {
    ...brandRun.prompt,
    id: "p-brand",
    type: "brand",
    auditCategory: "brand_awareness",
    targetIncluded: true,
    text: "What is Vercel?",
  };
  brandRun.analysis = {
    mentions: [
      {
        entityId: target.id,
        entityName: target.name,
        entityType: "target",
        count: 1,
        firstPosition: 0,
        rankPosition: 1,
        mentionType: "ordinary",
        sentiment: "neutral",
        isMentioned: true,
        isRecommendation: false,
        isFirstPosition: true,
        hasCitation: false,
        hasOfficialLink: false,
        context: "Vercel is a deployment platform.",
        paragraph: "Vercel is a deployment platform.",
      },
    ],
    citations: [],
  };

  const organicRun = baseRun("organic");
  organicRun.prompt = {
    ...organicRun.prompt,
    id: "p-organic",
    type: "recommendation",
    auditCategory: "organic_discovery",
    targetIncluded: false,
    text: "What are the best frontend deployment platforms?",
  };
  organicRun.analysis = {
    mentions: [
      {
        entityId: target.id,
        entityName: target.name,
        entityType: "target",
        count: 0,
        firstPosition: null,
        rankPosition: null,
        mentionType: "not_mentioned",
        sentiment: "neutral",
        isMentioned: false,
        isRecommendation: false,
        isFirstPosition: false,
        hasCitation: false,
        hasOfficialLink: false,
        context: null,
        paragraph: null,
      },
      {
        entityId: competitor.id,
        entityName: competitor.name,
        entityType: "competitor",
        count: 1,
        firstPosition: 0,
        rankPosition: 1,
        mentionType: "recommendation",
        sentiment: "positive",
        isMentioned: true,
        isRecommendation: true,
        isFirstPosition: true,
        hasCitation: false,
        hasOfficialLink: false,
        context: "Netlify is recommended.",
        paragraph: "Netlify is recommended.",
      },
    ],
    citations: [],
  };

  const metrics = new MetricsEngine().compute([brandRun, organicRun]);

  assert.equal(metrics.brandAwarenessRate.numerator, 1);
  assert.equal(metrics.brandAwarenessRate.denominator, 1);
  assert.equal(metrics.naturalDiscoveryRate.numerator, 0);
  assert.equal(metrics.naturalDiscoveryRate.denominator, 1);
  assert.equal(metrics.organicRecommendationRate.numerator, 0);
  assert.equal(metrics.organicRecommendationRate.denominator, 1);
  assert.equal(metrics.shareOfVoice.numerator, 1);
  assert.equal(metrics.shareOfVoice.denominator, 2);
});

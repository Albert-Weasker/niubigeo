import test from "node:test";
import assert from "node:assert/strict";
import type { AuditRun, MonitoringPrompt, PromptRun } from "../src/core/types.js";
import type { IntentRunAnalysis } from "../src/intent/intent-schema.js";
import { GeoGapAnalyzer } from "../src/insights/gap-analyzer.js";
import { MetricsEngine } from "../src/metrics/metrics-engine.js";
import { entityFromInput } from "../src/utils/domain.js";

const target = entityFromInput({ type: "target", domain: "acme.example", name: "Acme" });

function prompt(): MonitoringPrompt {
  return {
    id: "p1",
    type: "recommendation",
    topic: "selection",
    language: "en",
    text: "Which option fits this requirement, and what sources support it?",
    enabled: true,
    auditCategory: "organic_discovery",
    targetIncluded: false,
  };
}

function intentAnalysis(): IntentRunAnalysis {
  return {
    schemaVersion: "intent-v2",
    status: "completed",
    promptIntent: {
      primaryIntent: "recommendation",
      secondaryIntents: ["source_analysis"],
      requestedOutputs: ["Recommend an option", "Provide supporting sources"],
      targetBrandRole: "not_mentioned",
      requiresSources: true,
      requiresComparison: false,
      requiresRecommendation: true,
      candidateApplicable: true,
      recommendationApplicable: true,
      uncertainty: "low",
    },
    tasks: [
      { id: "task_1", requirement: "Recommend an option", expectedAnswerType: "list_of_options" },
      { id: "task_2", requirement: "Provide supporting sources", expectedAnswerType: "source_list" },
    ],
    taskResults: [
      { taskId: "task_1", status: "completed", evidenceQuote: "Acme is one option.", explanation: "The answer names one option.", sourceUrls: [] },
      { taskId: "task_2", status: "missing", explanation: "No supporting source was provided.", sourceUrls: [] },
    ],
    entities: [],
    adaptedResult: {
      displayMode: "brand_question",
      oneSentence: "The answer recommends one option but does not provide a source.",
      userQuestion: "Which option fits this requirement, and what sources support it?",
      answered: ["An option was recommended."],
      missing: ["No supporting source was provided."],
      uncertain: [],
      entityInsights: [],
    },
    analyzer: { providerId: "openrouter", model: "test-model", sourceLabel: "Source: OpenRouter API" },
  };
}

function completedRun(): PromptRun {
  const promptRow = prompt();
  return {
    id: "r1",
    prompt: promptRow,
    target,
    competitors: [],
    providerId: "openrouter",
    model: "test-model",
    webSearchEnabled: false,
    sourceType: "api",
    sourceLabel: "Source: OpenRouter API",
    status: "completed",
    startedAt: "2026-09-03T00:00:00.000Z",
    finishedAt: "2026-09-03T00:00:01.000Z",
    result: {
      providerId: "openrouter",
      providerName: "OpenRouter",
      sourceType: "api",
      sourceLabel: "Source: OpenRouter API",
      resultCaveat: "Provider API result",
      model: "test-model",
      modelVersion: "test-model",
      text: "Acme is one option.",
      citations: [],
      webQueries: [],
      latencyMs: 10,
      createdAt: "2026-09-03T00:00:01.000Z",
    },
    analysis: { mentions: [], citations: [] },
    intentAnalysis: intentAnalysis(),
  };
}

test("reports only verifiable execution, task-completion, and source-evidence gaps", () => {
  const run = completedRun();
  const audit: AuditRun = {
    id: "audit-gap",
    target,
    competitors: [],
    prompts: [run.prompt],
    providerTargets: [{ providerId: "openrouter", model: "test-model" }],
    runs: [run],
    startedAt: "2026-09-03T00:00:00.000Z",
    finishedAt: "2026-09-03T00:00:02.000Z",
  };

  const gaps = new GeoGapAnalyzer().analyze(audit, new MetricsEngine().compute(audit.runs));
  const titles = gaps.findings.map((finding) => finding.title);

  assert.ok(titles.includes("The AI answer did not fully satisfy every requested task"));
  assert.ok(titles.includes("The question required sources but the provider returned none"));
  assert.equal(gaps.findings.some((finding) => finding.recommendation.includes("comparison page")), false);
  assert.equal(gaps.findings.some((finding) => finding.recommendation.includes("keyword")), false);
});

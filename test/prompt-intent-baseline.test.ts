import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  PROMPT_INTENT_SCHEMA_VERSION,
  type AnswerProvider,
  type AnswerResult,
  type Mention,
  type MonitoringPrompt,
  type PromptIntentProfile,
  type ProviderDefinition,
  type ProviderRunInput,
} from "../src/core/types.js";
import { MonitoringPromptIntentClassifier } from "../src/prompts/monitoring-prompt-intent-classifier.js";
import { entityFromInput } from "../src/utils/domain.js";
import { ProjectService } from "../src/projects/project-service.js";
import { BaselineBuilder } from "../src/baselines/baseline-builder.js";
import { RunOrchestrator } from "../src/monitoring/run-orchestrator.js";
import { ProjectFileStore } from "../src/projects/project-store.js";
import type { MonitoringBaseline } from "../src/baselines/baseline-schema.js";
import type { IntentRunAnalysis } from "../src/intent/intent-schema.js";
import { buildObservationAnalysisResult } from "../src/observations/analysis-qualification.js";
import { MonitoringMetricCalculator } from "../src/metrics/monitoring-metrics.js";
import type { Observation } from "../src/observations/observation-schema.js";

class IntentProfileProvider implements AnswerProvider {
  readonly definition: ProviderDefinition = {
    id: "intent-test",
    label: "Intent Test",
    sourceType: "api",
    envKeys: [],
    defaultModels: ["intent-model"],
    supportsJsonSchema: true,
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: "test",
  };
  calls = 0;

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    this.calls += 1;
    assert.equal(input.responseJsonSchema?.name, "monitoring_prompt_intents");
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: "Source: Intent Test API",
      resultCaveat: "test",
      model: input.model,
      modelVersion: input.model,
      text: JSON.stringify({
        questions: [
          {
            questionId: "question-b",
            intents: ["product_understanding"],
            candidateApplicable: false,
            recommendationApplicable: false,
            reason: "The question requests an explanation.",
          },
          {
            questionId: "question-a",
            intents: ["brand_evaluation", "purchase_decision"],
            candidateApplicable: true,
            recommendationApplicable: true,
            reason: "The question requests a suitability and choice judgment.",
          },
        ],
      }),
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: "2026-09-05T00:00:00.000Z",
    };
  }
}

function profile(input: {
  intents: PromptIntentProfile["intents"];
  candidateApplicable: boolean;
  recommendationApplicable: boolean;
}): PromptIntentProfile {
  return {
    schemaVersion: PROMPT_INTENT_SCHEMA_VERSION,
    intents: input.intents,
    candidateApplicable: input.candidateApplicable,
    recommendationApplicable: input.recommendationApplicable,
    reason: "Stable pre-run question classification.",
    analyzer: { providerId: "intent-test", model: "intent-model", sourceLabel: "Source: Intent Test API" },
    status: "completed",
  };
}

function question(id: string, text: string, intentProfile?: PromptIntentProfile): MonitoringPrompt {
  return {
    id,
    type: "brand",
    topic: "brand question",
    language: "en",
    text,
    enabled: true,
    auditCategory: "brand_awareness",
    targetIncluded: true,
    intentProfile,
  };
}

function answerIntent(primaryIntent: IntentRunAnalysis["promptIntent"]["primaryIntent"]): IntentRunAnalysis {
  return {
    schemaVersion: "intent-v2",
    promptIntent: {
      primaryIntent,
      secondaryIntents: [],
      requestedOutputs: ["Assess the product"],
      targetBrandRole: "candidate_to_evaluate",
      requiresSources: false,
      requiresComparison: false,
      requiresRecommendation: primaryIntent === "recommendation",
      candidateApplicable: true,
      recommendationApplicable: true,
      uncertainty: "low",
    },
    tasks: [{ id: "task-1", requirement: "Assess the product", expectedAnswerType: "brand_judgment" }],
    taskResults: [{ taskId: "task-1", status: "completed", evidenceQuote: "The product is considered.", explanation: "Answered", sourceUrls: [] }],
    entities: [],
    adaptedResult: {
      displayMode: "brand_question",
      oneSentence: "The product was assessed.",
      userQuestion: "Assess the product",
      answered: ["Assess the product"],
      missing: [],
      uncertain: [],
      entityInsights: [],
    },
    analyzer: { providerId: "intent-test", model: "intent-model", sourceLabel: "Source: Intent Test API" },
    status: "completed",
  };
}

function mention(): Mention {
  return {
    entityId: "target",
    entityName: "Example",
    entityType: "target",
    count: 1,
    firstPosition: 0,
    rankPosition: 1,
    mentionType: "list_appearance",
    sentiment: "neutral",
    isMentioned: true,
    isRecommendation: false,
    isFirstPosition: true,
    hasCitation: false,
    hasOfficialLink: false,
    context: "The product is considered.",
    paragraph: "The product is considered.",
  };
}

test("AI question intent profiles are joined by immutable question id, not response order", async () => {
  const provider = new IntentProfileProvider();
  const prompts = [
    question("question-a", "Should a team choose Example?"),
    question("question-b", "What does Example provide?"),
  ];
  const rows = await new MonitoringPromptIntentClassifier().classify({
    target: entityFromInput({ type: "target", domain: "example.com", name: "Example" }),
    language: "en",
    prompts,
    provider,
    model: "intent-model",
    apiKey: "test-key",
  });

  assert.equal(provider.calls, 1);
  assert.equal(rows[0]?.id, "question-a");
  assert.deepEqual(rows[0]?.intentProfile?.intents, ["brand_evaluation", "purchase_decision"]);
  assert.equal(rows[0]?.intentProfile?.candidateApplicable, true);
  assert.equal(rows[0]?.intentProfile?.recommendationApplicable, true);
  assert.equal(rows[1]?.id, "question-b");
  assert.deepEqual(rows[1]?.intentProfile?.intents, ["product_understanding"]);
  assert.equal(rows[1]?.intentProfile?.candidateApplicable, false);
  assert.equal(rows[1]?.intentProfile?.recommendationApplicable, false);
});

test("changing a fixed AI question intent profile creates a different comparable baseline", () => {
  const project = new ProjectService().create({
    target: entityFromInput({ type: "target", domain: "example.com", name: "Example" }),
    defaultLanguage: "en",
    now: "2026-09-05T00:00:00.000Z",
  });
  const base: MonitoringBaseline = {
    id: "source-baseline",
    projectId: project.id,
    name: "Monitoring baseline",
    prompts: [question("question-a", "Should a team choose Example?", profile({ intents: ["brand_evaluation"], candidateApplicable: true, recommendationApplicable: true }))],
    providerTargets: [{ providerId: "openrouter", model: "openai/gpt-4o-mini", webSearchEnabled: true }],
    language: "en",
    promptSetHash: "source",
    promptSetVersion: "v1",
    analysisRulesVersion: "v0.3",
    runCountPerPrompt: 1,
    entityScopeHash: "scope",
    comparableKey: "source-key",
    trendEligible: true,
    status: "active",
    source: "audit_plan",
    autoDiscover: false,
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
  };
  const changedPrompts = [question("question-a", "Should a team choose Example?", profile({ intents: ["brand_evaluation"], candidateApplicable: true, recommendationApplicable: false }))];
  const changed = new BaselineBuilder().derive(project, base, { prompts: changedPrompts });

  assert.notEqual(changed.id, base.id);
  assert.notEqual(changed.comparableKey, base.comparableKey);
  assert.equal(changed.sourceBaselineId, base.id);
});

test("a baseline without a pre-run intent profile may proceed to the answer provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-intent-baseline-"));
  try {
    const store = new ProjectFileStore(root);
    const project = new ProjectService().create({
      target: entityFromInput({ type: "target", domain: "example.com", name: "Example" }),
      defaultLanguage: "en",
      now: "2026-09-05T00:00:00.000Z",
    });
    const baseline: MonitoringBaseline = {
      id: "baseline-without-intent-profile",
      projectId: project.id,
      name: "Legacy baseline",
      prompts: [question("question-a", "Should a team choose Example?")],
      providerTargets: [{ providerId: "openrouter", model: "openai/gpt-4o-mini", webSearchEnabled: true }],
      language: "en",
      promptSetHash: "legacy",
      promptSetVersion: "v1",
      analysisRulesVersion: "v0.3",
      runCountPerPrompt: 1,
      entityScopeHash: "scope",
      comparableKey: "legacy-key",
      trendEligible: false,
      status: "active",
      source: "audit_plan",
      autoDiscover: false,
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
    };
    await store.saveProject(project);
    await store.saveBaseline(baseline);
    let answerProviderCalls = 0;
    const orchestrator = new RunOrchestrator(store, {
      async run() {
        answerProviderCalls += 1;
        throw new Error("provider reached");
      },
    });
    await assert.rejects(
      orchestrator.runBaseline({ project, baseline }),
      (error) => error instanceof Error && error.message === "provider reached",
    );
    assert.equal(answerProviderCalls, 1);
    assert.equal((await store.listRuns(project.id)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fixed question applicability keeps metric denominators stable when answer intent varies", () => {
  const stableProfile = profile({
    intents: ["brand_evaluation", "purchase_decision"],
    candidateApplicable: true,
    recommendationApplicable: true,
  });
  const mentions = [mention()];
  const first = buildObservationAnalysisResult({
    status: "completed",
    answerText: "The product is considered.",
    analysis: { mentions, citations: [] },
    intentAnalysis: answerIntent("brand_evaluation"),
    promptIntent: stableProfile,
    mentions,
    citations: [],
  });
  const second = buildObservationAnalysisResult({
    status: "completed",
    answerText: "The product is considered.",
    analysis: { mentions, citations: [] },
    intentAnalysis: answerIntent("recommendation"),
    promptIntent: stableProfile,
    mentions,
    citations: [],
  });
  const row = (id: string, result: ReturnType<typeof buildObservationAnalysisResult>): Observation => ({
    id,
    projectId: "project-example",
    baselineId: "baseline-example",
    runId: `run-${id}`,
    auditRunId: `audit-${id}`,
    promptId: "question-a",
    sampleIndex: 1,
    sampleCount: 1,
    promptText: "Should a team choose Example?",
    promptType: "brand",
    promptAuditCategory: "brand_awareness",
    targetIncluded: true,
    promptIntent: stableProfile,
    keywordIds: [],
    providerId: "openrouter",
    model: "openai/gpt-4o-mini",
    language: "en",
    sourceType: "api",
    sourceLabel: "OpenRouter API",
    webSearchEnabled: false,
    status: "completed",
    startedAt: "2026-09-05T00:00:00.000Z",
    finishedAt: "2026-09-05T00:00:01.000Z",
    answerText: "The product is considered.",
    citations: [],
    mentions,
    analysis: { mentions, citations: [] },
    intentAnalysis: id === "first" ? answerIntent("brand_evaluation") : answerIntent("recommendation"),
    ...result,
    evidence: {
      hasAnswer: true,
      targetMentioned: true,
      mentionedCompetitors: [],
      citationCount: 0,
      officialCitationCount: 0,
    },
  });
  const calculator = new MonitoringMetricCalculator();
  const firstCandidate = calculator.calculate("candidate_inclusion", [row("first", first)]);
  const secondCandidate = calculator.calculate("candidate_inclusion", [row("second", second)]);
  const firstRecommendation = calculator.calculate("explicit_recommendation", [row("first", first)]);
  const secondRecommendation = calculator.calculate("explicit_recommendation", [row("second", second)]);

  assert.equal(firstCandidate.denominator, 1);
  assert.equal(secondCandidate.denominator, 1);
  assert.equal(firstRecommendation.denominator, 1);
  assert.equal(secondRecommendation.denominator, 1);
});

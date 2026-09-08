import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  PROMPT_INTENT_SCHEMA_VERSION,
  type Mention,
  type PromptIntentProfile,
  type PromptRunAnalysis,
} from "../src/core/types.js";
import type { IntentRunAnalysis } from "../src/intent/intent-schema.js";
import type { ProjectRunRecord } from "../src/monitoring/monitoring-task-schema.js";
import {
  buildObservationAnalysisResult,
  buildRunAnalysisCoverage,
} from "../src/observations/analysis-qualification.js";
import { ObservationReanalysisService, type ObservationAnalysisEngine } from "../src/observations/observation-reanalysis-service.js";
import type { Observation } from "../src/observations/observation-schema.js";
import { ProjectFileStore } from "../src/projects/project-store.js";
import type { MonitoringProject } from "../src/projects/project-schema.js";
import { OBSERVATION_ANALYSIS_VERSION } from "../src/core/version.js";
import type { MonitoringBaseline } from "../src/baselines/baseline-schema.js";

function targetMention(mentioned: boolean, recommended = false): Mention {
  return {
    entityId: "target",
    entityName: "Example",
    entityType: "target",
    count: mentioned ? 1 : 0,
    firstPosition: mentioned ? 0 : null,
    rankPosition: mentioned ? 1 : null,
    mentionType: recommended ? "recommendation" : mentioned ? "ordinary" : "not_mentioned",
    sentiment: "neutral",
    isMentioned: mentioned,
    isRecommendation: recommended,
    isFirstPosition: mentioned,
    hasCitation: false,
    hasOfficialLink: false,
    context: mentioned ? "Example appears." : null,
    paragraph: mentioned ? "Example appears." : null,
  };
}

function intent(
  primaryIntent: IntentRunAnalysis["promptIntent"]["primaryIntent"],
  candidateApplicable: boolean,
  recommendationApplicable: boolean,
): IntentRunAnalysis {
  return {
    schemaVersion: "intent-v2",
    promptIntent: {
      primaryIntent,
      secondaryIntents: [],
      requestedOutputs: ["Assess the target"],
      targetBrandRole: "subject",
      requiresSources: false,
      requiresComparison: primaryIntent === "comparison",
      requiresRecommendation: primaryIntent === "recommendation",
      candidateApplicable,
      recommendationApplicable,
      uncertainty: "low",
    },
    tasks: [{ id: "task-1", requirement: "Assess the target", expectedAnswerType: "brand_judgment" }],
    taskResults: [{ taskId: "task-1", status: "completed", evidenceQuote: "Example appears.", explanation: "Answered", sourceUrls: [] }],
    entities: [],
    adaptedResult: {
      displayMode: "brand_question",
      oneSentence: "The target was assessed.",
      userQuestion: "Assess Example",
      answered: ["Assess the target"],
      missing: [],
      uncertain: [],
      entityInsights: [],
    },
    analyzer: { providerId: "provider", model: "model", sourceLabel: "Provider API" },
    status: "completed",
  };
}

function promptIntent(input: {
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
    analyzer: { providerId: "provider", model: "model", sourceLabel: "Provider API" },
    status: "completed",
  };
}

function observation(input: {
  id: string;
  intentAnalysis?: IntentRunAnalysis | undefined;
  mention?: Mention | undefined;
  runId?: string | undefined;
  promptIntent?: PromptIntentProfile | undefined;
}): Observation {
  const mentions = [input.mention || targetMention(false)];
  const analysis: PromptRunAnalysis = { mentions, citations: [] };
  const row: Observation = {
    id: input.id,
    projectId: "project-example",
    baselineId: "baseline-example",
    runId: input.runId || "run-example",
    auditRunId: "audit-example",
    promptId: `prompt-${input.id}`,
    sampleIndex: 1,
    sampleCount: 1,
    promptText: "Assess Example",
    promptType: "brand",
    promptAuditCategory: "brand_awareness",
    targetIncluded: true,
    keywordIds: [],
    providerId: "openrouter",
    model: "model",
    language: "en",
    sourceType: "api",
    sourceLabel: "OpenRouter API",
    webSearchEnabled: false,
    status: "completed",
    startedAt: "2026-09-05T00:00:00.000Z",
    finishedAt: "2026-09-05T00:00:01.000Z",
    answerText: "Example appears.",
    citations: [],
    mentions,
    analysis,
    intentAnalysis: input.intentAnalysis,
    promptIntent: input.promptIntent,
    evidence: {
      hasAnswer: true,
      targetMentioned: Boolean(input.mention?.isMentioned),
      mentionedCompetitors: [],
      citationCount: 0,
      officialCitationCount: 0,
    },
  };
  return row;
}

test("analysis qualification preserves false, not applicable, and missing as different states", () => {
  const facts = observation({
    id: "facts",
    intentAnalysis: intent("product_understanding", false, false),
    promptIntent: promptIntent({ intents: ["product_understanding"], candidateApplicable: false, recommendationApplicable: false }),
    mention: targetMention(true),
  });
  const factResult = buildObservationAnalysisResult({
    status: facts.status,
    answerText: facts.answerText,
    analysis: facts.analysis,
    intentAnalysis: facts.intentAnalysis,
    promptIntent: facts.promptIntent,
    mentions: facts.mentions,
    citations: facts.citations,
  });
  assert.equal(factResult.analysisResult.brandMentioned, true);
  assert.equal(factResult.analysisResult.brandCandidate, "not_applicable");
  assert.equal(factResult.analysisResult.brandRecommended, "not_applicable");

  const recommendation = observation({
    id: "recommendation",
    intentAnalysis: intent("recommendation", true, true),
    promptIntent: promptIntent({ intents: ["recommendation", "brand_evaluation"], candidateApplicable: true, recommendationApplicable: true }),
  });
  const recommendationResult = buildObservationAnalysisResult({
    status: recommendation.status,
    answerText: recommendation.answerText,
    analysis: recommendation.analysis,
    intentAnalysis: recommendation.intentAnalysis,
    promptIntent: recommendation.promptIntent,
    mentions: recommendation.mentions,
    citations: recommendation.citations,
  });
  assert.equal(recommendationResult.analysisResult.brandCandidate, false);
  assert.equal(recommendationResult.analysisResult.brandRecommended, false);

  const missing = observation({ id: "missing" });
  const missingResult = buildObservationAnalysisResult({
    status: missing.status,
    answerText: missing.answerText,
    analysis: missing.analysis,
    intentAnalysis: missing.intentAnalysis,
    promptIntent: missing.promptIntent,
    mentions: missing.mentions,
    citations: missing.citations,
  });
  assert.equal(missingResult.analysisStatus, "incomplete");
  assert.equal(missingResult.analysisResult.brandCandidate, null);
  assert.equal(missingResult.analysisResult.brandRecommended, null);
});

test("a provider-complete legacy observation is reported as analysis-incomplete", () => {
  const legacy = observation({
    id: "legacy",
    intentAnalysis: intent("recommendation", true, true),
    promptIntent: promptIntent({ intents: ["recommendation"], candidateApplicable: true, recommendationApplicable: true }),
  });
  const coverage = buildRunAnalysisCoverage([legacy]);
  assert.equal(coverage.version, null);
  assert.equal(coverage.status, "incomplete");
  assert.equal(coverage.answeredObservationCount, 1);
  assert.equal(coverage.completedAnalysisCount, 0);
  assert.deepEqual(coverage.incompleteObservationIds, [legacy.id]);
});

test("saved answers can be reanalyzed without rerunning the answer provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-reanalysis-"));
  try {
    const store = new ProjectFileStore(root);
    const project: MonitoringProject = {
      id: "project-example",
      name: "Example",
      domain: "example.com",
      aliases: [],
      target: { id: "target", type: "target", name: "Example", domain: "example.com", aliases: [] },
      competitors: [],
      defaultLanguage: "en",
      status: "active",
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
    };
    const run: ProjectRunRecord = {
      id: "run-example",
      projectId: project.id,
      baselineId: "baseline-example",
      status: "completed",
      plannedObservationCount: 1,
      completedObservationCount: 1,
      failedObservationCount: 0,
      comparableKey: "conditions",
      trendEligible: true,
      startedAt: "2026-09-05T00:00:00.000Z",
      finishedAt: "2026-09-05T00:00:01.000Z",
      createdAt: "2026-09-05T00:00:01.000Z",
    };
    await store.saveProject(project);
    const baseline: MonitoringBaseline = {
      id: "baseline-example",
      projectId: project.id,
      name: "Example baseline",
      prompts: [],
      providerTargets: [],
      language: "en",
      promptSetHash: "prompt-set",
      promptSetVersion: "v1",
      analysisRulesVersion: "v0.3",
      runCountPerPrompt: 1,
      entityScopeHash: "entities",
      comparableKey: "conditions",
      trendEligible: true,
      status: "active",
      source: "audit_run",
      autoDiscover: false,
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
    };
    await store.saveBaseline(baseline);
    await store.saveRun(run);
    await store.saveObservations(project.id, run.id, [observation({
      id: "stored",
      runId: run.id,
      promptIntent: promptIntent({ intents: ["recommendation"], candidateApplicable: true, recommendationApplicable: true }),
    })]);
    let analysisCalls = 0;
    const engine: ObservationAnalysisEngine = {
      async analyze() {
        analysisCalls += 1;
        const mentions = [targetMention(false)];
        return { analysis: { mentions, citations: [] }, intentAnalysis: intent("recommendation", true, true) };
      },
    };
    const result = await new ObservationReanalysisService(store, engine).reanalyze(project.id, run.id);
    assert.equal(analysisCalls, 1);
    assert.equal(result.run.analysisVersion, OBSERVATION_ANALYSIS_VERSION);
    assert.equal(result.run.analysisStatus, "completed");
    assert.equal(result.run.analysisCompletedObservationCount, 1);
    assert.equal(result.observations[0]?.analysisResult?.brandCandidate, false);
    assert.equal(result.observations[0]?.analysisResult?.brandRecommended, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

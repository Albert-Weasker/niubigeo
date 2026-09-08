import test from "node:test";
import assert from "node:assert/strict";
import {
  PROMPT_INTENT_SCHEMA_VERSION,
  type Citation,
  type BrandQuestionIntent,
  type Mention,
  type PromptIntentProfile,
} from "../src/core/types.js";
import type { IntentRunAnalysis } from "../src/intent/intent-schema.js";
import { MonitoringMetricCalculator } from "../src/metrics/monitoring-metrics.js";
import type { ProjectRunRecord } from "../src/monitoring/monitoring-task-schema.js";
import type { Observation } from "../src/observations/observation-schema.js";
import { EvidenceChangeBuilder } from "../src/changes/evidence-change-builder.js";
import { MetricSeriesBuilder } from "../src/timeseries/metric-series-builder.js";
import { BrandComparisonSeriesBuilder } from "../src/timeseries/brand-comparison-series.js";
import { buildObservationAnalysisResult } from "../src/observations/analysis-qualification.js";
import { OBSERVATION_ANALYSIS_VERSION } from "../src/core/version.js";

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
      requestedOutputs: ["Answer the question"],
      targetBrandRole: "not_mentioned",
      requiresSources: false,
      requiresComparison: primaryIntent === "comparison",
      requiresRecommendation: primaryIntent === "recommendation",
      candidateApplicable,
      recommendationApplicable,
      uncertainty: "low",
    },
    tasks: [{ id: "task-1", requirement: "Answer the question", expectedAnswerType: "other" }],
    taskResults: [{ taskId: "task-1", status: "completed", evidenceQuote: "Evidence", explanation: "Complete", sourceUrls: [] }],
    entities: [],
    adaptedResult: {
      displayMode: "task_completion",
      oneSentence: "The answer completed the request.",
      userQuestion: "Question",
      answered: ["Answer the question"],
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

function targetMention(kind: Mention["mentionType"], recommended: boolean): Mention {
  return {
    entityId: "target",
    entityName: "Example",
    entityType: "target",
    count: 1,
    firstPosition: 0,
    rankPosition: 1,
    mentionType: kind,
    sentiment: "neutral",
    isMentioned: true,
    isRecommendation: recommended,
    isFirstPosition: true,
    hasCitation: false,
    hasOfficialLink: false,
    context: "Evidence",
    paragraph: "Evidence",
  };
}

function citation(url = "https://example.com/docs"): Citation {
  return {
    id: url,
    url,
    domain: "example.com",
    citationIndex: 0,
    source: "provider_annotation",
    citationType: "target_official",
  };
}

function observation(input: {
  id: string;
  runId?: string;
  category?: Observation["promptAuditCategory"];
  intentName?: BrandQuestionIntent;
  mention?: Mention;
  citations?: Citation[];
  searchUsed?: boolean;
  status?: Observation["status"];
  competitorNames?: string[];
  candidateApplicable?: boolean;
  recommendationApplicable?: boolean;
}): Observation {
  const mentions = input.mention ? [input.mention] : [];
  const citations = input.citations || [];
  const status = input.status || "completed";
  const intentName = input.intentName || "recommendation";
  const stableIntent = promptIntent({
    intents: [intentName],
    candidateApplicable: input.candidateApplicable ?? intentName !== "product_understanding",
    recommendationApplicable: input.recommendationApplicable ?? intentName === "recommendation",
  });
  const row: Observation = {
    id: input.id,
    projectId: "project",
    baselineId: "baseline",
    runId: input.runId || "run",
    auditRunId: input.runId || "run",
    promptId: `prompt-${input.id}`,
    sampleIndex: 1,
    sampleCount: 1,
    promptText: `Question ${input.id}`,
    promptType: "recommendation",
    promptAuditCategory: input.category || "organic_discovery",
    targetIncluded: false,
    keywordIds: [],
    providerId: "provider",
    model: "model",
    language: "en",
    sourceType: "api",
    sourceLabel: "Provider API",
    webSearchEnabled: input.searchUsed === true,
    search: {
      requested: input.searchUsed === true,
      requestMode: "auto",
      used: input.searchUsed === true,
      usedMode: input.searchUsed === true ? "provider_native" : "none",
      endpointKind: "official_api",
      endpointProtocol: "responses",
      endpointUrl: "https://provider.example/api",
      webQueries: [],
      citationCount: citations.length,
    },
    status,
    startedAt: "2026-09-04T00:00:00.000Z",
    finishedAt: "2026-09-04T00:00:01.000Z",
    answerText: status === "completed" ? "Evidence" : undefined,
    citations,
    mentions,
    analysis: { mentions, citations },
    intentAnalysis: intent(
      intentName,
      stableIntent.candidateApplicable,
      stableIntent.recommendationApplicable,
    ),
    promptIntent: stableIntent,
    evidence: {
      hasAnswer: status === "completed",
      targetMentioned: mentions.length > 0,
      mentionedCompetitors: input.competitorNames || [],
      citationCount: citations.length,
      officialCitationCount: citations.length,
    },
  };
  return {
    ...row,
    ...buildObservationAnalysisResult({
      status: row.status,
      answerText: row.answerText,
      analysis: row.analysis,
      intentAnalysis: row.intentAnalysis,
      promptIntent: row.promptIntent,
      mentions: row.mentions,
      citations: row.citations,
    }),
  };
}

function run(input: {
  id: string;
  finishedAt: string;
  status?: ProjectRunRecord["status"];
  planned?: number;
  completed?: number;
  failed?: number;
  baselineId?: string;
}): ProjectRunRecord {
  const planned = input.planned || 1;
  const completed = input.completed === undefined ? planned : input.completed;
  const failed = input.failed || 0;
  const analyzed = completed;
  return {
    id: input.id,
    projectId: "project",
    baselineId: input.baselineId || "baseline",
    status: input.status || "completed",
    plannedObservationCount: planned,
    completedObservationCount: completed,
    failedObservationCount: failed,
    comparableKey: "same",
    trendEligible: true,
    analysisVersion: OBSERVATION_ANALYSIS_VERSION,
    analysisStatus: "completed",
    analysisCompletedObservationCount: completed,
    analysisIncompleteObservationCount: 0,
    analysisCoverage: {
      version: OBSERVATION_ANALYSIS_VERSION,
      status: "completed",
      observationCount: analyzed,
      answeredObservationCount: analyzed,
      completedAnalysisCount: analyzed,
      incompleteAnalysisCount: 0,
      failedAnalysisCount: 0,
      intentCounts: { recommendation: analyzed },
      questionIntentProfiledCount: analyzed,
      candidateApplicableCount: analyzed,
      candidateNotApplicableCount: 0,
      recommendationApplicableCount: analyzed,
      recommendationNotApplicableCount: 0,
      brandMentionJudgedCount: analyzed,
      entityExtractionCompletedCount: analyzed,
      citationParsingCompletedCount: analyzed,
      criticalNullCount: 0,
      criticalNullObservationIds: [],
      incompleteObservationIds: [],
    },
    startedAt: input.finishedAt,
    finishedAt: input.finishedAt,
    createdAt: input.finishedAt,
  };
}

test("monitoring metrics use separate evidence-backed denominators", () => {
  const rows = [
    observation({ id: "discovery", mention: targetMention("ordinary", false), intentName: "product_understanding" }),
    observation({ id: "candidate", category: "comparison", mention: targetMention("comparison", false), intentName: "comparison" }),
    observation({ id: "recommendation", category: "comparison", mention: targetMention("recommendation", true) }),
    observation({ id: "citation", category: "brand_awareness", citations: [citation()], searchUsed: true, intentName: "product_understanding" }),
    observation({ id: "offline-citation", citations: [citation("https://example.com/offline")], searchUsed: false }),
    observation({ id: "failed", status: "failed" }),
  ];
  const metrics = new MonitoringMetricCalculator();
  assert.deepEqual(metrics.calculate("brand_discovery", rows), {
    metricId: "brand_discovery",
    metricVersion: "monitoring-metrics-v2",
    numerator: 1,
    denominator: 2,
    value: 1 / 2,
    observationIds: ["discovery"],
    denominatorObservationIds: ["discovery", "offline-citation", "failed"].filter((id) => id !== "failed"),
    excludedObservationIds: ["candidate", "recommendation", "citation", "failed"],
    scope: {},
  });
  const candidate = metrics.calculate("candidate_inclusion", rows);
  assert.equal(candidate.numerator, 2);
  assert.equal(candidate.denominator, 3);
  assert.deepEqual(candidate.observationIds, ["candidate", "recommendation"]);
  const recommended = metrics.calculate("explicit_recommendation", rows);
  assert.equal(recommended.numerator, 1);
  assert.equal(recommended.denominator, 2);
  const cited = metrics.calculate("official_citation", rows);
  assert.equal(cited.numerator, 1);
  assert.equal(cited.denominator, 1);
  assert.deepEqual(cited.observationIds, ["citation"]);
});

test("metric value distinguishes no eligible sample from a real zero", () => {
  const calculator = new MonitoringMetricCalculator();
  const noSample = calculator.calculate("official_citation", [observation({ id: "offline", searchUsed: false })]);
  const realZero = calculator.calculate("official_citation", [observation({ id: "online", searchUsed: true })]);
  assert.equal(noSample.denominator, 0);
  assert.equal(noSample.value, null);
  assert.equal(realZero.denominator, 1);
  assert.equal(realZero.value, 0);
});

test("long-range trend keeps only the latest complete run per day", () => {
  const runs = [
    run({ id: "morning", finishedAt: "2026-09-04T01:00:00.000Z" }),
    run({ id: "evening", finishedAt: "2026-09-04T12:00:00.000Z" }),
    run({ id: "next-week", finishedAt: "2026-09-11T12:00:00.000Z" }),
    run({ id: "partial", finishedAt: "2026-09-12T12:00:00.000Z", status: "partial", planned: 2, completed: 1, failed: 1 }),
  ];
  const observations = runs.map((item) => observation({ id: `obs-${item.id}`, runId: item.id, mention: targetMention("ordinary", false) }));
  const builder = new MetricSeriesBuilder();
  const series = builder.build({
    projectId: "project",
    baselineId: "baseline",
    metricId: "brand_discovery",
    runs,
    observations,
    filter: { range: "30d", timezone: "Asia/Shanghai", now: "2026-09-13T00:00:00.000Z" },
  });
  assert.equal(series.state, "ready");
  assert.deepEqual(series.points.map((point) => point.runId), ["evening", "next-week"]);
  assert.ok(series.excludedRunIds.includes("morning"));
  assert.ok(series.excludedRunIds.includes("partial"));
});

test("same-day and incomplete data do not become long-term trends", () => {
  const builder = new MetricSeriesBuilder();
  const sameDayRuns = [
    run({ id: "first", finishedAt: "2026-09-04T01:00:00.000Z" }),
    run({ id: "second", finishedAt: "2026-09-04T12:00:00.000Z" }),
  ];
  const sameDayObservations = sameDayRuns.map((item) => observation({ id: item.id, runId: item.id }));
  const longRange = builder.build({
    projectId: "project",
    baselineId: "baseline",
    metricId: "brand_discovery",
    runs: sameDayRuns,
    observations: sameDayObservations,
    filter: { range: "7d", timezone: "UTC", now: "2026-09-05T00:00:00.000Z" },
  });
  assert.equal(longRange.state, "same_day_only");
  assert.equal(longRange.points.length, 1);
  const intraday = builder.build({
    projectId: "project",
    baselineId: "baseline",
    metricId: "brand_discovery",
    runs: sameDayRuns,
    observations: sameDayObservations,
    filter: { range: "24h", timezone: "UTC", now: "2026-09-05T00:00:00.000Z" },
  });
  assert.equal(intraday.state, "ready");
  assert.equal(intraday.points.length, 2);
  const partialOnly = builder.build({
    projectId: "project",
    baselineId: "baseline",
    metricId: "brand_discovery",
    runs: [run({ id: "partial", finishedAt: "2026-09-04T12:00:00.000Z", status: "partial", planned: 2, completed: 1, failed: 1 })],
    observations: [observation({ id: "partial-observation", runId: "partial" })],
    filter: { range: "7d", timezone: "UTC", now: "2026-09-05T00:00:00.000Z" },
  });
  assert.equal(partialOnly.state, "partial_run");
  assert.equal(partialOnly.points.length, 0);
});

test("trend points retain added, persistent, and removed answer evidence", () => {
  const previousRun = run({ id: "evidence-previous", finishedAt: "2026-09-04T01:00:00.000Z", planned: 3 });
  const currentRun = run({ id: "evidence-current", finishedAt: "2026-09-04T02:00:00.000Z", planned: 3 });
  const previousA = observation({ id: "previous-a", runId: previousRun.id, mention: targetMention("ordinary", false) });
  const previousB = observation({ id: "previous-b", runId: previousRun.id, mention: targetMention("ordinary", false) });
  const previousC = observation({ id: "previous-c", runId: previousRun.id });
  const currentA = observation({ id: "current-a", runId: currentRun.id, mention: targetMention("ordinary", false) });
  const currentB = observation({ id: "current-b", runId: currentRun.id });
  const currentC = observation({ id: "current-c", runId: currentRun.id, mention: targetMention("ordinary", false) });
  currentA.promptId = previousA.promptId;
  currentB.promptId = previousB.promptId;
  currentC.promptId = previousC.promptId;

  const series = new MetricSeriesBuilder().build({
    projectId: "project",
    baselineId: "baseline",
    metricId: "brand_discovery",
    runs: [previousRun, currentRun],
    observations: [previousA, previousB, previousC, currentA, currentB, currentC],
    filter: { range: "24h", timezone: "UTC", now: "2026-09-04T03:00:00.000Z" },
  });

  const change = series.points[1]?.evidenceChange;
  assert.equal(series.state, "ready");
  assert.equal(series.points[1]?.change?.comparable, true);
  assert.equal(series.points[1]?.change?.delta, 0);
  assert.deepEqual(change?.addedCurrentObservationIds, ["current-c"]);
  assert.deepEqual(change?.persistedObservationPairs, [{ currentObservationId: "current-a", previousObservationId: "previous-a" }]);
  assert.deepEqual(change?.removedPreviousObservationIds, ["previous-b"]);
});

test("equal denominator counts with different observation identities are not comparable", () => {
  const previousRun = run({ id: "scope-previous", finishedAt: "2026-09-04T01:00:00.000Z" });
  const currentRun = run({ id: "scope-current", finishedAt: "2026-09-04T02:00:00.000Z" });
  const series = new MetricSeriesBuilder().build({
    projectId: "project",
    baselineId: "baseline",
    metricId: "brand_discovery",
    runs: [previousRun, currentRun],
    observations: [
      observation({ id: "scope-a", runId: previousRun.id, mention: targetMention("ordinary", false) }),
      observation({ id: "scope-b", runId: currentRun.id, mention: targetMention("ordinary", false) }),
    ],
    filter: { range: "24h", timezone: "UTC", now: "2026-09-04T03:00:00.000Z" },
  });

  assert.equal(series.points[1]?.result.denominator, 1);
  assert.equal(series.points[1]?.change?.comparable, false);
  assert.equal(series.points[1]?.evidenceChange?.comparable, false);
  assert.equal(series.points[1]?.evidenceChange?.reasonKey, "trend.denominatorIdentityChanged");
});

test("change records retain current and previous observation evidence", () => {
  const previousRun = run({ id: "previous", finishedAt: "2026-09-04T00:00:00.000Z" });
  const currentRun = run({ id: "current", finishedAt: "2026-09-11T00:00:00.000Z" });
  const previous = observation({ id: "previous-observation", runId: "previous", competitorNames: [] });
  const current = observation({
    id: "current-observation",
    runId: "current",
    mention: targetMention("recommendation", true),
    citations: [citation()],
    searchUsed: true,
    competitorNames: ["Rival"],
  });
  current.promptId = previous.promptId;
  const result = new EvidenceChangeBuilder().build({
    baselineId: "baseline",
    currentRun,
    previousRun,
    observations: [previous, current],
  });
  assert.equal(result.comparable, true);
  assert.ok(result.changes.some((change) => change.kind === "brand_appeared"));
  assert.ok(result.changes.some((change) => change.kind === "candidate_entered"));
  assert.ok(result.changes.some((change) => change.kind === "recommendation_gained"));
  assert.ok(result.changes.some((change) => change.kind === "official_citation_added"));
  for (const change of result.changes) {
    assert.deepEqual(change.currentObservationIds, ["current-observation"]);
    assert.deepEqual(change.previousObservationIds, ["previous-observation"]);
  }
});

test("brand comparison uses one metric and only AI-confirmed competitor identities", () => {
  const firstRun = run({ id: "first-period", finishedAt: "2026-09-04T00:00:00.000Z" });
  const secondRun = run({ id: "second-period", finishedAt: "2026-09-11T00:00:00.000Z" });
  const first = observation({ id: "first-rival", runId: firstRun.id, intentName: "recommendation" });
  const second = observation({ id: "second-rival", runId: secondRun.id, intentName: "recommendation" });
  for (const row of [first, second]) {
    if (!row.intentAnalysis) throw new Error("Intent fixture is missing.");
    row.intentAnalysis.entities = [
      {
        name: "Rival",
        canonicalName: "Rival",
        canonicalUrl: "https://rival.example/",
        entityType: "product",
        identityStatus: "confirmed",
        entityRole: "product_or_brand",
        relationshipToQuestion: "recommended_option",
        relationshipToTarget: "competitor",
        confidence: "low",
        evidenceQuote: "Evidence",
        explanation: "The answer presents Rival as a competing option.",
        sourceUrls: ["https://rival.example/"],
      },
    ];
  }
  const result = new BrandComparisonSeriesBuilder().build({
    projectId: "project",
    projectName: "Example",
    baselineId: "baseline",
    metricId: "brand_discovery",
    runs: [firstRun, secondRun],
    observations: [first, second],
    filter: { range: "30d", timezone: "UTC", now: "2026-09-12T00:00:00.000Z" },
  });
  assert.equal(result.state, "ready");
  assert.deepEqual(result.brands.map((brand) => brand.name), ["Example", "Rival"]);
  assert.deepEqual(result.brands[1]?.points.map((point) => point.result.numerator), [1, 1]);
  assert.equal(result.brands[0]?.points[1]?.change?.comparable, false);
  assert.equal(result.brands[0]?.points[1]?.evidenceChange?.reasonKey, "trend.denominatorIdentityChanged");
  assert.equal(result.brands[1]?.points[1]?.change?.comparable, false);
  assert.equal(result.brands[1]?.points[1]?.evidenceChange?.reasonKey, "trend.denominatorIdentityChanged");
});

test("brand comparison lines retain evidence only when observation identities match", () => {
  const firstRun = run({ id: "comparable-first", finishedAt: "2026-09-04T00:00:00.000Z" });
  const secondRun = run({ id: "comparable-second", finishedAt: "2026-09-11T00:00:00.000Z" });
  const first = observation({ id: "comparable-first-rival", runId: firstRun.id, intentName: "recommendation" });
  const second = observation({ id: "comparable-second-rival", runId: secondRun.id, intentName: "recommendation" });
  second.promptId = first.promptId;
  for (const row of [first, second]) {
    if (!row.intentAnalysis) throw new Error("Intent fixture is missing.");
    row.intentAnalysis.entities = [
      {
        name: "Rival",
        canonicalName: "Rival",
        canonicalUrl: "https://rival.example/",
        entityType: "product",
        identityStatus: "confirmed",
        entityRole: "product_or_brand",
        relationshipToQuestion: "recommended_option",
        relationshipToTarget: "competitor",
        confidence: "low",
        evidenceQuote: "Evidence",
        explanation: "The answer presents Rival as a competing option.",
        sourceUrls: ["https://rival.example/"],
      },
    ];
  }
  const result = new BrandComparisonSeriesBuilder().build({
    projectId: "project",
    projectName: "Example",
    baselineId: "baseline",
    metricId: "brand_discovery",
    runs: [firstRun, secondRun],
    observations: [first, second],
    filter: { range: "30d", timezone: "UTC", now: "2026-09-12T00:00:00.000Z" },
  });

  assert.equal(result.state, "ready");
  assert.equal(result.brands[0]?.points[1]?.change?.comparable, true);
  assert.equal(result.brands[1]?.points[1]?.change?.comparable, true);
  assert.deepEqual(result.brands[1]?.points[1]?.evidenceChange?.persistedObservationPairs, [
    { currentObservationId: "comparable-second-rival", previousObservationId: "comparable-first-rival" },
  ]);
});

test("a new baseline is shown as a break instead of joining old runs", () => {
  const oldRun = run({ id: "old-baseline-run", baselineId: "old-baseline", finishedAt: "2026-09-04T00:00:00.000Z" });
  const currentRun = run({ id: "new-baseline-run", baselineId: "baseline", finishedAt: "2026-09-11T00:00:00.000Z" });
  const series = new MetricSeriesBuilder().build({
    projectId: "project",
    baselineId: "baseline",
    metricId: "brand_discovery",
    runs: [oldRun, currentRun],
    observations: [observation({ id: "new-observation", runId: currentRun.id })],
    filter: { range: "30d", timezone: "UTC", now: "2026-09-12T00:00:00.000Z" },
  });
  assert.equal(series.state, "baseline_changed");
  assert.equal(series.points.length, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import type { Citation, Mention } from "../src/core/types.js";
import type { MonitoringBaseline } from "../src/baselines/baseline-schema.js";
import { EvidenceChangeBuilder } from "../src/changes/evidence-change-builder.js";
import { RunSelector } from "../src/dashboard/run-selection.js";
import { WorkbenchReadModelBuilder } from "../src/dashboard/workbench-read-model.js";
import type { ProjectRunRecord } from "../src/monitoring/monitoring-task-schema.js";
import type { Observation } from "../src/observations/observation-schema.js";
import type { MonitoringProject } from "../src/projects/project-schema.js";
import { renderWorkbenchScript } from "../src/ui/workbench-script.js";
import { OBSERVATION_ANALYSIS_VERSION } from "../src/core/version.js";

function project(projectId = "project-alpha", domain = "alpha.example"): MonitoringProject {
  const name = projectId === "project-alpha" ? "Alpha" : "Beta";
  return {
    id: projectId,
    name,
    domain,
    aliases: [],
    target: { id: `target-${projectId}`, type: "target", name, domain, aliases: [] },
    competitors: [],
    defaultLanguage: "zh-CN",
    status: "active",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function baseline(projectId = "project-alpha", id = "baseline-alpha", comparableKey = "conditions-alpha"): MonitoringBaseline {
  return {
    id,
    projectId,
    name: "Weekly brand monitoring",
    prompts: [],
    providerTargets: [],
    language: "zh-CN",
    promptSetHash: "prompt-set",
    promptSetVersion: "v1",
    analysisRulesVersion: "v1",
    runCountPerPrompt: 1,
    entityScopeHash: "entity-scope",
    comparableKey,
    trendEligible: true,
    status: "active",
    source: "audit_run",
    autoDiscover: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function run(input: {
  id: string;
  finishedAt: string;
  projectId?: string;
  baselineId?: string;
  comparableKey?: string;
  status?: ProjectRunRecord["status"];
  planned?: number;
  completed?: number;
  failed?: number;
}): ProjectRunRecord {
  const planned = input.planned ?? 1;
  const completed = input.completed ?? planned;
  return {
    id: input.id,
    projectId: input.projectId || "project-alpha",
    baselineId: input.baselineId || "baseline-alpha",
    status: input.status || "completed",
    plannedObservationCount: planned,
    completedObservationCount: completed,
    failedObservationCount: input.failed ?? 0,
    comparableKey: input.comparableKey || "conditions-alpha",
    trendEligible: true,
    analysisVersion: OBSERVATION_ANALYSIS_VERSION,
    analysisStatus: "completed",
    analysisCompletedObservationCount: completed,
    analysisIncompleteObservationCount: 0,
    analysisCoverage: {
      version: OBSERVATION_ANALYSIS_VERSION,
      status: "completed",
      observationCount: completed,
      answeredObservationCount: completed,
      completedAnalysisCount: completed,
      incompleteAnalysisCount: 0,
      failedAnalysisCount: 0,
      intentCounts: { recommendation: completed },
      questionIntentProfiledCount: completed,
      candidateApplicableCount: completed,
      candidateNotApplicableCount: 0,
      recommendationApplicableCount: completed,
      recommendationNotApplicableCount: 0,
      brandMentionJudgedCount: completed,
      entityExtractionCompletedCount: completed,
      citationParsingCompletedCount: completed,
      criticalNullCount: 0,
      criticalNullObservationIds: [],
      incompleteObservationIds: [],
    },
    startedAt: input.finishedAt,
    finishedAt: input.finishedAt,
    createdAt: input.finishedAt,
  };
}

function targetMention(projectId: string): Mention {
  return {
    entityId: `target-${projectId}`,
    entityName: projectId === "project-alpha" ? "Alpha" : "Beta",
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
    context: "The monitored brand appears in the answer.",
    paragraph: "The monitored brand appears in the answer.",
  };
}

function observation(input: {
  id: string;
  runId: string;
  index: number;
  projectId?: string;
  baselineId?: string;
  model?: string;
  status?: Observation["status"];
  mentioned?: boolean;
}): Observation {
  const projectId = input.projectId || "project-alpha";
  const baselineId = input.baselineId || "baseline-alpha";
  const status = input.status || "completed";
  const mentioned = input.mentioned === true;
  return {
    id: input.id,
    projectId,
    baselineId,
    runId: input.runId,
    auditRunId: input.runId,
    promptId: `prompt-${input.index}`,
    sampleIndex: 1,
    sampleCount: 1,
    promptText: `Brand question ${input.index}`,
    promptType: "recommendation",
    promptAuditCategory: "organic_discovery",
    targetIncluded: false,
    keywordIds: [],
    providerId: "openrouter",
    model: input.model || "openai/gpt-4o-mini",
    language: "zh-CN",
    sourceType: "api",
    sourceLabel: "OpenRouter API",
    webSearchEnabled: false,
    status,
    startedAt: "2026-09-04T00:00:00.000Z",
    finishedAt: "2026-09-04T00:00:01.000Z",
    answerText: status === "completed" ? "The provider returned an answer." : undefined,
    citations: [],
    mentions: mentioned ? [targetMention(projectId)] : [],
    analysisVersion: OBSERVATION_ANALYSIS_VERSION,
    analysisStatus: status === "completed" ? "completed" : "not_applicable",
    analysisResult: {
      questionIntents: status === "completed" ? ["recommendation"] : null,
      brandMentioned: status === "completed" ? mentioned : null,
      brandCandidate: status === "completed" ? false : null,
      brandRecommended: status === "completed" ? false : null,
      entitiesAnalyzed: status === "completed" ? true : null,
      citationsAnalyzed: status === "completed" ? true : null,
    },
    evidence: {
      hasAnswer: status === "completed",
      targetMentioned: mentioned,
      mentionedCompetitors: [],
      citationCount: 0,
      officialCitationCount: 0,
    },
  };
}

function observationsForRun(runId: string, count: number, mentionedCount: number, model = "openai/gpt-4o-mini"): Observation[] {
  return Array.from({ length: count }, (_, index) =>
    observation({
      id: `${runId}-observation-${index + 1}`,
      runId,
      index: index + 1,
      model,
      mentioned: index < mentionedCount,
    }),
  );
}

test("a 13 of 32 partial run cannot replace the latest 32 of 32 complete data", () => {
  const currentProject = project();
  const currentBaseline = baseline();
  const complete = run({ id: "complete-32", finishedAt: "2026-09-04T15:01:00.000Z", planned: 32 });
  const partial = run({
    id: "partial-13",
    finishedAt: "2026-09-04T15:52:00.000Z",
    status: "partial",
    planned: 32,
    completed: 13,
    failed: 19,
  });
  const completeRows = observationsForRun(complete.id, 32, 12);
  const partialRows = observationsForRun(partial.id, 13, 1);
  const model = new WorkbenchReadModelBuilder().build({
    project: currentProject,
    baselines: [currentBaseline],
    tasks: [],
    runs: [complete, partial],
    observations: [...completeRows, ...partialRows],
    filter: { range: "all", timezone: "UTC" },
  });

  assert.equal(model.latestRun?.id, partial.id);
  assert.equal(model.latestCompleteRun?.id, complete.id);
  assert.equal(model.currentDataRun?.id, complete.id);
  assert.equal(model.latestRunComplete, false);
  assert.deepEqual(model.observationIds, completeRows.map((row) => row.id));
  const discovery = model.latestMetrics.find((metric) => metric.metricId === "brand_discovery");
  assert.equal(discovery?.numerator, 12);
  assert.equal(discovery?.denominator, 32);
});

test("provider-complete legacy analysis cannot replace a current analyzed run", () => {
  const current = run({ id: "current-analysis", finishedAt: "2026-09-04T10:00:00.000Z" });
  const legacy = run({ id: "legacy-analysis", finishedAt: "2026-09-05T10:00:00.000Z" });
  delete legacy.analysisVersion;
  delete legacy.analysisStatus;
  delete legacy.analysisCompletedObservationCount;
  delete legacy.analysisIncompleteObservationCount;
  delete legacy.analysisCoverage;
  const selection = new RunSelector().select({
    projectId: "project-alpha",
    baselines: [baseline()],
    runs: [current, legacy],
  }).selection;
  assert.equal(selection.latestRun?.id, legacy.id);
  assert.equal(selection.latestProviderCompleteRun?.id, legacy.id);
  assert.equal(selection.currentDataRun?.id, current.id);
});

test("a completed analysis summary without its field coverage ledger is not current data", () => {
  const verified = run({ id: "verified", finishedAt: "2026-09-04T10:00:00.000Z" });
  const unverified = run({ id: "unverified", finishedAt: "2026-09-05T10:00:00.000Z" });
  delete unverified.analysisCoverage;
  const selection = new RunSelector().select({
    projectId: "project-alpha",
    baselines: [baseline()],
    runs: [verified, unverified],
  }).selection;

  assert.equal(selection.latestProviderCompleteRun?.id, unverified.id);
  assert.equal(selection.currentDataRun?.id, verified.id);
});

test("a provider failure is not converted into brand disappearance", () => {
  const previous = run({ id: "previous-complete", finishedAt: "2026-09-03T09:00:00.000Z" });
  const failed = run({
    id: "provider-failed",
    finishedAt: "2026-09-04T09:00:00.000Z",
    status: "failed",
    planned: 1,
    completed: 0,
    failed: 1,
  });
  const result = new EvidenceChangeBuilder().build({
    baselineId: "baseline-alpha",
    currentRun: failed,
    previousRun: previous,
    observations: [
      observation({ id: "previous-answer", runId: previous.id, index: 1, mentioned: true }),
      observation({ id: "failed-answer", runId: failed.id, index: 1, status: "failed" }),
    ],
  });

  assert.equal(result.comparable, false);
  assert.equal(result.changes.some((change) => change.kind === "brand_disappeared"), false);
  assert.equal(result.changes.length, 0);
});

test("a model filter changes observations but never the selected run identities", () => {
  const currentProject = project();
  const currentBaseline = baseline();
  const complete = run({ id: "complete-two-models", finishedAt: "2026-09-04T09:00:00.000Z", planned: 2 });
  const rows = [
    observation({ id: "gpt-answer", runId: complete.id, index: 1, model: "openai/gpt-4o-mini", mentioned: true }),
    observation({ id: "claude-answer", runId: complete.id, index: 2, model: "anthropic/claude-haiku-4.5" }),
  ];
  const builder = new WorkbenchReadModelBuilder();
  const all = builder.build({
    project: currentProject,
    baselines: [currentBaseline],
    tasks: [],
    runs: [complete],
    observations: rows,
    filter: { range: "all", timezone: "UTC" },
  });
  const claude = builder.build({
    project: currentProject,
    baselines: [currentBaseline],
    tasks: [],
    runs: [complete],
    observations: rows,
    filter: { range: "all", timezone: "UTC", model: "anthropic/claude-haiku-4.5" },
  });

  assert.equal(claude.latestRun?.id, all.latestRun?.id);
  assert.equal(claude.currentDataRun?.id, all.currentDataRun?.id);
  assert.deepEqual(claude.observationIds, ["claude-answer"]);
});

test("time filters never redefine the latest or current data run", () => {
  const currentProject = project();
  const currentBaseline = baseline();
  const complete = run({ id: "historical-complete", finishedAt: "2026-09-01T09:00:00.000Z" });
  const rows = observationsForRun(complete.id, 1, 1);
  const builder = new WorkbenchReadModelBuilder();

  for (const range of ["24h", "7d", "30d"] as const) {
    const model = builder.build({
      project: currentProject,
      baselines: [currentBaseline],
      tasks: [],
      runs: [complete],
      observations: rows,
      filter: { range, timezone: "UTC", now: "2026-10-15T00:00:00.000Z" },
    });
    assert.equal(model.latestRun?.id, complete.id);
    assert.equal(model.currentDataRun?.id, complete.id);
    assert.equal(model.scope.runCount, 0);
  }
});

test("complete runs from different baselines never become a comparison pair", () => {
  const firstBaseline = baseline("project-alpha", "baseline-a", "conditions-a");
  const secondBaseline = baseline("project-alpha", "baseline-b", "conditions-b");
  const firstRun = run({
    id: "baseline-a-run",
    baselineId: firstBaseline.id,
    comparableKey: firstBaseline.comparableKey,
    finishedAt: "2026-09-03T09:00:00.000Z",
  });
  const secondRun = run({
    id: "baseline-b-run",
    baselineId: secondBaseline.id,
    comparableKey: secondBaseline.comparableKey,
    finishedAt: "2026-09-04T09:00:00.000Z",
  });
  const decision = new RunSelector().select({
    projectId: "project-alpha",
    baselines: [firstBaseline, secondBaseline],
    runs: [firstRun, secondRun],
    requestedBaselineId: secondBaseline.id,
  });

  assert.equal(decision.selection.comparisonCurrentRun?.id, secondRun.id);
  assert.equal(decision.selection.comparisonPreviousRun, null);
});

test("workbench selection strictly excludes every foreign project resource", () => {
  const alpha = project();
  const alphaBaseline = baseline();
  const alphaRun = run({ id: "alpha-run", finishedAt: "2026-09-04T09:00:00.000Z" });
  const beta = project("project-beta", "beta.example");
  const betaBaseline = baseline(beta.id, "baseline-beta", "conditions-beta");
  const betaRun = run({
    id: "beta-run",
    projectId: beta.id,
    baselineId: betaBaseline.id,
    comparableKey: betaBaseline.comparableKey,
    finishedAt: "2026-09-05T09:00:00.000Z",
  });
  const alphaObservation = observation({ id: "alpha-answer", runId: alphaRun.id, index: 1, mentioned: true });
  const betaObservation = observation({
    id: "beta-answer",
    runId: betaRun.id,
    index: 1,
    projectId: beta.id,
    baselineId: betaBaseline.id,
    mentioned: true,
  });
  const model = new WorkbenchReadModelBuilder().build({
    project: alpha,
    baselines: [alphaBaseline, betaBaseline],
    tasks: [],
    runs: [alphaRun, betaRun],
    observations: [alphaObservation, betaObservation],
    filter: { range: "all", timezone: "UTC" },
  });

  assert.equal(model.latestRun?.id, alphaRun.id);
  assert.deepEqual(model.observationIds, [alphaObservation.id]);
  assert.equal(model.runs.every((item) => item.projectId === alpha.id), true);
  assert.equal(JSON.stringify(model).includes("beta-answer"), false);
});

test("metric change evidence lists one observation once when citation pages are replaced", () => {
  const previousRun = run({ id: "citation-previous", finishedAt: "2026-09-04T09:00:00.000Z" });
  const currentRun = run({ id: "citation-current", finishedAt: "2026-09-05T09:00:00.000Z" });
  const cited = (id: string, runId: string, url: string): Observation => {
    const row = observation({ id, runId, index: 1 });
    const citation: Citation = {
      id: `citation-${id}`,
      url,
      domain: "alpha.example",
      citationIndex: 0,
      source: "provider_annotation",
      citationType: "target_official",
    };
    return {
      ...row,
      webSearchEnabled: true,
      search: {
        requested: true,
        requestMode: "provider_native",
        used: true,
        usedMode: "provider_native",
        endpointKind: "official_api",
        endpointProtocol: "responses",
        endpointUrl: "https://provider.example/responses",
        webQueries: [],
        citationCount: 1,
      },
      citations: [citation],
      evidence: { ...row.evidence, citationCount: 1, officialCitationCount: 1 },
    };
  };
  const model = new WorkbenchReadModelBuilder().build({
    project: project(),
    baselines: [baseline()],
    tasks: [],
    runs: [previousRun, currentRun],
    observations: [
      cited("previous-citation", previousRun.id, "https://alpha.example/old"),
      cited("current-citation", currentRun.id, "https://alpha.example/new"),
    ],
    filter: { range: "all", timezone: "UTC" },
  });
  const change = model.metricChanges.find((row) => row.metricId === "official_citation");

  assert.deepEqual(change?.evidence.currentObservationIds, ["current-citation"]);
  assert.deepEqual(change?.evidence.previousObservationIds, ["previous-citation"]);
});

test("the incomplete-run message has one overview render site", () => {
  const source = renderWorkbenchScript();
  const marker = 't("runIncomplete")';
  assert.equal(source.split(marker).length - 1, 1);
  assert.equal(source.includes('class="overview-alert"'), true);
});

test("one complete run produces a baseline state and no drawable trend series", () => {
  const currentProject = project();
  const currentBaseline = baseline();
  const complete = run({ id: "first-complete", finishedAt: "2026-09-04T09:00:00.000Z" });
  const model = new WorkbenchReadModelBuilder().build({
    project: currentProject,
    baselines: [currentBaseline],
    tasks: [],
    runs: [complete],
    observations: observationsForRun(complete.id, 1, 1),
    filter: { range: "30d", timezone: "UTC", now: "2026-09-05T00:00:00.000Z" },
  });

  assert.equal(model.series.some((series) => series.state === "ready"), false);
  assert.equal(model.series.every((series) => series.points.length < 2), true);
});

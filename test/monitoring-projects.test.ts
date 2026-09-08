import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PROMPT_INTENT_SCHEMA_VERSION,
  type AuditRun,
  type Citation,
  type Mention,
  type MonitoringPrompt,
  type PromptRun,
  type ProviderTarget,
  type ReportBundle,
} from "../src/core/types.js";
import { BaselineBuilder } from "../src/baselines/baseline-builder.js";
import { BaselineComparator } from "../src/baselines/baseline-comparator.js";
import { ProjectDashboardBuilder } from "../src/dashboard/project-dashboard-model.js";
import { RunOrchestrator } from "../src/monitoring/run-orchestrator.js";
import { ObservationBuilder } from "../src/observations/observation-builder.js";
import { LegacyRunImporter } from "../src/projects/legacy-run-importer.js";
import { ProjectFileStore } from "../src/projects/project-store.js";
import { ProjectService } from "../src/projects/project-service.js";
import { entityFromInput } from "../src/utils/domain.js";
import { CronScheduleCalculator } from "../src/monitoring/schedule-calculator.js";
import { MonitoringService } from "../src/monitoring/monitoring-service.js";
import type { BaselineRunExecutor, RunBaselineOutput } from "../src/monitoring/run-orchestrator.js";
import { ProjectInsightBuilder } from "../src/insights/project-insight-builder.js";
import { CompetitorLandscapeBuilder } from "../src/insights/competitor-landscape.js";
import { CitationLandscapeBuilder } from "../src/insights/citation-landscape.js";
import type { IntentRunAnalysis } from "../src/intent/intent-schema.js";
import { buildProviderRunTasks } from "../src/runner/audit-runner.js";
import { RunSnapshotBuilder } from "../src/dashboard/run-snapshot-model.js";
import { ExportReportModelBuilder } from "../src/dashboard/export-report-model.js";
import { WorkbenchReadModelBuilder } from "../src/dashboard/workbench-read-model.js";
import { BaselineService } from "../src/baselines/baseline-service.js";
import { NotificationService } from "../src/monitoring/notification-service.js";
import type { NotificationDeliveryAdapter, NotificationEnvelope } from "../src/monitoring/notification-delivery.js";
import type { MonitoringNotificationChannel, MonitoringTask } from "../src/monitoring/monitoring-task-schema.js";

const target = entityFromInput({ type: "target", domain: "example.com", name: "Example" });
const competitor = entityFromInput({ type: "competitor", domain: "rival.com", name: "Rival" });

function prompt(id = "prompt-1", text = "Which tools help teams monitor AI visibility?"): MonitoringPrompt {
  return {
    id,
    type: "recommendation",
    topic: "ai visibility",
    language: "en",
    text,
    enabled: true,
    auditCategory: "organic_discovery",
    targetIncluded: false,
    intentProfile: {
      schemaVersion: PROMPT_INTENT_SCHEMA_VERSION,
      intents: ["recommendation"],
      candidateApplicable: true,
      recommendationApplicable: true,
      reason: "Stable pre-run question classification.",
      analyzer: { providerId: "openrouter", model: "openai/gpt-4o-mini", sourceLabel: "Source: OpenRouter API" },
      status: "completed",
    },
  };
}

function providerTarget(overrides: Partial<ProviderTarget> = {}): ProviderTarget {
  return {
    providerId: "openrouter",
    model: "openai/gpt-4o-mini",
    webSearchEnabled: false,
    ...overrides,
  };
}

function targetMention(): Mention {
  return {
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
    hasCitation: true,
    hasOfficialLink: true,
    context: "Example is recommended.",
    paragraph: "Example is recommended.",
  };
}

function competitorMention(): Mention {
  return {
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
    context: "Rival also appears.",
    paragraph: "Rival also appears.",
  };
}

function citation(): Citation {
  return {
    id: "citation-1",
    url: "https://example.com/docs",
    domain: "example.com",
    title: "Example docs",
    citationIndex: 0,
    source: "provider_annotation",
    citationType: "target_official",
  };
}

function promptRun(id = "provider-run-1", currentPrompt = prompt(), currentProvider = providerTarget()): PromptRun {
  const citations = [citation()];
  const completedIntent = intentAnalysis("unclear");
  completedIntent.entities = [];
  return {
    id,
    prompt: currentPrompt,
    target,
    competitors: [competitor],
    providerId: currentProvider.providerId,
    model: currentProvider.model,
    webSearchEnabled: Boolean(currentProvider.webSearchEnabled),
    sourceType: "api",
    sourceLabel: "Source: OpenRouter API",
    status: "completed",
    startedAt: "2026-09-04T00:00:00.000Z",
    finishedAt: "2026-09-04T00:00:01.000Z",
    result: {
      providerId: currentProvider.providerId,
      providerName: "OpenRouter",
      sourceType: "api",
      sourceLabel: "Source: OpenRouter API",
      resultCaveat: "API result",
      model: currentProvider.model,
      modelVersion: currentProvider.model,
      text: "Example is recommended, and Rival also appears.",
      citations,
      webQueries: [],
      latencyMs: 12,
      createdAt: "2026-09-04T00:00:01.000Z",
    },
    analysis: {
      mentions: [targetMention(), competitorMention()],
      citations,
    },
    intentAnalysis: completedIntent,
  };
}

function intentAnalysis(relationship: IntentRunAnalysis["entities"][number]["relationshipToTarget"]): IntentRunAnalysis {
  return {
    schemaVersion: "intent-v2",
    promptIntent: {
      primaryIntent: "recommendation",
      secondaryIntents: [],
      requestedOutputs: ["Recommend options"],
      targetBrandRole: "not_mentioned",
      requiresSources: false,
      requiresComparison: false,
      requiresRecommendation: true,
      candidateApplicable: true,
      recommendationApplicable: true,
      uncertainty: "low",
    },
    tasks: [{ id: "task-1", requirement: "Recommend options", expectedAnswerType: "list_of_options" }],
    taskResults: [{ taskId: "task-1", status: "completed", evidenceQuote: "Rival also appears.", explanation: "Options were provided.", sourceUrls: [] }],
    entities: [
      {
        name: "Candidate",
        entityType: "product",
        identityStatus: "unresolved",
        entityRole: "product_or_brand",
        relationshipToQuestion: relationship,
        relationshipToTarget: relationship,
        confidence: "high",
        evidenceQuote: "Rival also appears.",
        explanation: "Relationship comes from the answer context.",
        sourceUrls: [],
      },
    ],
    adaptedResult: {
      displayMode: "brand_question",
      oneSentence: "The answer recommended options.",
      userQuestion: "Recommend options",
      answered: ["Recommend options"],
      missing: [],
      uncertain: [],
      entityInsights: [],
    },
    analyzer: { providerId: "openrouter", model: "openai/gpt-4o-mini", sourceLabel: "Source: OpenRouter API" },
    status: "completed",
  };
}

function failedPromptRun(id = "provider-run-failed", currentPrompt = prompt("prompt-2", "What is the best category tool?")): PromptRun {
  return {
    id,
    prompt: currentPrompt,
    target,
    competitors: [competitor],
    providerId: "openrouter",
    model: "openai/gpt-4o-mini",
    webSearchEnabled: false,
    sourceType: "api",
    sourceLabel: "Source: OpenRouter API",
    status: "failed",
    startedAt: "2026-09-04T00:00:00.000Z",
    finishedAt: "2026-09-04T00:00:01.000Z",
    error: "provider failed",
  };
}

function auditRun(input: {
  id?: string | undefined;
  prompts?: MonitoringPrompt[] | undefined;
  providerTargets?: ProviderTarget[] | undefined;
  runs?: PromptRun[] | undefined;
  promptSetVersion?: string | undefined;
  analysisRulesVersion?: string | undefined;
  runCountPerPrompt?: number | undefined;
  promptSetHash?: string | undefined;
} = {}): AuditRun {
  const prompts = input.prompts || [prompt()];
  const providerTargets = input.providerTargets || [providerTarget()];
  return {
    id: input.id || "audit-1",
    promptSetHash: input.promptSetHash || "hash-1",
    promptSetVersion: input.promptSetVersion,
    analysisRulesVersion: input.analysisRulesVersion,
    runCountPerPrompt: input.runCountPerPrompt,
    submittedDomain: "example.com",
    target,
    competitors: [competitor],
    prompts,
    providerTargets,
    runs: input.runs || [promptRun("provider-run-1", prompts[0] || prompt(), providerTargets[0] || providerTarget())],
    startedAt: "2026-09-04T00:00:00.000Z",
    finishedAt: "2026-09-04T00:00:02.000Z",
  };
}

function comparableAudit(overrides: Parameters<typeof auditRun>[0] = {}): AuditRun {
  return auditRun({
    promptSetVersion: "prompt-v1",
    analysisRulesVersion: "rules-v1",
    runCountPerPrompt: 1,
    ...overrides,
  });
}

function isolatedProjectAudit(index: number): AuditRun {
  const brandName = `Fixture Brand ${index}`;
  const domain = `fixture-brand-${index}.example`;
  const currentTarget = entityFromInput({ type: "target", domain, name: brandName });
  const currentCompetitor = entityFromInput({
    type: "competitor",
    domain: `fixture-rival-${index}.example`,
    name: `Fixture Rival ${index}`,
  });
  const currentPrompt = prompt(`fixture-prompt-${index}`, `Should a team consider ${brandName} for its product?`);
  const currentProvider = providerTarget();
  const officialCitation: Citation = {
    id: `fixture-citation-${index}`,
    url: `https://${domain}/docs`,
    domain,
    title: `${brandName} documentation`,
    citationIndex: 0,
    source: "provider_annotation",
    citationType: "target_official",
  };
  const sourceRun = promptRun(`fixture-provider-run-${index}`, currentPrompt, currentProvider);
  const currentRun: PromptRun = {
    ...sourceRun,
    target: currentTarget,
    competitors: [currentCompetitor],
    result: {
      ...sourceRun.result!,
      text: `${brandName} is recommended for this product need.`,
      citations: [officialCitation],
    },
    analysis: {
      mentions: [
        {
          ...targetMention(),
          entityId: currentTarget.id,
          entityName: currentTarget.name,
          context: `${brandName} is recommended for this product need.`,
          paragraph: `${brandName} is recommended for this product need.`,
        },
      ],
      citations: [officialCitation],
    },
  };
  return {
    ...comparableAudit({
      id: `fixture-audit-${index}`,
      prompts: [currentPrompt],
      providerTargets: [currentProvider],
      runs: [currentRun],
      promptSetHash: `fixture-hash-${index}`,
    }),
    submittedDomain: domain,
    target: currentTarget,
    competitors: [currentCompetitor],
  };
}

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "niubigeo-monitoring-"));
}

test("baseline comparator allows trends only for identical monitoring conditions", () => {
  const service = new ProjectService();
  const builder = new BaselineBuilder();
  const comparator = new BaselineComparator();
  const audit = comparableAudit();
  const project = service.projectFromAuditRun(audit);
  const baseline = builder.fromAuditRun(project, audit);
  const sameBaseline = builder.fromAuditRun(project, comparableAudit({ id: "audit-2" }));
  const changedModel = builder.fromAuditRun(
    project,
    comparableAudit({
      id: "audit-3",
      providerTargets: [providerTarget({ model: "anthropic/claude-3.5-haiku" })],
    }),
  );
  const changedSearch = builder.fromAuditRun(
    project,
    comparableAudit({
      id: "audit-4",
      providerTargets: [providerTarget({ webSearchEnabled: true, webSearchMode: "provider_native" })],
    }),
  );

  assert.equal(baseline.trendEligible, true);
  assert.equal(comparator.canCompare(baseline, sameBaseline), true);
  assert.equal(comparator.canCompare(baseline, changedModel), false);
  assert.equal(comparator.compare(baseline, changedModel).differingFields.includes("comparableKey"), true);
  assert.equal(comparator.canCompare(baseline, changedSearch), false);
});

test("observation builder materializes one provider answer without raw provider JSON", () => {
  const audit = comparableAudit({ runs: [promptRun(), failedPromptRun()] });
  const project = new ProjectService().projectFromAuditRun(audit);
  const baseline = new BaselineBuilder().fromAuditRun(project, audit);
  const observations = new ObservationBuilder().fromAuditRun({
    projectId: project.id,
    baselineId: baseline.id,
    runId: `run-${audit.id}`,
    audit,
  });

  assert.equal(observations.length, 2);
  const completed = observations.find((item) => item.status === "completed");
  const failed = observations.find((item) => item.status === "failed");
  assert.ok(completed);
  assert.equal(completed.answerText, "Example is recommended, and Rival also appears.");
  assert.equal(completed.evidence.targetMentioned, true);
  assert.deepEqual(completed.evidence.mentionedCompetitors, ["Rival"]);
  assert.equal(completed.evidence.officialCitationCount, 1);
  assert.ok(failed);
  assert.equal(failed.evidence.hasAnswer, false);
  assert.equal(failed.error, "provider failed");
});

test("project file store persists projects, baselines, run records, and observations", async () => {
  const root = await tempRoot();
  try {
    const audit = comparableAudit();
    const store = new ProjectFileStore(root);
    const orchestrator = new RunOrchestrator(store);
    const paths: ReportBundle = {
      runDir: "/tmp/run",
      auditJson: "/tmp/run/audit.json",
      reportJson: "/tmp/run/report.json",
      reportMd: "/tmp/run/report.md",
      reportHtml: "/tmp/run/report.html",
      promptCsv: "/tmp/run/prompts.csv",
      citationCsv: "/tmp/run/citations.csv",
      keywordCsv: "/tmp/run/keywords.csv",
    };

    const materialized = await orchestrator.recordAuditOutput(audit, paths);
    const projects = await store.listProjects();
    const baselines = await store.listBaselines(materialized.project.id);
    const runs = await store.listRuns(materialized.project.id);
    const observations = await store.listObservations(materialized.project.id, materialized.run.id);
    const dashboard = await store.readDashboard<{ latestRunId: string }>(materialized.project.id);

    assert.equal(projects.length, 1);
    assert.equal(baselines.length, 1);
    assert.equal(runs.length, 1);
    assert.equal(observations.length, 1);
    assert.equal(runs[0]?.reportHtmlPath, "/tmp/run/report.html");
    assert.equal(dashboard?.latestRunId, materialized.run.id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("twenty isolated projects cannot contaminate the selected project workbench", async () => {
  const root = await tempRoot();
  try {
    const store = new ProjectFileStore(root);
    const service = new ProjectService();
    const materializedRuns = [];
    const tasks: MonitoringTask[] = [];

    for (let index = 1; index <= 20; index += 1) {
      const materialized = service.materializeAuditRun({ audit: isolatedProjectAudit(index) });
      const task: MonitoringTask = {
        id: `fixture-task-${index}`,
        name: `Fixture monitoring ${index}`,
        projectId: materialized.project.id,
        baselineId: materialized.baseline.id,
        schedule: { kind: "weekly", timezone: "UTC", dayOfWeek: 1, hour: 9, minute: 0 },
        notifications: { conditions: [], channels: [] },
        enabled: true,
        lastRunId: materialized.run.id,
        nextRunAt: "2026-09-07T09:00:00.000Z",
        createdAt: "2026-09-04T00:00:00.000Z",
        updatedAt: "2026-09-04T00:00:02.000Z",
      };
      await store.saveProject(materialized.project);
      await store.saveBaseline(materialized.baseline);
      await store.saveRun(materialized.run);
      await store.saveObservations(materialized.project.id, materialized.run.id, materialized.observations);
      await store.saveTask(task);
      materializedRuns.push(materialized);
      tasks.push(task);
    }

    const selected = materializedRuns[0];
    assert.ok(selected);
    const projects = await store.listProjects();
    const selectedBaselines = await store.listBaselines(selected.project.id);
    const selectedRuns = await store.listRuns(selected.project.id);
    const selectedObservations = await store.listObservations(selected.project.id);
    const selectedTasks = await store.listTasks(selected.project.id);
    assert.equal(projects.length, 20);
    assert.equal(selectedBaselines.length, 1);
    assert.equal(selectedRuns.length, 1);
    assert.equal(selectedObservations.length, 1);
    assert.equal(selectedTasks.length, 1);
    assert.equal(selectedObservations.every((row) => row.projectId === selected.project.id), true);
    assert.equal(selectedTasks.every((row) => row.projectId === selected.project.id), true);

    const mixedBaselines = materializedRuns.map((item) => item.baseline);
    const mixedRuns = materializedRuns.map((item) => item.run);
    const mixedObservations = materializedRuns.flatMap((item) => item.observations);
    const workbench = new WorkbenchReadModelBuilder().build({
      project: selected.project,
      baselines: mixedBaselines,
      tasks,
      runs: mixedRuns,
      observations: mixedObservations,
      filter: { range: "all", timezone: "UTC" },
    });
    assert.equal(workbench.scope.runCount, 1);
    assert.equal(workbench.scope.observationCount, 1);
    assert.equal(workbench.runs.every((row) => row.projectId === selected.project.id), true);
    assert.equal(workbench.tasks.every((row) => row.task.projectId === selected.project.id), true);
    assert.equal(workbench.questions.length, 1);
    assert.equal(workbench.questions[0]?.promptText.includes("Fixture Brand 1"), true);
    assert.equal(workbench.citations.targetSources.length, 1);
    assert.equal(workbench.citations.targetSources[0]?.domain, "fixture-brand-1.example");
    assert.deepEqual(workbench.observationIds, selected.observations.map((row) => row.id));

    const dashboard = new ProjectDashboardBuilder().build({
      project: selected.project,
      baselines: mixedBaselines,
      tasks,
      runs: mixedRuns,
      observations: mixedObservations,
    });
    assert.equal(dashboard.totalObservations, 1);
    assert.equal(dashboard.baselineSummaries.length, 1);
    assert.equal(dashboard.insight.citations.targetSources[0]?.domain, "fixture-brand-1.example");

    const foreign = materializedRuns[1];
    assert.ok(foreign);
    await assert.rejects(
      store.saveObservations(selected.project.id, selected.run.id, foreign.observations),
      (error) => error instanceof Error && error.message.includes("does not belong to project"),
    );
    assert.equal((await store.listObservations(selected.project.id)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a project primary domain cannot be replaced by another audit target", async () => {
  const root = await tempRoot();
  try {
    const store = new ProjectFileStore(root);
    const service = new ProjectService();
    const original = service.materializeAuditRun({ audit: isolatedProjectAudit(1) });
    const differentTarget = isolatedProjectAudit(2);
    await store.saveProject(original.project);
    await assert.rejects(
      store.saveProject({ ...original.project, domain: differentTarget.target.domain, target: differentTarget.target }),
      (error) => error instanceof Error && error.message === "A project primary domain cannot be changed in place.",
    );
    assert.throws(
      () => service.projectFromAuditRun(differentTarget, original.project),
      (error) => error instanceof Error && error.message === "The audit target does not belong to the existing project domain.",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy importer groups same-domain runs and keeps unknown configs out of trends", async () => {
  const root = await tempRoot();
  const oldRuns = join(root, "old-runs");
  const projectData = join(root, "project-data");
  try {
    await mkdir(join(oldRuns, "run-a"), { recursive: true });
    await mkdir(join(oldRuns, "run-b"), { recursive: true });
    await mkdir(join(oldRuns, "run-c"), { recursive: true });
    await writeFile(join(oldRuns, "run-a", "audit.json"), JSON.stringify(comparableAudit({ id: "audit-a" }), null, 2));
    await writeFile(
      join(oldRuns, "run-b", "audit.json"),
      JSON.stringify(
        comparableAudit({
          id: "audit-b",
          providerTargets: [providerTarget({ model: "google/gemini-flash-1.5" })],
        }),
        null,
        2,
      ),
    );
    await writeFile(
      join(oldRuns, "run-c", "audit.json"),
      JSON.stringify(
        auditRun({
          id: "audit-c",
          providerTargets: [],
          promptSetVersion: undefined,
          analysisRulesVersion: undefined,
          runCountPerPrompt: undefined,
          runs: [],
        }),
        null,
        2,
      ),
    );

    const store = new ProjectFileStore(projectData);
    const summary = await new LegacyRunImporter(store).importRuns(oldRuns);
    const projects = await store.listProjects();
    const baselines = await store.listBaselines(projects[0]?.id || "");
    const runs = await store.listRuns(projects[0]?.id || "");

    assert.equal(summary.scanned, 3);
    assert.equal(summary.imported, 3);
    assert.equal(projects.length, 1);
    assert.equal(baselines.length, 3);
    assert.equal(runs.length, 3);
    assert.equal(baselines.filter((baseline) => baseline.trendEligible).length, 2);
    assert.equal(baselines.filter((baseline) => !baseline.trendEligible).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project dashboard summarizes latest runs without inventing trend comparisons", () => {
  const service = new ProjectService();
  const audit = comparableAudit({ runs: [promptRun(), failedPromptRun()] });
  const materialized = service.materializeAuditRun({ audit });
  const dashboard = new ProjectDashboardBuilder().build({
    project: materialized.project,
    baselines: [materialized.baseline],
    runs: [materialized.run],
    observations: materialized.observations,
  });

  assert.equal(dashboard.projectName, "Example");
  assert.equal(dashboard.latestRunId, materialized.run.id);
  assert.equal(dashboard.totalObservations, 2);
  assert.equal(dashboard.completedObservations, 1);
  assert.equal(dashboard.failedObservations, 1);
  assert.equal(dashboard.baselineSummaries[0]?.runCount, 1);
  assert.equal(dashboard.baselineSummaries[0]?.comparableRunCount, 0);
});

test("schedule calculator handles daily, weekly, and cron schedules in the configured timezone", () => {
  const calculator = new CronScheduleCalculator();
  const current = new Date("2026-09-04T00:30:00.000Z");
  assert.equal(calculator.next({ kind: "daily", timezone: "Asia/Shanghai", hour: 9, minute: 0 }, current), "2026-09-04T01:00:00.000Z");
  assert.equal(calculator.next({ kind: "weekly", timezone: "Asia/Shanghai", dayOfWeek: 1, hour: 9, minute: 0 }, current), "2026-09-07T01:00:00.000Z");
  assert.equal(calculator.next({ kind: "monthly", timezone: "Asia/Shanghai", dayOfMonth: 8, hour: 9, minute: 30 }, current), "2026-09-08T01:30:00.000Z");
  assert.equal(calculator.next({ kind: "cron", timezone: "UTC", cron: "15 6 * * *" }, current), "2026-09-04T06:15:00.000Z");
  assert.equal(calculator.next({ kind: "manual", timezone: "UTC" }, current), undefined);
});

test("task schedule and notifications can change without changing its immutable baseline", async () => {
  const root = await tempRoot();
  try {
    const store = new ProjectFileStore(root);
    const materialized = new ProjectService().materializeAuditRun({ audit: comparableAudit() });
    await store.saveProject(materialized.project);
    await store.saveBaseline(materialized.baseline);
    const executor: BaselineRunExecutor = {
      async runBaseline(): Promise<RunBaselineOutput> {
        throw new Error("not executed by this test");
      },
    };
    const service = new MonitoringService(store, executor);
    const created = await service.createTask({
      name: "Weekly review",
      projectId: materialized.project.id,
      baselineId: materialized.baseline.id,
      schedule: { kind: "weekly", timezone: "Asia/Shanghai", dayOfWeek: 1, hour: 9, minute: 0 },
      now: new Date("2026-09-04T00:00:00.000Z"),
    });
    const updated = await service.updateTask(materialized.project.id, created.id, {
      schedule: { kind: "monthly", timezone: "Asia/Shanghai", dayOfMonth: 8, hour: 9, minute: 30 },
      notifications: {
        conditions: ["brand_disappeared", "run_failed"],
        channels: [{ id: "channel-1", type: "webhook", target: "https://hooks.example/monitoring", enabled: true }],
      },
      now: new Date("2026-09-04T00:00:00.000Z"),
    });
    assert.equal(updated.baselineId, created.baselineId);
    assert.equal(updated.schedule.kind, "monthly");
    assert.equal(updated.nextRunAt, "2026-09-08T01:30:00.000Z");
    assert.deepEqual(updated.notifications.conditions, ["brand_disappeared", "run_failed"]);
    const duplicated = await service.duplicateTask(materialized.project.id, created.id, new Date("2026-09-04T00:00:00.000Z"));
    assert.equal(duplicated.baselineId, created.baselineId);
    assert.equal(duplicated.enabled, false);
    assert.deepEqual(duplicated.notifications, updated.notifications);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("task content changes derive an immutable baseline while identical configuration reuses it", async () => {
  const root = await tempRoot();
  try {
    const store = new ProjectFileStore(root);
    const prompts = [prompt("prompt-a"), prompt("prompt-b", "How do teams compare monitored answers?")];
    const providerTargets = [providerTarget(), providerTarget({ model: "google/gemini-2.5-flash" })];
    const audit = comparableAudit({ prompts, providerTargets });
    const materialized = new ProjectService().materializeAuditRun({ audit });
    await store.saveProject(materialized.project);
    await store.saveBaseline(materialized.baseline);
    const service = new BaselineService(store);
    const derived = await service.derive(materialized.project.id, materialized.baseline.id, {
      selectedPromptIds: ["prompt-b"],
      providerTargets: [providerTargets[1]!],
      language: "en",
      runCountPerPrompt: 2,
    });
    const repeated = await service.derive(materialized.project.id, materialized.baseline.id, {
      selectedPromptIds: ["prompt-b"],
      providerTargets: [providerTargets[1]!],
      language: "en",
      runCountPerPrompt: 2,
    });
    assert.notEqual(derived.id, materialized.baseline.id);
    assert.equal(derived.sourceBaselineId, materialized.baseline.id);
    assert.deepEqual(derived.prompts.map((item) => item.id), ["prompt-b"]);
    assert.deepEqual(derived.providerTargets, [providerTargets[1]]);
    assert.equal(derived.runCountPerPrompt, 2);
    assert.equal(repeated.id, derived.id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("baseline comparison includes the monitored brand and competitor scope", () => {
  const projectService = new ProjectService();
  const builder = new BaselineBuilder();
  const audit = comparableAudit();
  const project = projectService.projectFromAuditRun(audit);
  const scoped = builder.fromAuditRun(project, audit);
  const changedScope = builder.fromAuditRun({ ...project, competitors: [] }, audit);
  assert.notEqual(scoped.entityScopeHash, changedScope.entityScopeHash);
  assert.notEqual(scoped.comparableKey, changedScope.comparableKey);
  assert.equal(new BaselineComparator().canCompare(scoped, changedScope), false);
});

test("monitoring events are persisted and delivered without changing run status", async () => {
  const root = await tempRoot();
  try {
    const store = new ProjectFileStore(root);
    const previousAudit = comparableAudit({ id: "audit-previous" });
    const previous = new ProjectService().materializeAuditRun({ audit: previousAudit });
    const currentProviderRun = promptRun("provider-run-current");
    currentProviderRun.result!.text = "Rival also appears.";
    currentProviderRun.analysis!.mentions = currentProviderRun.analysis!.mentions.map((mention) =>
      mention.entityType === "target"
        ? { ...mention, count: 0, firstPosition: null, rankPosition: null, mentionType: "not_mentioned", isMentioned: false, isRecommendation: false, isFirstPosition: false, context: null, paragraph: null }
        : mention,
    );
    const current = new ProjectService().materializeAuditRun({
      audit: comparableAudit({ id: "audit-current", runs: [currentProviderRun] }),
    });
    await store.saveProject(current.project);
    await store.saveBaseline(current.baseline);
    await store.saveRun(previous.run);
    await store.saveObservations(previous.project.id, previous.run.id, previous.observations);
    await store.saveRun(current.run);
    await store.saveObservations(current.project.id, current.run.id, current.observations);
    const delivered: NotificationEnvelope[] = [];
    const adapter: NotificationDeliveryAdapter = {
      supports(): boolean {
        return true;
      },
      async deliver(_channel: MonitoringNotificationChannel, envelope: NotificationEnvelope): Promise<void> {
        delivered.push(envelope);
      },
    };
    const task = await new MonitoringService(store, { async runBaseline() { throw new Error("not used"); } }).createTask({
      projectId: current.project.id,
      baselineId: current.baseline.id,
      schedule: { kind: "daily", timezone: "UTC", hour: 9, minute: 0 },
      notifications: {
        conditions: ["brand_disappeared", "run_completed"],
        channels: [{ id: "channel-1", type: "webhook", target: "https://example.com/hook", enabled: true }],
      },
    });
    await new NotificationService(store, [adapter]).afterRun(task, current.run);
    await new NotificationService(store, [adapter]).afterRun(task, current.run);
    const events = await store.listMonitoringEvents(current.project.id);
    assert.deepEqual(events.map((event) => event.condition).sort(), ["brand_disappeared", "run_completed"]);
    assert.equal(events.every((event) => event.status === "delivered"), true);
    assert.equal(events.find((event) => event.condition === "brand_disappeared")?.observationIds.length, 1);
    assert.equal(delivered.length, 2);
    assert.equal(current.run.status, "completed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("run count per prompt expands into independent provider observations", () => {
  const tasks = buildProviderRunTasks(
    [prompt("prompt-a"), prompt("prompt-b")],
    [providerTarget(), providerTarget({ model: "google/gemini-2.5-flash" })],
    3,
  );
  assert.equal(tasks.length, 12);
  assert.deepEqual([...new Set(tasks.map((task) => task.sampleIndex))], [1, 2, 3]);
  assert.equal(tasks.every((task) => task.sampleCount === 3), true);
});

test("monitoring service persists tasks and executes only due schedules", async () => {
  const root = await tempRoot();
  try {
    const store = new ProjectFileStore(root);
    const materialized = new ProjectService().materializeAuditRun({ audit: comparableAudit() });
    await store.saveProject(materialized.project);
    await store.saveBaseline(materialized.baseline);
    let executions = 0;
    const executor: BaselineRunExecutor = {
      async runBaseline(): Promise<RunBaselineOutput> {
        executions += 1;
        return {
          runnerOutput: {
            audit: comparableAudit(),
            metrics: {} as RunBaselineOutput["runnerOutput"]["metrics"],
            gaps: { summary: "", findings: [] },
            paths: {
              runDir: "/tmp/run",
              auditJson: "/tmp/run/audit.json",
              reportJson: "/tmp/run/report.json",
              reportMd: "/tmp/run/report.md",
              reportHtml: "/tmp/run/report.html",
              promptCsv: "/tmp/run/prompts.csv",
              citationCsv: "/tmp/run/citations.csv",
              keywordCsv: "/tmp/run/keywords.csv",
            },
          },
          materialized,
        };
      },
    };
    const service = new MonitoringService(store, executor);
    const task = await service.createTask({
      projectId: materialized.project.id,
      baselineId: materialized.baseline.id,
      schedule: { kind: "daily", timezone: "Asia/Shanghai", hour: 9, minute: 0 },
      now: new Date("2026-09-04T00:30:00.000Z"),
    });
    assert.equal(task.nextRunAt, "2026-09-04T01:00:00.000Z");
    assert.equal((await service.runDue(new Date("2026-09-04T00:59:59.000Z"))).length, 0);
    const results = await service.runDue(new Date("2026-09-04T01:00:00.000Z"));
    assert.equal(results.length, 1);
    assert.equal(executions, 1);
    assert.equal((await store.readTask(materialized.project.id, task.id))?.lastRunId, materialized.run.id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file task leases prevent duplicate workers and allow expired lease recovery", async () => {
  const root = await tempRoot();
  try {
    const store = new ProjectFileStore(root);
    const projectId = "project-example";
    const taskId = "task-example";
    assert.equal(
      await store.acquireTaskLease(projectId, taskId, {
        ownerId: "worker-a",
        acquiredAt: "2026-09-04T00:00:00.000Z",
        expiresAt: "2026-09-04T01:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      await store.acquireTaskLease(projectId, taskId, {
        ownerId: "worker-b",
        acquiredAt: "2026-09-04T00:30:00.000Z",
        expiresAt: "2026-09-04T01:30:00.000Z",
      }),
      false,
    );
    await store.releaseTaskLease(projectId, taskId, "worker-b");
    assert.equal(
      await store.acquireTaskLease(projectId, taskId, {
        ownerId: "worker-c",
        acquiredAt: "2026-09-04T01:00:01.000Z",
        expiresAt: "2026-09-04T02:00:01.000Z",
      }),
      true,
    );
    await store.releaseTaskLease(projectId, taskId, "worker-c");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("run orchestrator persists a failed run when the audit engine aborts", async () => {
  const root = await tempRoot();
  try {
    const store = new ProjectFileStore(root);
    const materialized = new ProjectService().materializeAuditRun({ audit: comparableAudit() });
    await store.saveProject(materialized.project);
    await store.saveBaseline(materialized.baseline);
    const orchestrator = new RunOrchestrator(store, {
      async run() {
        throw new Error("provider configuration failed");
      },
    });
    await assert.rejects(
      orchestrator.runBaseline({ project: materialized.project, baseline: materialized.baseline }),
      (error) => error instanceof Error && error.message === "provider configuration failed",
    );
    const runs = await store.listRuns(materialized.project.id);
    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.status, "failed");
    assert.equal(runs[0]?.error, "provider configuration failed");
    assert.equal(runs[0]?.auditRunId, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project insight creates trends only from comparable baselines", () => {
  const service = new ProjectService();
  const first = service.materializeAuditRun({ audit: comparableAudit({ id: "trend-a" }) });
  const second = service.materializeAuditRun({
    audit: comparableAudit({ id: "trend-b" }),
    existingProject: first.project,
    existingBaseline: first.baseline,
  });
  const changed = service.materializeAuditRun({
    audit: comparableAudit({ id: "trend-c", providerTargets: [providerTarget({ model: "google/gemini-2.5-flash" })] }),
    existingProject: second.project,
  });
  const insight = new ProjectInsightBuilder().build({
    project: changed.project,
    baselines: [first.baseline, changed.baseline],
    runs: [first.run, second.run, changed.run],
    observations: [...first.observations, ...second.observations, ...changed.observations],
    generatedAt: "2026-09-04T01:00:00.000Z",
  });
  const firstTrend = insight.trends.find((trend) => trend.baselineId === first.baseline.id);
  const changedTrend = insight.trends.find((trend) => trend.baselineId === changed.baseline.id);
  assert.equal(firstTrend?.comparable, true);
  assert.equal(firstTrend?.points.length, 2);
  assert.equal(changedTrend?.comparable, false);
  assert.equal(changedTrend?.points.length, 1);
});

test("project trends exclude partial runs even when their baseline matches", () => {
  const service = new ProjectService();
  const first = service.materializeAuditRun({ audit: comparableAudit({ id: "trend-complete" }) });
  const partial = service.materializeAuditRun({
    audit: comparableAudit({ id: "trend-partial" }),
    existingProject: first.project,
    existingBaseline: first.baseline,
  });
  partial.run.status = "partial";
  partial.run.completedObservationCount = 0;
  partial.run.failedObservationCount = partial.run.plannedObservationCount;
  const insight = new ProjectInsightBuilder().build({
    project: partial.project,
    baselines: [first.baseline],
    runs: [first.run, partial.run],
    observations: [...first.observations, ...partial.observations],
  });
  assert.equal(insight.trends[0]?.comparable, false);
  assert.equal(insight.trends[0]?.points.length, 1);
});

test("project changes identify disappeared prompts only after two complete comparable runs", () => {
  const service = new ProjectService();
  const first = service.materializeAuditRun({ audit: comparableAudit({ id: "change-a" }) });
  first.run.finishedAt = "2026-09-04T01:00:00.000Z";
  const absentRun = promptRun("absent");
  absentRun.result!.citations = [];
  absentRun.analysis = { mentions: [competitorMention()], citations: [] };
  const second = service.materializeAuditRun({
    audit: comparableAudit({ id: "change-b", runs: [absentRun] }),
    existingProject: first.project,
    existingBaseline: first.baseline,
  });
  second.run.finishedAt = "2026-09-04T02:00:00.000Z";
  const insight = new ProjectInsightBuilder().build({
    project: second.project,
    baselines: [first.baseline],
    runs: [first.run, second.run],
    observations: [...first.observations, ...second.observations],
  });
  assert.equal(insight.changes[0]?.comparable, true);
  assert.deepEqual(insight.changes[0]?.prompts.disappeared, [prompt().text]);

  second.run.status = "partial";
  second.run.failedObservationCount = 1;
  second.run.completedObservationCount = 0;
  const guarded = new ProjectInsightBuilder().build({
    project: second.project,
    baselines: [first.baseline],
    runs: [first.run, second.run],
    observations: [...first.observations, ...second.observations],
  });
  assert.equal(guarded.changes[0]?.comparable, false);
  assert.deepEqual(guarded.changes[0]?.prompts.disappeared, []);
});

test("competitor landscape keeps configured competitors separate from AI relationship candidates", () => {
  const service = new ProjectService();
  const directRun = promptRun("direct");
  directRun.result!.citations.push({
    id: "competitor-source",
    url: "https://rival.example/product",
    domain: "rival.example",
    citationIndex: 1,
    source: "provider_citation_array",
    citationType: "competitor_official",
    entityId: competitor.id,
    entityName: competitor.name,
    promptId: directRun.prompt.id,
    runId: directRun.id,
  });
  directRun.analysis!.citations = [...directRun.result!.citations];
  directRun.intentAnalysis = intentAnalysis("direct_alternative");
  const channelRun = promptRun("channel", prompt("prompt-channel", "Where can a project be promoted?"));
  channelRun.intentAnalysis = intentAnalysis("channel");
  const materialized = service.materializeAuditRun({ audit: comparableAudit({ runs: [directRun, channelRun] }) });
  const landscape = new CompetitorLandscapeBuilder().build([competitor], materialized.observations);
  assert.equal(landscape.confirmed[0]?.name, "Rival");
  assert.equal(landscape.confirmed[0]?.observationCount, 2);
  assert.equal(landscape.relatedCandidates.some((item) => item.name === "Candidate"), true);
  const onlyChannel = new CompetitorLandscapeBuilder().build([competitor], [materialized.observations[1]!]);
  assert.equal(onlyChannel.relatedCandidates.some((item) => item.name === "Candidate"), false);
});

test("competitor landscape keeps configured names without official identity evidence pending", () => {
  const run = promptRun("unverified-competitor");
  const materialized = new ProjectService().materializeAuditRun({ audit: comparableAudit({ runs: [run] }) });
  const landscape = new CompetitorLandscapeBuilder().build([competitor], materialized.observations);
  assert.equal(landscape.confirmed.length, 0);
  assert.equal(landscape.relatedCandidates[0]?.name, competitor.name);
  assert.equal(landscape.relatedCandidates[0]?.relationship, "unclear");
});

test("competitor landscape never promotes the monitored target into pending competitors", () => {
  const run = promptRun("target-misclassified");
  run.intentAnalysis = intentAnalysis("competitor");
  run.intentAnalysis.entities[0]!.name = target.name;
  const materialized = new ProjectService().materializeAuditRun({ audit: comparableAudit({ runs: [run] }) });
  const landscape = new CompetitorLandscapeBuilder().build([], materialized.observations);
  assert.equal(landscape.relatedCandidates.some((item) => item.name === target.name), false);
});

test("citation landscape counts provider citations by observation without duplicating a URL inside one answer", () => {
  const one = promptRun("citation-a");
  one.result!.citations.push({ ...citation(), id: "citation-duplicate" });
  one.analysis!.citations.push({ ...citation(), id: "citation-duplicate" });
  const two = promptRun("citation-b", prompt(), providerTarget({ model: "google/gemini-2.5-flash" }));
  const materialized = new ProjectService().materializeAuditRun({ audit: comparableAudit({ runs: [one, two] }) });
  const landscape = new CitationLandscapeBuilder().build(materialized.observations);
  assert.equal(landscape.targetSources.length, 1);
  assert.equal(landscape.targetSources[0]?.observationCount, 2);
  assert.equal(landscape.targetDomains.length, 1);
  assert.equal(landscape.targetDomains[0]?.observationCount, 2);
  assert.equal(landscape.targetDomains[0]?.pages.length, 1);
  assert.deepEqual(landscape.targetSources[0]?.observationIds, materialized.observations.map((row) => row.id));
  assert.equal(landscape.targetSources[0]?.providerModels.length, 2);
});

test("workbench uses one filtered scope for competitors, citations, and visible evidence", () => {
  const service = new ProjectService();
  const firstRun = promptRun("scope-a");
  firstRun.intentAnalysis = intentAnalysis("direct_alternative");
  firstRun.intentAnalysis.entities[0] = {
    ...firstRun.intentAnalysis.entities[0]!,
    name: "Rival",
    canonicalName: "Rival",
    canonicalUrl: "https://rival.example/product",
    identityStatus: "confirmed",
    relationshipToTarget: "direct_alternative",
    evidenceQuote: "Rival also appears.",
    sourceUrls: ["https://rival.example/product"],
  };
  firstRun.result!.citations.push({
    id: "rival-citation",
    url: "https://rival.example/product",
    domain: "rival.example",
    citationIndex: 2,
    source: "provider_annotation",
    citationType: "competitor_official",
  });
  firstRun.analysis!.citations = [...firstRun.result!.citations];
  const materialized = service.materializeAuditRun({ audit: comparableAudit({ runs: [firstRun] }) });
  const model = new WorkbenchReadModelBuilder().build({
    project: materialized.project,
    baselines: [materialized.baseline],
    tasks: [],
    runs: [materialized.run],
    observations: materialized.observations,
    filter: { range: "24h", timezone: "UTC", now: "2026-09-04T12:00:00.000Z" },
  });
  assert.equal(model.scope.runCount, 1);
  assert.equal(model.scope.observationCount, 1);
  assert.equal(model.scope.completedAnswerCount, 1);
  assert.equal(model.scope.promptCount, 1);
  assert.deepEqual(model.observationIds, materialized.observations.map((row) => row.id));
  assert.equal(model.entities.confirmedCompetitors[0]?.observationCount, 1);
  assert.equal(model.citations.competitorSources[0]?.observationCount, 1);
});

test("an empty time range does not erase project run state or current complete data", () => {
  const materialized = new ProjectService().materializeAuditRun({ audit: comparableAudit() });
  const model = new WorkbenchReadModelBuilder().build({
    project: materialized.project,
    baselines: [materialized.baseline],
    tasks: [],
    runs: [materialized.run],
    observations: materialized.observations,
    filter: { range: "24h", timezone: "UTC", now: "2026-09-06T12:00:00.000Z" },
  });
  assert.equal(model.scope.runCount, 0);
  assert.equal(model.scope.observationCount, 0);
  assert.equal(model.latestRun?.id, materialized.run.id);
  assert.equal(model.currentDataRun?.id, materialized.run.id);
  assert.equal(model.latestMetrics.find((metric) => metric.metricId === "brand_discovery")?.denominator, 1);
  assert.equal(model.entities.confirmedCompetitors.length, 0);
  assert.equal(model.citations.targetSources.length, 1);
});

test("run snapshot and export models preserve evidence without provider raw JSON", () => {
  const materialized = new ProjectService().materializeAuditRun({ audit: comparableAudit() });
  const snapshot = new RunSnapshotBuilder().build({
    project: materialized.project,
    baseline: materialized.baseline,
    run: materialized.run,
    observations: materialized.observations,
  });
  const exported = new ExportReportModelBuilder().build(snapshot, "2026-09-04T02:00:00.000Z");
  const serialized = JSON.stringify(exported);
  assert.equal(snapshot.observations.length, 1);
  assert.equal(snapshot.observations[0]?.answerText, "Example is recommended, and Rival also appears.");
  assert.equal(serialized.includes("debug"), false);
  assert.equal(exported.formatVersion, "project-export-v1");
});

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

test("new monitoring layer contains no regular-expression or brand-specific shortcuts", async () => {
  const roots = ["src/projects", "src/baselines", "src/monitoring", "src/observations", "src/insights", "src/dashboard"];
  const forbidden = ["new RegExp", ".match(", ".matchAll(", ".replace(", ".replaceAll(", ".search(", "NiubiStar", "Niubistar"];
  for (const root of roots) {
    for (const file of await sourceFiles(root)) {
      const source = await readFile(file, "utf8");
      for (const value of forbidden) assert.equal(source.includes(value), false, `${file} contains forbidden shortcut: ${value}`);
    }
  }
});

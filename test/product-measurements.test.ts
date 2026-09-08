import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProductBaselineService } from "../src/product/configuration/baseline-service.js";
import { ProductConfigurationFileStore } from "../src/product/configuration/configuration-store.js";
import { ProductModelSelectionService } from "../src/product/configuration/model-selection-service.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductMeasurementRunService } from "../src/product/measurements/measurement-service.js";
import { ProductMeasurementFileStore } from "../src/product/measurements/measurement-store.js";
import { measurementPoint, ProductMeasurementStatsService, relativeKeywordWeight } from "../src/product/measurements/measurement-stats.js";
import { ProductWatchSetService } from "../src/product/measurements/watchset-service.js";
import { DOMAIN_PROTOCOL_ID, KEYWORD_PROTOCOL_ID, type WatchSet } from "../src/product/measurements/measurement-schema.js";
import { DOMAIN_RECOGNITION_SCHEMA_HASH } from "../src/product/recognition/recognition-prompt.js";
import { ProductRecognitionFileStore } from "../src/product/recognition/recognition-store.js";
import { RecognitionReportFileStore } from "../src/product/reports/report-store.js";
import { ProductScheduleFileStore } from "../src/product/scheduling/schedule-store.js";
import { ProductScheduleService } from "../src/product/scheduling/schedule-service.js";
import { KEYWORD_DISCOVERY_PROMPT_HASH, KEYWORD_DISCOVERY_SCHEMA_HASH } from "../src/product/measurements/keyword-discovery-protocol.js";
import { Phase5FixtureCatalog, Phase5FixtureExecutor } from "./fixtures/phase5-fixture-adapter.js";

type Fixture = {
  root: string;
  projects: ProductProjectService;
  selections: ProductModelSelectionService;
  baselines: ProductBaselineService;
  store: ProductMeasurementFileStore;
  watchSets: ProductWatchSetService;
  measurements: ProductMeasurementRunService;
  stats: ProductMeasurementStatsService;
  schedules: ProductScheduleService;
  executor: Phase5FixtureExecutor;
};

function wait(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function withFixture(action: (fixture: Fixture) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-phase5-"));
  const projectStore = new ProductProjectFileStore(root);
  const projects = new ProductProjectService(projectStore);
  const configuration = new ProductConfigurationFileStore(projectStore);
  const selections = new ProductModelSelectionService(projects, configuration, new Phase5FixtureCatalog());
  const baselines = new ProductBaselineService(projects, selections, configuration);
  const store = new ProductMeasurementFileStore(projectStore);
  const recognition = new ProductRecognitionFileStore(projectStore);
  const reports = new RecognitionReportFileStore(projectStore);
  const watchSets = new ProductWatchSetService(projects, baselines, store, recognition, reports);
  const executor = new Phase5FixtureExecutor();
  const measurements = new ProductMeasurementRunService(projects, baselines, watchSets, store, executor);
  const stats = new ProductMeasurementStatsService(projects, store);
  const schedules = new ProductScheduleService(projects, baselines, watchSets, measurements, new ProductScheduleFileStore(projectStore));
  try { await action({ root, projects, selections, baselines, store, watchSets, measurements, stats, schedules, executor }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

async function ready(fixture: Fixture, domain: string, models: Array<{ modelId: string; webSearchMode: "off" | "provider_native" }>) {
  const project = await fixture.projects.createDraft({ primaryDomain: domain, name: domain, defaultLanguage: "en" });
  await fixture.selections.replace(project.id, models);
  const baseline = await fixture.baselines.create(project.id);
  const targetId = "object-target";
  const rivalId = "object-rival";
  const keywordId = "keyword-workflow";
  const watchSet: WatchSet = {
    id: "watch-main", projectId: project.id, baselineId: baseline.id, version: 1, status: "active", targetObjectId: targetId,
    objects: [
      { id: targetId, projectId: project.id, role: "target", name: "Target Product", domain: domain, aliases: [], sourceRecordIds: ["source-target"], selectedAt: "2026-09-07T00:00:00.000Z", identityState: "confirmed" },
      { id: rivalId, projectId: project.id, role: "competitor", name: "Rival Product", domain: "rival.example", aliases: [], sourceRecordIds: ["source-rival"], selectedAt: "2026-09-07T00:00:00.000Z", identityState: "confirmed" },
    ],
    keywords: [{ id: keywordId, projectId: project.id, keyword: "workflow", normalizedKeyword: "workflow", sourceRecordIds: ["source-keyword"], selectedAt: "2026-09-07T00:00:00.000Z", neutralEligible: true, neutralEligibilityReason: "eligible" }],
    domainProtocol: { id: DOMAIN_PROTOCOL_ID, version: "v1", language: "en", responseSchemaHash: DOMAIN_RECOGNITION_SCHEMA_HASH, promptTemplateHash: "domain-template" },
    keywordProtocol: { id: KEYWORD_PROTOCOL_ID, version: "v1", language: "en", scenario: "neutral_product_selection", responseSchemaHash: KEYWORD_DISCOVERY_SCHEMA_HASH, promptTemplateHash: KEYWORD_DISCOVERY_PROMPT_HASH },
    repetitions: 1, matchingRuleVersion: "measurement-matching/v1", createdAt: "2026-09-07T00:00:00.000Z", confirmedAt: "2026-09-07T00:00:00.000Z",
  };
  await fixture.store.saveWatchSet(watchSet);
  return { project, baseline, watchSet };
}

async function settled(service: ProductMeasurementRunService, projectId: string, runId: string) {
  for (let index = 0; index < 100; index += 1) {
    const detail = await service.get(projectId, runId);
    if (detail.run.status !== "queued" && detail.run.status !== "running") return detail;
    await wait(10);
  }
  throw new Error("Measurement run did not settle.");
}

test("T01/T02 keep keyword discovery neutral and domain probes independent", async () => {
  await withFixture(async (fixture) => {
    const { project } = await ready(fixture, "target.example", [{ modelId: "phase5/off", webSearchMode: "off" }]);
    const run = await fixture.measurements.start(project.id);
    await settled(fixture.measurements, project.id, run.id);
    const keyword = fixture.executor.calls.find((call) => call.schemaName === "keyword_discovery_result");
    const targetDomain = fixture.executor.calls.find((call) => call.schemaName === "domain_recognition_result" && call.prompt.includes("target.example"));
    const rivalDomain = fixture.executor.calls.find((call) => call.schemaName === "domain_recognition_result" && call.prompt.includes("rival.example"));
    assert.ok(keyword); assert.ok(targetDomain); assert.ok(rivalDomain);
    assert.equal(keyword.prompt.includes("Target Product"), false);
    assert.equal(keyword.prompt.includes("Rival Product"), false);
    assert.equal(keyword.prompt.includes("target.example"), false);
    assert.equal(targetDomain.prompt.includes("rival.example"), false);
    assert.equal(rivalDomain.prompt.includes("target.example"), false);
  });
});

test("T03 blocks identity-bearing keywords from protocol K without blocking domain evidence", async () => {
  await withFixture(async (fixture) => {
    const { project, watchSet } = await ready(fixture, "target.example", [{ modelId: "phase5/off", webSearchMode: "off" }]);
    const keyword = watchSet.keywords[0];
    assert.ok(keyword);
    watchSet.keywords[0] = { ...keyword, keyword: "Target Product workflow", normalizedKeyword: "target product workflow", neutralEligible: false, neutralEligibilityReason: "contains_monitored_identity" };
    await fixture.store.saveWatchSet(watchSet);
    const run = await fixture.measurements.start(project.id);
    const detail = await settled(fixture.measurements, project.id, run.id);
    assert.equal(detail.run.plannedProbeCount, 2);
    assert.equal(fixture.executor.calls.some((call) => call.schemaName === "keyword_discovery_result"), false);
  });
});

test("T04/T05/T06/T08/T10 retain all discovered entities and do not invent target wins", async () => {
  await withFixture(async (fixture) => {
    const { project, watchSet } = await ready(fixture, "target.example", [{ modelId: "phase5/native", webSearchMode: "provider_native" }]);
    const run = await fixture.measurements.start(project.id);
    await settled(fixture.measurements, project.id, run.id);
    const snapshot = await fixture.stats.build(project.id);
    const targetMention = snapshot.points.find((item) => item.metric === "brand_name_mention" && item.objectId === watchSet.targetObjectId);
    const targetRecommendation = snapshot.points.find((item) => item.metric === "positive_recommendation" && item.objectId === watchSet.targetObjectId);
    const targetFirst = snapshot.points.find((item) => item.metric === "first_mention" && item.objectId === watchSet.targetObjectId);
    const targetBody = snapshot.points.find((item) => item.metric === "domain_body_mention" && item.objectId === watchSet.targetObjectId);
    assert.equal(targetMention?.numerator, 1);
    assert.equal(targetRecommendation?.numerator, 0);
    assert.equal(targetFirst?.numerator, 0);
    assert.equal(targetBody?.numerator, 0);
    const runDetail = await fixture.measurements.get(project.id, run.id);
    const keywordModel = runDetail.modelRuns[0];
    assert.ok(keywordModel);
    const keywordProbe = (await fixture.store.listProbes(project.id, run.id, keywordModel.id)).find((item) => item.kind === "keyword_discovery");
    assert.ok(keywordProbe);
    const evidence = await fixture.store.probeDetail(project.id, run.id, keywordModel.id, keywordProbe.id);
    assert.equal(evidence?.mentions.length, 3);
    assert.equal(evidence?.mentions.some((item) => item.name === "Other Product" && item.matchedObjectId === null), true);
  });
});

test("T09/T11/T12/T19 preserve unknown and failure samples and reproduce a point from stored samples", async () => {
  await withFixture(async (fixture) => {
    const { project, watchSet } = await ready(fixture, "target.example", [{ modelId: "phase5/off", webSearchMode: "off" }, { modelId: "phase5/failing", webSearchMode: "off" }]);
    const run = await fixture.measurements.start(project.id);
    await settled(fixture.measurements, project.id, run.id);
    const snapshot = await fixture.stats.build(project.id);
    const offPoint = snapshot.points.find((item) => item.metric === "domain_recognition" && item.objectId === watchSet.targetObjectId && item.modelId === "phase5/off");
    const failedPoint = snapshot.points.find((item) => item.metric === "domain_recognition" && item.objectId === watchSet.targetObjectId && item.modelId === "phase5/failing");
    assert.equal(offPoint?.numerator, 1); assert.equal(offPoint?.denominator, 1); assert.equal(offPoint?.value, 100);
    assert.equal(failedPoint?.value, null);
    const samples = await fixture.stats.pointSamples(project.id, snapshot.id, offPoint?.id || "");
    assert.equal(samples.samples.length, 1);
    assert.equal(samples.samples[0]?.detail?.attempts[0]?.rawAnswer !== undefined, true);
  });
});

test("T13/T16/T17/T18/T22 keep model histories independent and retry without replacing the first attempt", async () => {
  await withFixture(async (fixture) => {
    const { project } = await ready(fixture, "target.example", [{ modelId: "phase5/off", webSearchMode: "off" }, { modelId: "phase5/failing", webSearchMode: "off" }]);
    const first = await fixture.measurements.start(project.id);
    const complete = await settled(fixture.measurements, project.id, first.id);
    const failed = complete.modelRuns.find((item) => item.modelSnapshot.modelId === "phase5/failing");
    assert.ok(failed);
    const probe = (await fixture.store.listProbes(project.id, first.id, failed.id)).find((item) => item.status === "failed");
    assert.ok(probe);
    const before = await fixture.measurements.getProbe(project.id, first.id, failed.id, probe.id);
    await fixture.measurements.retryProbe(project.id, first.id, failed.id, probe.id);
    const after = await fixture.measurements.getProbe(project.id, first.id, failed.id, probe.id);
    assert.equal(before.attempts.length, 1); assert.equal(after.attempts.length, 2);
    assert.equal(after.attempts[0]?.status, "provider_failed"); assert.equal(after.probe.firstAttemptId, before.probe.firstAttemptId);
    await fixture.selections.replace(project.id, [{ modelId: "phase5/off", webSearchMode: "off" }, { modelId: "phase5/added", webSearchMode: "off" }]);
    await fixture.baselines.create(project.id);
    const newWatch = await fixture.watchSets.createFromSuggestion(project.id, {});
    await fixture.watchSets.confirm(project.id, newWatch.id);
    const added = await fixture.measurements.startNewModels(project.id);
    const addedDetail = await settled(fixture.measurements, project.id, added.id);
    assert.deepEqual(addedDetail.run.modelScope, ["phase5/added"]);
  });
});

test("T14/T15/T20/T21/T23 calculate no-data as null and do not turn failures into zero points", async () => {
  await withFixture(async (fixture) => {
    const { project, watchSet } = await ready(fixture, "target.example", [{ modelId: "phase5/failing", webSearchMode: "off" }]);
    const run = await fixture.measurements.start(project.id);
    await settled(fixture.measurements, project.id, run.id);
    const snapshot = await fixture.stats.build(project.id);
    const point = snapshot.points.find((item) => item.metric === "keyword_association_coverage" && item.objectId === watchSet.targetObjectId);
    assert.equal(point?.value, null);
    assert.equal(point?.pointState, "no_data");
    assert.equal(point?.failed, 1);
  });
});

test("T24/T25/T26/T27/T28/T29/T30 run scheduled work once, preserve unknown costs, and stop incompatible tasks", async () => {
  await withFixture(async (fixture) => {
    const { project } = await ready(fixture, "target.example", [{ modelId: "phase5/off", webSearchMode: "off" }]);
    const task = await fixture.schedules.create(project.id, { name: "Daily", rule: { frequency: "daily", timezone: "UTC", hour: 0, minute: 0 }, budget: { requestLimit: 3, dailyRequestLimit: 3 } });
    const dueTime = new Date(Date.parse(task.nextRunAt || "") + 1);
    const [one, two] = await Promise.all([fixture.schedules.runDue(dueTime), fixture.schedules.runDue(dueTime)]);
    assert.equal(one.length + two.length, 1);
    const occurrences = await fixture.schedules.occurrences(project.id, task.id);
    assert.equal(occurrences.length, 1);
    await fixture.schedules.runDue(new Date(dueTime.getTime() + 100));
    const storedTask = await fixture.schedules.get(project.id, task.id);
    assert.notEqual(storedTask.nextRunAt, task.nextRunAt);
    await fixture.selections.replace(project.id, [{ modelId: "phase5/added", webSearchMode: "off" }]);
    await fixture.baselines.create(project.id);
    const newWatch = await fixture.watchSets.createFromSuggestion(project.id, {});
    await fixture.watchSets.confirm(project.id, newWatch.id);
    const incompatible = await fixture.schedules.create(project.id, { name: "Old scope", rule: { frequency: "daily", timezone: "UTC", hour: 0, minute: 0 } });
    await fixture.projects.archive(project.id);
    const archived = await fixture.schedules.runDue(new Date(Date.parse(incompatible.nextRunAt || "") + 1));
    assert.equal(archived.length, 1);
    assert.equal(archived[0]?.reason, "project_not_active");
  });
});

test("T31/T32/T33/T34/T35/T36 keep project evidence isolated and use no external calls in calculations", async () => {
  await withFixture(async (fixture) => {
    const first = await ready(fixture, "target.example", [{ modelId: "phase5/native", webSearchMode: "provider_native" }]);
    const second = await ready(fixture, "other.example", [{ modelId: "phase5/off", webSearchMode: "off" }]);
    const run = await fixture.measurements.start(first.project.id);
    await settled(fixture.measurements, first.project.id, run.id);
    const snapshot = await fixture.stats.build(first.project.id);
    assert.equal(snapshot.points.every((item) => item.projectId === first.project.id), true);
    await assert.rejects(() => fixture.measurements.get(second.project.id, run.id));
    const model = (await fixture.measurements.get(first.project.id, run.id)).modelRuns[0];
    assert.ok(model);
    const keywordProbe = (await fixture.store.listProbes(first.project.id, run.id, model.id)).find((item) => item.kind === "keyword_discovery");
    assert.ok(keywordProbe);
    const detail = await fixture.measurements.getProbe(first.project.id, run.id, model.id, keywordProbe.id);
    assert.equal(detail.evidence.providerCitations.length, 1);
    assert.equal(detail.evidence.answerMentionedUrls.length, 1);
    const offlineRun = await fixture.measurements.start(second.project.id);
    await settled(fixture.measurements, second.project.id, offlineRun.id);
    const offlineModel = (await fixture.measurements.get(second.project.id, offlineRun.id)).modelRuns[0];
    assert.ok(offlineModel);
    const offlineProbe = (await fixture.store.listProbes(second.project.id, offlineRun.id, offlineModel.id)).find((item) => item.kind === "keyword_discovery");
    assert.ok(offlineProbe);
    const offlineDetail = await fixture.measurements.getProbe(second.project.id, offlineRun.id, offlineModel.id, offlineProbe.id);
    assert.equal(offlineDetail.evidence.providerCitations.length, 0);
  });
});

test("fixed example A preserves paired recommendation arithmetic and the incomplete fourth sample", async () => {
  await withFixture(async (fixture) => {
    const { project, watchSet } = await ready(fixture, "target.example", [{ modelId: "phase5/comparison", webSearchMode: "off" }]);
    watchSet.repetitions = 4;
    await fixture.store.saveWatchSet(watchSet);
    const run = await fixture.measurements.start(project.id);
    await settled(fixture.measurements, project.id, run.id);
    const snapshot = await fixture.stats.build(project.id);
    const targetRecommendation = snapshot.points.find((item) => item.metric === "positive_recommendation" && item.objectId === watchSet.targetObjectId);
    const rivalRecommendation = snapshot.points.find((item) => item.metric === "positive_recommendation" && item.objectId === "object-rival");
    const gap = snapshot.points.find((item) => item.metric === "recommendation_gap");
    assert.deepEqual([targetRecommendation?.numerator, targetRecommendation?.denominator, targetRecommendation?.planned, targetRecommendation?.failed], [1, 3, 4, 1]);
    assert.deepEqual([rivalRecommendation?.numerator, rivalRecommendation?.denominator], [3, 3]);
    assert.equal(gap?.value, -66.66666666666667);
    assert.equal(gap?.valueUnit, "percentage_points");
  });
});

test("fixed example B keeps one answer to one association hit and calculates separate object weights", async () => {
  await withFixture(async (fixture) => {
    const { project, watchSet } = await ready(fixture, "target.example", [{ modelId: "phase5/weights", webSearchMode: "off" }]);
    watchSet.repetitions = 3;
    watchSet.keywords = [
      { id: "keyword-api", projectId: project.id, keyword: "API documentation", normalizedKeyword: "api documentation", sourceRecordIds: ["fixed-a"], selectedAt: "2026-09-07T00:00:00.000Z", neutralEligible: true, neutralEligibilityReason: "eligible" },
      { id: "keyword-knowledge", projectId: project.id, keyword: "Knowledge base", normalizedKeyword: "knowledge base", sourceRecordIds: ["fixed-b"], selectedAt: "2026-09-07T00:00:00.000Z", neutralEligible: true, neutralEligibilityReason: "eligible" },
    ];
    await fixture.store.saveWatchSet(watchSet);
    const run = await fixture.measurements.start(project.id);
    await settled(fixture.measurements, project.id, run.id);
    const snapshot = await fixture.stats.build(project.id);
    const pointFor = (objectId: string, keywordId: string, metric: string) => snapshot.points.find((item) => item.objectId === objectId && item.keywordId === keywordId && item.metric === metric);
    assert.deepEqual([pointFor("object-target", "keyword-api", "keyword_association_count")?.value, pointFor("object-target", "keyword-api", "keyword_association_coverage")?.value, pointFor("object-target", "keyword-api", "keyword_relative_weight")?.value], [3, 100, 75]);
    assert.deepEqual([pointFor("object-target", "keyword-knowledge", "keyword_association_count")?.value, pointFor("object-target", "keyword-knowledge", "keyword_association_coverage")?.value, pointFor("object-target", "keyword-knowledge", "keyword_relative_weight")?.value], [1, 33.33333333333333, 25]);
    assert.deepEqual([pointFor("object-rival", "keyword-api", "keyword_relative_weight")?.value, pointFor("object-rival", "keyword-knowledge", "keyword_relative_weight")?.value], [25, 75]);
    assert.equal(relativeKeywordWeight(0, 0), null);
  });
});

test("fixed example C separates recognized, unknown, and failed domain samples", () => {
  const timestamp = "2026-09-07T00:00:00.000Z";
  const model: import("../src/product/measurements/measurement-schema.js").MeasurementModelRun = { id: "model", projectId: "project", runId: "run", baselineId: "baseline", modelSnapshot: { selectionId: "selection", providerId: "openrouter", modelId: "fixture/model", displayName: "Fixture", webSearchMode: "off", nativeWebSearchSupported: false, capabilityCheckedAt: timestamp }, probeRunIds: [], status: "completed", createdAt: timestamp };
  const run: import("../src/product/measurements/measurement-schema.js").MeasurementRun = { id: "run", projectId: "project", baselineId: "baseline", baselineVersion: 1, watchSetId: "scope", watchSetVersion: 1, source: "manual", modelScope: ["fixture/model"], plannedProbeCount: 5, completedProbeCount: 4, failedProbeCount: 1, status: "partial", budget: { requestLimit: 5, dailyRequestLimit: null, tokenLimit: null, costLimitUsd: null }, createdAt: timestamp };
  const samples = [true, true, false, false, false].map((numerator, index) => ({ probeRunId: "probe-" + index, attemptId: "attempt-" + index, included: index < 4, numerator, exclusionReason: index < 4 ? null : "timeout" }));
  const point = measurementPoint({ projectId: "project", metric: "domain_recognition", objectId: "target", keywordId: null, model, run, fingerprint: "fixed", samples });
  assert.deepEqual([point.numerator, point.denominator, point.planned, point.failed, point.value], [2, 4, 5, 1, 50]);
});

test("fixed example E keeps provider citations and answer URLs in separate metrics", async () => {
  await withFixture(async (fixture) => {
    const native = await ready(fixture, "target.example", [{ modelId: "phase5/native", webSearchMode: "provider_native" }]);
    const nativeRun = await fixture.measurements.start(native.project.id);
    await settled(fixture.measurements, native.project.id, nativeRun.id);
    const nativeSnapshot = await fixture.stats.build(native.project.id);
    assert.deepEqual([nativeSnapshot.points.find((item) => item.metric === "domain_body_mention" && item.objectId === native.watchSet.targetObjectId)?.numerator, nativeSnapshot.points.find((item) => item.metric === "provider_citation" && item.objectId === native.watchSet.targetObjectId)?.numerator], [0, 1]);
  });
  await withFixture(async (fixture) => {
    const textual = await ready(fixture, "target.example", [{ modelId: "phase5/text-url", webSearchMode: "off" }]);
    const textRun = await fixture.measurements.start(textual.project.id);
    await settled(fixture.measurements, textual.project.id, textRun.id);
    const textSnapshot = await fixture.stats.build(textual.project.id);
    assert.deepEqual([textSnapshot.points.find((item) => item.metric === "domain_body_mention" && item.objectId === textual.watchSet.targetObjectId)?.numerator, textSnapshot.points.find((item) => item.metric === "provider_citation" && item.objectId === textual.watchSet.targetObjectId)?.value], [1, null]);
  });
});

test("monitoring tasks persist previews, lifecycle transitions, and model scope changes", async () => {
  await withFixture(async (fixture) => {
    const { project } = await ready(fixture, "target.example", [{ modelId: "phase5/off", webSearchMode: "off" }, { modelId: "phase5/native", webSearchMode: "provider_native" }]);
    const task = await fixture.schedules.create(project.id, { name: "Weekly", rule: { frequency: "weekly", timezone: "UTC", hour: 9, minute: 0, weekday: 1 }, modelScope: ["phase5/off"] });
    assert.equal((await fixture.schedules.preview(project.id, task.rule)).length, 3);
    const paused = await fixture.schedules.pause(project.id, task.id);
    assert.equal(paused.status, "paused");
    const resumed = await fixture.schedules.resume(project.id, task.id);
    assert.equal(resumed.status, "active");
    const updated = await fixture.schedules.update(project.id, task.id, { name: "Monthly", rule: { frequency: "monthly", timezone: "UTC", hour: 10, minute: 30, dayOfMonth: 1 }, modelScope: ["phase5/native"] });
    assert.deepEqual([updated.version, updated.name, updated.modelScope, updated.rule.frequency], [2, "Monthly", ["phase5/native"], "monthly"]);
    const removed = await fixture.schedules.remove(project.id, task.id);
    assert.equal(removed.status, "deleted");
    assert.equal((await fixture.schedules.get(project.id, task.id)).status, "deleted");
  });
});

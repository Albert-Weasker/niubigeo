import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProductBaselineService } from "../src/product/configuration/baseline-service.js";
import { ProductConfigurationFileStore } from "../src/product/configuration/configuration-store.js";
import { ProductModelSelectionService } from "../src/product/configuration/model-selection-service.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { RecognitionReportFileStore } from "../src/product/reports/report-store.js";
import { RecognitionReportService } from "../src/product/reports/report-service.js";
import { handleRecognitionReportApi } from "../src/product/reports/report-http.js";
import { ProductRecognitionRunService } from "../src/product/recognition/recognition-service.js";
import { ProductRecognitionFileStore } from "../src/product/recognition/recognition-store.js";
import { Phase4FixtureCatalog, Phase4FixtureExecutor } from "./fixtures/phase4-fixture-adapter.js";
import { renderProductPhase4AppHtml } from "../src/ui/product-phase4-app.js";

type Fixture = {
  root: string;
  projects: ProductProjectService;
  selections: ProductModelSelectionService;
  baselines: ProductBaselineService;
  recognitionStore: ProductRecognitionFileStore;
  recognition: ProductRecognitionRunService;
  reports: RecognitionReportService;
};

async function withFixture(run: (fixture: Fixture) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-phase4-report-"));
  const store = new ProductProjectFileStore(root);
  const projects = new ProductProjectService(store);
  const configuration = new ProductConfigurationFileStore(store);
  const selections = new ProductModelSelectionService(projects, configuration, new Phase4FixtureCatalog());
  const baselines = new ProductBaselineService(projects, selections, configuration);
  const recognitionStore = new ProductRecognitionFileStore(store);
  const recognition = new ProductRecognitionRunService(projects, baselines, recognitionStore, new Phase4FixtureExecutor());
  const reports = new RecognitionReportService(projects, baselines, recognitionStore, new RecognitionReportFileStore(store));
  try {
    await run({ root, projects, selections, baselines, recognitionStore, recognition, reports });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function settled(fixture: Fixture, projectId: string, runId: string) {
  for (let index = 0; index < 100; index += 1) {
    const detail = await fixture.recognition.get(projectId, runId);
    if (detail.run.status !== "queued" && detail.run.status !== "running") return detail;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Recognition run did not settle.");
}

async function projectWithRun(fixture: Fixture, domain: string, selections: Array<{ modelId: string; webSearchMode: "off" | "provider_native" }>) {
  const project = await fixture.projects.createDraft({ primaryDomain: domain, defaultLanguage: "zh" });
  await fixture.selections.replace(project.id, selections);
  await fixture.baselines.create(project.id);
  const start = await fixture.recognition.start(project.id);
  return { project, detail: await settled(fixture, project.id, start.run.id) };
}

async function filesWithHashes(path: string): Promise<Array<{ path: string; content: string }>> {
  const output: Array<{ path: string; content: string }> = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const target = join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      if (entry.isFile()) output.push({ path: target, content: await readFile(target, "utf8") });
    }
  };
  await visit(path);
  return output.sort((left, right) => left.path.localeCompare(right.path));
}

const standardModels = [
  { modelId: "fixture/model-a", webSearchMode: "off" as const },
  { modelId: "fixture/model-b", webSearchMode: "off" as const },
  { modelId: "fixture/model-c", webSearchMode: "provider_native" as const },
  { modelId: "fixture/model-d", webSearchMode: "off" as const },
];

test("T01 report uses only the current run and does not fill a failed model from history", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", standardModels);
    const a = detail.modelRuns.find((model) => model.modelSnapshot.modelId === "fixture/model-a");
    assert.ok(a);
    const current = await fixture.recognitionStore.readModelRun(project.id, detail.run.id, a.id);
    assert.ok(current);
    const original = await fixture.recognitionStore.readAttempt(project.id, detail.run.id, a.id, a.currentAttemptId || "");
    assert.ok(original);
    const failedAttempt = { id: randomUUID(), projectId: project.id, runId: detail.run.id, modelRunId: a.id, attemptNumber: 2, status: "provider_failed" as const, promptHash: "fixture", requestParameters: original.requestParameters, providerId: "openrouter" as const, costUsd: null, errorCode: "upstream_unavailable", errorMessage: "fixture second attempt failed", createdAt: new Date().toISOString(), completedAt: new Date().toISOString() };
    await fixture.recognitionStore.saveAttempt(failedAttempt);
    await fixture.recognitionStore.saveModelRun({ ...current, currentAttemptId: failedAttempt.id, attemptIds: [...current.attemptIds, failedAttempt.id], status: "failed", errorMessage: failedAttempt.errorMessage, errorCode: failedAttempt.errorCode, completedAt: new Date().toISOString() });
    const report = await fixture.reports.create(project.id, detail.run.id);
    const aReport = report.models.find((model) => model.modelRunId === a.id);
    assert.equal(aReport?.state, "provider_failed");
    assert.equal(aReport?.competitors, null);
    assert.equal(report.competitorGroups.some((group) => group.name === "Beacon"), false);
  });
});

test("T02 retry creates a new immutable report version without changing the original", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", standardModels);
    const first = await fixture.reports.create(project.id, detail.run.id);
    const before = JSON.stringify(first);
    const failed = detail.modelRuns.find((model) => model.modelSnapshot.modelId === "fixture/model-d");
    assert.ok(failed);
    await fixture.recognition.retry(project.id, detail.run.id, failed.id);
    const second = await fixture.reports.create(project.id, detail.run.id);
    assert.notEqual(second.reportId, first.reportId);
    assert.equal(second.reportRevision, 2);
    assert.equal(JSON.stringify(await fixture.reports.get(project.id, detail.run.id, first.reportId)), before);
    assert.equal(second.models.find((model) => model.modelRunId === failed.id)?.state, "recognized");
  });
});

test("T03 current failed attempt is never replaced by an older successful attempt", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", [{ modelId: "fixture/model-a", webSearchMode: "off" }]);
    const model = detail.modelRuns[0];
    assert.ok(model);
    const previous = await fixture.recognitionStore.readModelRun(project.id, detail.run.id, model.id);
    const earlier = previous?.currentAttemptId;
    assert.ok(previous && earlier);
    const originalAttempt = await fixture.recognitionStore.readAttempt(project.id, detail.run.id, model.id, earlier);
    assert.ok(originalAttempt);
    const failure = { ...originalAttempt, id: randomUUID(), attemptNumber: 2, status: "provider_failed" as const, rawProviderResponse: undefined, rawAnswer: undefined, errorCode: "upstream_unavailable", errorMessage: "current attempt failed", completedAt: new Date().toISOString() };
    await fixture.recognitionStore.saveAttempt(failure);
    await fixture.recognitionStore.saveModelRun({ ...previous, attemptIds: [...previous.attemptIds, failure.id], currentAttemptId: failure.id, status: "failed", errorCode: failure.errorCode, errorMessage: failure.errorMessage });
    const report = await fixture.reports.create(project.id, detail.run.id);
    assert.equal(report.models[0]?.sourceAttemptId, failure.id);
    assert.equal(report.models[0]?.state, "provider_failed");
  });
});

test("T04 analysis failure keeps the raw answer but marks fields unavailable", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", [{ modelId: "fixture/model-analysis-failed", webSearchMode: "off" }]);
    const report = await fixture.reports.create(project.id, detail.run.id);
    assert.equal(report.models[0]?.state, "analysis_failed");
    assert.equal(report.models[0]?.rawAnswer, "模型返回的非结构化原文 😀");
    assert.equal(report.models[0]?.competitors, null);
    assert.equal(report.models[0]?.brandKeywords, null);
  });
});

test("T05 a malformed current archive is an evidence integrity error and not an empty result", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", [{ modelId: "fixture/model-a", webSearchMode: "off" }]);
    const model = detail.modelRuns[0];
    assert.ok(model?.currentAttemptId);
    const path = join(fixture.root, "projects", project.id, "recognition-runs", detail.run.id, "model-runs", model.id, "recognition-archives", `${model.currentAttemptId}.json`);
    const archive = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    delete archive.competitors;
    await writeFile(path, `${JSON.stringify(archive)}\n`, "utf8");
    const report = await fixture.reports.create(project.id, detail.run.id);
    assert.equal(report.models[0]?.state, "evidence_integrity_error");
    assert.equal(report.models[0]?.competitors, null);
  });
});

test("T06 exact entity grouping keeps same-name different-host records separate", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", standardModels);
    const report = await fixture.reports.create(project.id, detail.run.id);
    assert.deepEqual(report.competitorGroups.map((group) => [group.name, group.host, group.sourceRecordIds.length]), [["Beacon", "beacon.example", 1], ["Forge", "forge-alt.example", 1], ["Forge", "forge.example", 2]]);
  });
});

test("T07 brand and competitor keywords remain attached to their original records", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", standardModels);
    const report = await fixture.reports.create(project.id, detail.run.id);
    const c = report.models.find((model) => model.modelId === "fixture/model-c");
    assert.ok(c);
    const alt = c.competitors?.find((item) => item.domain === "forge-alt.example");
    assert.ok(alt);
    assert.deepEqual(c.competitorKeywords?.filter((keyword) => keyword.competitorRecordId === alt.id).map((keyword) => keyword.keyword), ["团队协作"]);
    assert.equal(c.brandKeywords?.some((keyword) => keyword.keyword === "开源文档"), false);
  });
});

test("T08 citations remain separate from answer URLs and an invalid payload path is rejected", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", standardModels);
    const first = await fixture.reports.create(project.id, detail.run.id);
    const c = first.models.find((model) => model.modelId === "fixture/model-c");
    assert.equal(c?.providerCitations?.length, 1);
    assert.equal(c?.answerMentionedUrls?.length, 1);
    const rawModel = detail.modelRuns.find((model) => model.modelSnapshot.modelId === "fixture/model-c");
    assert.ok(rawModel?.currentAttemptId);
    const path = join(fixture.root, "projects", project.id, "recognition-runs", detail.run.id, "model-runs", rawModel.id, "recognition-archives", `${rawModel.currentAttemptId}.json`);
    const archive = JSON.parse(await readFile(path, "utf8")) as { providerCitations: Array<{ providerPayloadPath: string }> };
    archive.providerCitations[0]!.providerPayloadPath = "choices[0].message.missing[0].url";
    await writeFile(path, `${JSON.stringify(archive)}\n`, "utf8");
    const second = await fixture.reports.create(project.id, detail.run.id);
    assert.equal(second.models.find((model) => model.modelId === "fixture/model-c")?.state, "evidence_integrity_error");
  });
});

test("T09 report routes scope reports and model views to the owning project", async () => {
  await withFixture(async (fixture) => {
    const first = await projectWithRun(fixture, "target.example", [{ modelId: "fixture/model-a", webSearchMode: "off" }]);
    const second = await fixture.projects.createDraft({ primaryDomain: "other.example" });
    const report = await fixture.reports.create(first.project.id, first.detail.run.id);
    await assert.rejects(() => fixture.reports.get(second.id, first.detail.run.id, report.reportId));
    await assert.rejects(() => fixture.reports.getModel(first.project.id, first.detail.run.id, report.reportId, "other-model"));
  });
});

test("T10 concurrent report requests create one logical report version", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", [{ modelId: "fixture/model-a", webSearchMode: "off" }]);
    const reports = await Promise.all([fixture.reports.create(project.id, detail.run.id), fixture.reports.create(project.id, detail.run.id), fixture.reports.create(project.id, detail.run.id)]);
    assert.equal(new Set(reports.map((report) => report.reportId)).size, 1);
    assert.equal((await fixture.reports.list(project.id, detail.run.id)).length, 1);
  });
});

test("T11 an active recognition run cannot publish a mixed report snapshot", async () => {
  await withFixture(async (fixture) => {
    const project = await fixture.projects.createDraft({ primaryDomain: "target.example" });
    await fixture.selections.replace(project.id, [{ modelId: "fixture/model-a", webSearchMode: "off" }]);
    await fixture.baselines.create(project.id);
    const created = await fixture.recognition.start(project.id);
    await assert.rejects(() => fixture.reports.create(project.id, created.run.id));
    await settled(fixture, project.id, created.run.id);
  });
});

test("T12 a report survives a fresh service instance with fixed source mappings", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", [{ modelId: "fixture/model-a", webSearchMode: "off" }]);
    const created = await fixture.reports.create(project.id, detail.run.id);
    const store = new ProductProjectFileStore(fixture.root);
    const projects = new ProductProjectService(store);
    const configuration = new ProductConfigurationFileStore(store);
    const service = new RecognitionReportService(projects, new ProductBaselineService(projects, new ProductModelSelectionService(projects, configuration, new Phase4FixtureCatalog()), configuration), new ProductRecognitionFileStore(store), new RecognitionReportFileStore(store));
    const restored = await service.get(project.id, detail.run.id, created.reportId);
    assert.equal(restored.sourceFingerprint, created.sourceFingerprint);
    assert.deepEqual(restored.sourceAttemptMap, created.sourceAttemptMap);
  });
});

test("T13 report creation writes only the derived reports directory", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", standardModels);
    const runRoot = join(fixture.root, "projects", project.id, "recognition-runs", detail.run.id);
    const before = await filesWithHashes(runRoot);
    await fixture.reports.create(project.id, detail.run.id);
    const after = await filesWithHashes(runRoot);
    const originalAfter = after.filter((entry) => !entry.path.includes(`${join("reports")}/`));
    assert.deepEqual(originalAfter, before);
    assert.equal(after.some((entry) => entry.path.includes(`${join("reports")}/`)), true);
  });
});

test("T14 provider output stays untrusted in report storage", async () => {
  await withFixture(async (fixture) => {
    const { project, detail } = await projectWithRun(fixture, "target.example", [{ modelId: "fixture/model-a", webSearchMode: "off" }]);
    const model = detail.modelRuns[0];
    assert.ok(model?.currentAttemptId);
    const attempt = await fixture.recognitionStore.readAttempt(project.id, detail.run.id, model.id, model.currentAttemptId);
    assert.ok(attempt);
    await fixture.recognitionStore.saveAttempt({ ...attempt, rawAnswer: "<script>window.fixtureExecuted=true</script> https://ordinary.example/targetdocs", rawProviderResponse: { authorization: "private", body: "<img src=https://remote.example/image>" } });
    const report = await fixture.reports.create(project.id, detail.run.id);
    assert.equal(report.models[0]?.rawProviderResponse && (report.models[0].rawProviderResponse as Record<string, unknown>).authorization, "[redacted]");
    assert.equal(report.models[0]?.rawAnswer?.includes("<script>"), true);
  });
});

test("T15 empty, all-unknown, all-failed, and unsupported runs retain their distinct states", async () => {
  await withFixture(async (fixture) => {
    const unknown = await projectWithRun(fixture, "unknown.example", [{ modelId: "fixture/model-b", webSearchMode: "off" }]);
    assert.equal((await fixture.reports.create(unknown.project.id, unknown.detail.run.id)).models[0]?.state, "unknown");
    const failed = await projectWithRun(fixture, "failed.example", [{ modelId: "fixture/model-d", webSearchMode: "off" }]);
    assert.equal((await fixture.reports.create(failed.project.id, failed.detail.run.id)).models[0]?.state, "provider_failed");
    const unsupported = await projectWithRun(fixture, "unsupported.example", [{ modelId: "fixture/model-unsupported", webSearchMode: "provider_native" }]);
    assert.equal((await fixture.reports.create(unsupported.project.id, unsupported.detail.run.id)).models[0]?.state, "unsupported");
  });
});

test("T16 report preserves each supported stage three state without collapsing it to not-recognized", async () => {
  await withFixture(async (fixture) => {
    const set = [
      { modelId: "fixture/model-a", webSearchMode: "off" as const },
      { modelId: "fixture/model-b", webSearchMode: "off" as const },
      { modelId: "fixture/model-analysis-failed", webSearchMode: "off" as const },
      { modelId: "fixture/model-d", webSearchMode: "off" as const },
    ];
    const { project, detail } = await projectWithRun(fixture, "target.example", set);
    const report = await fixture.reports.create(project.id, detail.run.id);
    assert.deepEqual(new Set(report.models.map((model) => model.state)), new Set(["recognized", "unknown", "analysis_failed", "provider_failed"]));
    assert.equal(report.models.some((model) => model.state === "not_recognized"), false);
  });
});

test("Phase 4 product entry does not activate legacy monitoring, dashboard, or timeseries modules", async () => {
  const server = await readFile(join(process.cwd(), "src", "product", "product-server.ts"), "utf8");
  const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts.server, "tsx src/product/product-server.ts");
  for (const moduleName of ["monitoring", "dashboard", "timeseries"]) {
    assert.equal(server.includes(`/${moduleName}/`), false);
    assert.equal(server.includes(`/${moduleName}.`), false);
  }
});

test("report HTTP handler matches recognition-runs route not legacy runs route", async () => {
  const mockService = {
    async create(_projectId: string, _runId: string) {
      return { reportId: "r1", reportRevision: 1, models: [], competitorGroups: [], modelsSummary: [] };
    },
    async list(_projectId: string, _runId: string) {
      return [{ reportId: "r1", reportRevision: 1 }];
    },
    async get(_projectId: string, _runId: string, _reportId: string) {
      return { reportId: "r1", reportRevision: 1, models: [], competitorGroups: [], modelsSummary: [], sourceFingerprint: "", sourceAttemptMap: [] };
    },
    async getModel(_projectId: string, _runId: string, _reportId: string, _modelRunId: string) {
      return { modelId: "m1" };
    },
  } as unknown as RecognitionReportService;
  let handled = false;
  const send = (status: number, body: unknown) => { handled = true; };

  const recognitionRunsRoute = ["api", "projects", "proj-1", "recognition-runs", "run-1", "reports"];
  const result1 = await handleRecognitionReportApi({ method: "GET", route: recognitionRunsRoute, service: mockService, send });
  assert.equal(result1, true, "recognition-runs route should be handled");

  const legacyRunsRoute = ["api", "projects", "proj-1", "runs", "run-1", "reports"];
  const result2 = await handleRecognitionReportApi({ method: "GET", route: legacyRunsRoute, service: mockService, send });
  assert.equal(result2, false, "legacy runs route should NOT be handled");
});

test("phase 4 report page requests the recognition-runs report route", () => {
  const html = renderProductPhase4AppHtml();
  assert.equal(html.includes("/recognition-runs/"), true);
  assert.equal(html.includes('"/api/projects/" + encodeURIComponent(selected.id) + "/runs/"'), false);
});

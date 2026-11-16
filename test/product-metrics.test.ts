import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { customModelId } from "../src/product/connections/provider-connections.js";
import { keywordRunSummary } from "../src/product/keyword-monitor-insights.js";
import type { KeywordModelResult, KeywordMonitorRun } from "../src/product/keyword-monitor-schema.js";
import { KeywordMonitorService } from "../src/product/keyword-monitor-service.js";
import { KeywordMonitorStore } from "../src/product/keyword-monitor-store.js";
import { collectProductMetrics } from "../src/product/metrics/product-metrics.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { WorkerStatusStore } from "../src/product/scheduling/worker-status.js";
import { sha256 } from "../src/utils/hash.js";

async function metricsFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "product-metrics-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projectStore = new ProductProjectFileStore(root);
  const projects = new ProductProjectService(projectStore);
  const keywords = new KeywordMonitorStore(projectStore);
  const monitors = new KeywordMonitorService(projects, keywords);
  const workers = new WorkerStatusStore(root);
  const collect = (includeNames = false) => collectProductMetrics({ projects, keywords, workers }, { version: "1.2.3", includeNames });
  return { projects, keywords, monitors, workers, collect };
}

test("metrics use saved retry summaries, count runs and aggregate worker states", async t => {
  const { projects, keywords, monitors, workers, collect } = await metricsFixture(t);

  const empty = (await collect()).split("\n");
  assert.ok(empty.includes('niubigeo_build_info{version="1.2.3"} 1'));
  assert.ok(empty.includes("niubigeo_projects 0"));
  for (const state of ["running", "stale", "stopped", "failed"]) {
    assert.ok(empty.includes(`niubigeo_workers{state="${state}"} 0`));
  }
  assert.ok(!empty.some(line => line.startsWith("niubigeo_worker_last_heartbeat_timestamp_seconds")));

  const project = await projects.createDraft({ primaryDomain: "metrics-project.example" });
  const monitor = await monitors.create(project.id, { keyword: "Private keyword", frequency: "weekly" });
  await monitors.update(project.id, monitor.id, { enabled: false });
  await projects.archive(project.id);
  const endpoint = "https://private-endpoint.example/v1";
  const custom = customModelId(endpoint, "local-chat");
  const publicId = "vendor/catalog-model";
  const failedId = "vendor/failed-model";
  const sample: KeywordModelResult = {
    modelId: publicId, modelName: "Catalog model", answer: "Private answer",
    mentioned: ["Brand"], recommended: [], position: 0, citations: ["https://citation.example/"],
  };
  const original: KeywordMonitorRun = {
    id: "original", projectId: project.id, monitorId: monitor.id, status: "completed",
    keyword: monitor.keyword, startedAt: "2026-01-01T00:00:00Z", mentioned: [], positions: {},
    modelResults: [sample, { ...sample, modelId: custom, modelName: "Custom", error: "Private error" }],
  };
  const retry: KeywordMonitorRun = {
    ...original, id: "retry", startedAt: "2026-01-02T00:00:00Z", retryOfRunId: original.id, retryModelId: custom,
    modelResults: [
      { ...sample, sampleIndex: 1, carriedFromRunId: original.id },
      { ...sample, sampleIndex: 2, mentioned: [], position: null, carriedFromRunId: original.id },
      { ...sample, sampleIndex: 3, error: "Private error", carriedFromRunId: original.id },
      { ...sample, modelId: failedId, error: "Private error", carriedFromRunId: original.id },
      { ...sample, modelId: custom, modelName: "local-chat · " + endpoint, position: null },
    ],
  };
  await keywords.saveRun(original);
  await keywords.saveRun(retry);
  await keywords.saveRun({ ...original, id: "failed", startedAt: "2026-01-01T12:00:00Z", status: "failed", modelResults: [] });
  await keywords.saveRun({ ...original, id: "queued", startedAt: "2026-01-04T00:00:00Z", status: "queued" });

  const at = new Date();
  await workers.write({ id: "running-worker", state: "running", heartbeatAt: at.toISOString(), pollSeconds: 60 });
  await workers.write({ id: "stale-worker", state: "running", heartbeatAt: new Date(at.getTime() - 300_000).toISOString(), pollSeconds: 60 });
  await workers.write({ id: "stopped-worker", state: "stopped", heartbeatAt: new Date(at.getTime() - 1000).toISOString(), pollSeconds: 60 });
  await workers.write({ id: "failed-worker", state: "failed", heartbeatAt: new Date(at.getTime() - 2000).toISOString(), pollSeconds: 60 });
  assert.equal((await workers.read(at)).state, "running");
  assert.deepEqual((await workers.readAll(at)).map(row => row.state).sort(), ["failed", "running", "stale", "stopped"]);

  const body = await collect();
  const lines = body.split("\n");
  const monitorLabels = `monitor_id="${monitor.id}",project_id="${project.id}"`;
  assert.equal(await collect(), body);
  assert.ok(lines.includes("niubigeo_projects 1"));
  assert.ok(lines.includes(`niubigeo_keyword_monitors{project_id="${project.id}",state="disabled"} 1`));
  assert.ok(lines.includes(`niubigeo_keyword_monitors{project_id="${project.id}",state="enabled"} 0`));
  for (const [status, count] of Object.entries({ completed: 2, failed: 1, queued: 1 })) {
    assert.ok(lines.includes(`niubigeo_keyword_runs{${monitorLabels},status="${status}"} ${count}`));
  }
  assert.ok(lines.includes(`niubigeo_keyword_last_run_timestamp_seconds{${monitorLabels}} ${Date.parse(retry.startedAt) / 1000}`));

  const exportedCustomId = "custom-" + sha256(custom).slice(0, 12);
  for (const summary of keywordRunSummary(retry)) {
    const modelId = summary.modelId === custom ? exportedCustomId : summary.modelId;
    const labels = `{model_id="${modelId}",${monitorLabels}}`;
    assert.ok(lines.includes(`niubigeo_keyword_model_errors${labels} ${summary.failed}`));
    const ratio = "niubigeo_keyword_mention_ratio" + labels + " ";
    assert.equal(lines.find(line => line.startsWith(ratio)), summary.mentionRate === null ? undefined : ratio + summary.mentionRate);
  }
  assert.deepEqual(lines.filter(line => line.startsWith("niubigeo_keyword_best_position")), [
    `niubigeo_keyword_best_position{model_id="${publicId}",${monitorLabels}} 1`,
  ]);
  assert.ok(lines.includes(`niubigeo_worker_last_heartbeat_timestamp_seconds ${at.getTime() / 1000}`));
  for (const state of ["running", "stale", "stopped", "failed"]) {
    assert.ok(lines.includes(`niubigeo_workers{state="${state}"} 1`));
  }
  for (const text of [project.primaryDomain, monitor.keyword, sample.modelName, "local-chat", "worker_id"]) {
    assert.ok(!body.includes(text));
  }
  const named = await collect(true);
  assert.ok(named.includes(`niubigeo_project_info{domain="${project.primaryDomain}",project_id="${project.id}"} 1`));
  assert.ok(named.includes(`niubigeo_keyword_monitor_info{frequency="weekly",keyword="${monitor.keyword}",kind="discovery",monitor_id="${monitor.id}"} 1`));
  assert.ok(named.includes(`niubigeo_model_info{model_id="${exportedCustomId}",model_name="local-chat"} 1`));
  assert.ok(named.includes(`niubigeo_model_info{model_id="${publicId}",model_name="${sample.modelName}"} 1`));
  for (const text of [endpoint, custom, sample.answer, sample.citations[0]!, "Private error"]) {
    assert.ok(!named.includes(text));
  }
});

async function observedMonitor(t: TestContext) {
  const { projects, keywords, monitors, collect } = await metricsFixture(t);
  const project = await projects.createDraft({ primaryDomain: "finished-run.example" });
  const monitor = await monitors.create(project.id, { keyword: "Keyword", brandName: "Brand" });
  const sample: KeywordModelResult = {
    modelId: "vendor/model", modelName: "Model", answer: "Brand",
    mentioned: ["Brand"], recommended: ["Brand"], position: 0, citations: [],
  };
  const completed: KeywordMonitorRun = {
    id: "completed", projectId: project.id, monitorId: monitor.id, keyword: monitor.keyword,
    status: "completed", startedAt: "2026-01-01T00:00:00Z",
    mentioned: ["Brand"], positions: { [sample.modelId]: 0 }, modelResults: [sample],
  };
  await keywords.saveRun(completed);
  const labels = `monitor_id="${monitor.id}",project_id="${project.id}"`;
  return { keywords, collect, sample, completed, labels };
}

test("latest finished run with only errors replaces the older mention and rank with an error count", async t => {
  const { keywords, collect, sample, completed, labels } = await observedMonitor(t);
  const error: KeywordModelResult = { ...sample, answer: "", mentioned: [], recommended: [], position: null, error: "Timeout" };
  await keywords.saveRun({
    ...completed, id: "failed", status: "failed", startedAt: "2026-01-02T00:00:00Z",
    mentioned: [], positions: { [sample.modelId]: null },
    modelResults: [{ ...error, sampleIndex: 1 }, { ...error, sampleIndex: 2 }],
  });

  const lines = (await collect()).split("\n");
  const modelLabels = `{model_id="${sample.modelId}",${labels}}`;
  assert.ok(!lines.some(line => line.startsWith("niubigeo_keyword_mention_ratio" + modelLabels)));
  assert.ok(!lines.some(line => line.startsWith("niubigeo_keyword_best_position" + modelLabels)));
  assert.ok(lines.includes(`niubigeo_keyword_model_errors${modelLabels} 2`));
});

test("latest finished run with no samples exposes a failed run count and timestamp only", async t => {
  const { keywords, collect, completed, labels } = await observedMonitor(t);
  const failed: KeywordMonitorRun = {
    ...completed, id: "failed", status: "failed", startedAt: "2026-01-02T00:00:00Z",
    completedAt: "2026-01-02T00:01:00Z", mentioned: [], positions: {}, error: "Setup failed",
  };
  delete failed.modelResults;
  await keywords.saveRun(failed);

  const lines = (await collect()).split("\n");
  assert.ok(!lines.some(line => line.startsWith("niubigeo_keyword_") && line.includes("model_id=")));
  assert.ok(lines.includes(`niubigeo_keyword_runs{${labels},status="failed"} 1`));
  assert.ok(lines.includes(`niubigeo_keyword_last_run_timestamp_seconds{${labels}} ${Date.parse(failed.completedAt!) / 1000}`));
});

test("an unranked successful sample has a mention ratio and no ranking series", async t => {
  const { keywords, collect, sample, completed, labels } = await observedMonitor(t);
  const unranked: KeywordModelResult = { ...sample, modelId: "vendor/unranked", position: null };
  await keywords.saveRun({
    ...completed,
    positions: { ...completed.positions, [unranked.modelId]: null },
    modelResults: [sample, unranked],
  });

  const lines = (await collect()).split("\n");
  const modelLabels = `{model_id="${unranked.modelId}",${labels}}`;
  assert.ok(lines.includes(`niubigeo_keyword_mention_ratio${modelLabels} 1`));
  assert.ok(!lines.some(line => line.startsWith("niubigeo_keyword_best_position" + modelLabels)));
});

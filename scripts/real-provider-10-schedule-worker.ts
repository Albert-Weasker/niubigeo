import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ProductBaselineService } from "../src/product/configuration/baseline-service.js";
import { ProductConfigurationFileStore } from "../src/product/configuration/configuration-store.js";
import { ProductModelSelectionService } from "../src/product/configuration/model-selection-service.js";
import { ProductMeasurementRunService } from "../src/product/measurements/measurement-service.js";
import { ProductMeasurementFileStore } from "../src/product/measurements/measurement-store.js";
import { ProductWatchSetService } from "../src/product/measurements/watchset-service.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductRecognitionFileStore } from "../src/product/recognition/recognition-store.js";
import { RecognitionReportFileStore } from "../src/product/reports/report-store.js";
import { ProductScheduleService } from "../src/product/scheduling/schedule-service.js";
import { ProductScheduleFileStore } from "../src/product/scheduling/schedule-store.js";
import { FrozenModelCatalog, LedgeredRecognitionExecutor, readJson, readOpenRouterCatalog, writeJson, type CatalogModel, type CycleCaseReference, type ProviderLedger } from "./real-provider-10-support.js";

type IndexCase = { caseId: string; projectId: string; domain: string; scheduledRunId?: string; scheduledStatus?: string; scheduledCompletedAt?: string | null; scheduledTaskId?: string };
type CaseIndex = { cycleId: string; cases: IndexCase[] };
type Policy = { offline: { modelId: string }; online: { modelId: string } };

const root = process.cwd();
const cycleId = process.env.NIUBIGEO_REAL_PROVIDER_CYCLE || "real-provider-10-2026-09-07-final";
const validationRoot = join(root, "validation", cycleId);
const productDataRoot = join(validationRoot, "product-data");
const ledgerPath = join(validationRoot, "provider-ledger.json");
const indexPath = join(validationRoot, "case-index.json");
const policyPath = join(root, "examples", "real-provider-10", "model-policy.json");

function now(): string { return new Date().toISOString(); }
function wait(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

function scheduleRule(start: Date): { frequency: "custom"; timezone: string; cron: string } {
  return {
    frequency: "custom",
    timezone: "UTC",
    cron: `0 ${start.getUTCMinutes()} ${start.getUTCHours()} * * *`,
  };
}

function modelMap(all: CatalogModel[], policy: Policy): Map<string, CatalogModel> {
  const byId = new Map(all.map((model) => [model.modelId, model]));
  const offline = byId.get(policy.offline.modelId);
  const online = byId.get(policy.online.modelId);
  if (!offline || !online) throw new Error("A frozen real Provider model is no longer listed by OpenRouter.");
  if (!online.supportedParameters.includes("tools") || online.pricing.webSearchPerRequest <= 0) throw new Error("The frozen online model no longer has catalog evidence for tool search.");
  return new Map([[offline.modelId, offline], [online.modelId, online]]);
}

async function main(): Promise<void> {
  const index = await readJson<CaseIndex>(indexPath);
  const policy = await readJson<Policy>(policyPath);
  const all = await readOpenRouterCatalog();
  const models = modelMap(all, policy);
  const references = new Map<string, CycleCaseReference>();
  const purposes = new Map<string, "scheduled_measurement">();
  for (const entry of index.cases) {
    references.set(entry.projectId, { caseId: entry.caseId, projectId: entry.projectId });
    purposes.set(entry.projectId, "scheduled_measurement");
  }
  const executor = new LedgeredRecognitionExecutor(ledgerPath, models, references, purposes);
  const projectStore = new ProductProjectFileStore(productDataRoot);
  const projects = new ProductProjectService(projectStore);
  const configuration = new ProductConfigurationFileStore(projectStore);
  const catalog = new FrozenModelCatalog([...models.values()]);
  const selections = new ProductModelSelectionService(projects, configuration, catalog);
  const baselines = new ProductBaselineService(projects, selections, configuration);
  const measurementStore = new ProductMeasurementFileStore(projectStore);
  const recognition = new ProductRecognitionFileStore(projectStore);
  const reports = new RecognitionReportFileStore(projectStore);
  const watchSets = new ProductWatchSetService(projects, baselines, measurementStore, recognition, reports);
  const measurements = new ProductMeasurementRunService(projects, baselines, watchSets, measurementStore, executor);
  const schedules = new ProductScheduleService(projects, baselines, watchSets, measurements, new ProductScheduleFileStore(projectStore));
  const start = new Date(Math.ceil((Date.now() + 120000) / 60000) * 60000);
  const rule = scheduleRule(start);
  const tasks: Array<{ caseId: string; projectId: string; taskId: string; scheduledFor: string | null }> = [];
  for (const entry of index.cases) {
    const task = await schedules.create(entry.projectId, {
      name: `Validation scheduled measurement ${entry.caseId}`,
      rule,
      modelScope: [policy.offline.modelId, policy.online.modelId],
      budget: { requestLimit: 6, dailyRequestLimit: 6 },
    });
    entry.scheduledTaskId = task.id;
    tasks.push({ caseId: entry.caseId, projectId: entry.projectId, taskId: task.id, scheduledFor: task.nextRunAt });
  }
  await writeJson(indexPath, index);
  await writeJson(join(validationRoot, "schedule-start.json"), { startedAt: now(), tasks, worker: "scripts/real-provider-10-schedule-worker.ts", actualSystemTime: new Date().toISOString() });
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    await schedules.runDue(new Date());
    let allFinished = true;
    for (const task of tasks) {
      const occurrences = await schedules.occurrences(task.projectId, task.taskId);
      const occurrence = occurrences[0];
      if (!occurrence || occurrence.status === "planned" || occurrence.status === "started") allFinished = false;
      if (occurrence?.runId) {
        const detail = await measurements.get(task.projectId, occurrence.runId);
        if (detail.run.status === "queued" || detail.run.status === "running") allFinished = false;
        const entry = index.cases.find((value) => value.projectId === task.projectId);
        if (entry) {
          entry.scheduledRunId = detail.run.id;
          entry.scheduledStatus = detail.run.status;
          entry.scheduledCompletedAt = detail.run.completedAt || null;
        }
      }
    }
    await writeJson(indexPath, index);
    if (allFinished) break;
    await wait(5000);
  }
  const evidence = [];
  for (const task of tasks) {
    const occurrences = await schedules.occurrences(task.projectId, task.taskId);
    const paused = await schedules.pause(task.projectId, task.taskId);
    evidence.push({ ...task, occurrences, pausedStatus: paused.status, nextRunAtAfterPause: paused.nextRunAt });
  }
  await writeJson(indexPath, index);
  const ledger = await readJson<ProviderLedger>(ledgerPath);
  await mkdir(validationRoot, { recursive: true });
  await writeJson(join(validationRoot, "schedule-evidence.json"), { completedAt: now(), actualSystemTime: new Date().toISOString(), tasks: evidence, scheduledLedgerEntries: ledger.entries.filter((entry) => entry.purpose === "scheduled_measurement") });
  const unfinished = evidence.filter((entry) => entry.occurrences.length !== 1 || entry.occurrences[0]?.status !== "completed");
  if (unfinished.length > 0) throw new Error(`The real schedule worker did not complete every scheduled occurrence: ${unfinished.map((entry) => entry.caseId).join(", ")}`);
}

main().catch(async (error) => {
  await writeJson(join(validationRoot, "schedule-error.json"), { failedAt: now(), error: error instanceof Error ? error.stack || error.message : String(error) });
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});

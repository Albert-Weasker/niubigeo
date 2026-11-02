import { randomUUID } from "node:crypto";
import { WorkerStatusStore, type WorkerHeartbeat } from "./worker-status.js";
import { pathToFileURL } from "node:url";
import { loadDotEnv, productDataDir } from "../../config/env.js";
import { PROVIDER_MODEL_CAPABILITIES } from "../../providers/catalog.js";
import { ProductBaselineService } from "../configuration/baseline-service.js";
import { ProductConfigurationFileStore } from "../configuration/configuration-store.js";
import { OpenRouterProductModelCatalog } from "../configuration/model-catalog.js";
import { ProductModelSelectionService } from "../configuration/model-selection-service.js";
import { ProductMeasurementRunService } from "../measurements/measurement-service.js";
import { ProductMeasurementFileStore } from "../measurements/measurement-store.js";
import { ProductProjectService } from "../projects/project-service.js";
import { ProductProjectFileStore } from "../projects/project-store.js";
import { ProductRecognitionFileStore } from "../recognition/recognition-store.js";
import { RecognitionReportFileStore } from "../reports/report-store.js";
import { ProductScheduleService } from "./schedule-service.js";
import { ProductScheduleFileStore } from "./schedule-store.js";
import { ProductWatchSetService } from "../measurements/watchset-service.js";
import { KeywordMonitorStore } from "../keyword-monitor-store.js";
import { KeywordMonitorService } from "../keyword-monitor-service.js";
import { OpenRouterRecognitionAnswerExecutor } from "../recognition/recognition-service.js";

export function productKeywordMonitorService(): KeywordMonitorService { const projectStore=new ProductProjectFileStore(productDataDir()); const projects=new ProductProjectService(projectStore); const configurationStore=new ProductConfigurationFileStore(projectStore); const selections=new ProductModelSelectionService(projects,configurationStore,new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES)); const baselines=new ProductBaselineService(projects,selections,configurationStore); return new KeywordMonitorService(projects,new KeywordMonitorStore(projectStore),baselines,new OpenRouterRecognitionAnswerExecutor()); }

export function productScheduleService(): ProductScheduleService {
  const projectStore = new ProductProjectFileStore(productDataDir());
  const projects = new ProductProjectService(projectStore);
  const configurationStore = new ProductConfigurationFileStore(projectStore);
  const selections = new ProductModelSelectionService(projects, configurationStore, new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES));
  const baselines = new ProductBaselineService(projects, selections, configurationStore);
  const measurementStore = new ProductMeasurementFileStore(projectStore);
  const recognitionStore = new ProductRecognitionFileStore(projectStore);
  const reportStore = new RecognitionReportFileStore(projectStore);
  const watchSets = new ProductWatchSetService(projects, baselines, measurementStore, recognitionStore, reportStore);
  const measurements = new ProductMeasurementRunService(projects, baselines, watchSets, measurementStore);
  return new ProductScheduleService(projects, baselines, watchSets, measurements, new ProductScheduleFileStore(projectStore));
}

export async function runProductScheduleDue(): Promise<Awaited<ReturnType<ProductScheduleService["runDue"]>>> {
  return productScheduleService().runDue();
}

export async function runProductScheduleWorker(pollSeconds = 60): Promise<void> {
  if (!Number.isInteger(pollSeconds) || pollSeconds < 10) throw new Error("Poll seconds must be an integer of at least 10.");
  const service = productScheduleService();
  const keywordService = productKeywordMonitorService();
  let stopped = false;
  const stop = () => { stopped = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const store=new WorkerStatusStore(productDataDir());
  const heartbeat:WorkerHeartbeat={id:randomUUID(),heartbeatAt:new Date().toISOString(),pollSeconds,state:"running"};
  let writes=Promise.resolve();
  const publish=()=>{const snapshot={...heartbeat,heartbeatAt:new Date().toISOString()};writes=writes.catch(()=>{}).then(()=>store.write(snapshot));return writes};
  await publish();
  const timer=setInterval(()=>{void publish().catch(()=>{console.error("Worker heartbeat could not be saved.")})},Math.min(10000,pollSeconds*1000));
  try { while (!stopped) {
    try {
    const occurrences = await service.runDue();
    const keywordRuns = await keywordService.runDue();
    if (keywordRuns.length) console.log(JSON.stringify({ type: "keyword_monitor_due", runCount: keywordRuns.length, runIds: keywordRuns.map((item) => item.id) }));
    if (occurrences.length) console.log(JSON.stringify({ type: "product_schedule_due", occurrenceCount: occurrences.length, occurrenceIds: occurrences.map((item) => item.id) }));
    heartbeat.lastResult=occurrences.some(row=>row.status!=="completed")||keywordRuns.some(run=>run.status==="failed"||run.modelResults?.some(row=>row.error))?"failed":"completed";
    if(occurrences.length||keywordRuns.length){heartbeat.lastExecutionAt=new Date().toISOString();heartbeat.lastExecutionResult=heartbeat.lastResult;}
    } catch(error) {heartbeat.lastResult="failed";console.error("Monitoring cycle failed.");}
    heartbeat.lastCycleAt=new Date().toISOString();await publish().catch(()=>{console.error("Worker heartbeat could not be saved; scheduling continues.")});
    await new Promise<void>((resolve) => setTimeout(resolve, pollSeconds * 1000));
  }} finally {clearInterval(timer);process.removeListener("SIGINT",stop);process.removeListener("SIGTERM",stop);heartbeat.state="stopped";await publish();}
}

loadDotEnv();
const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  const argument = process.argv[2];
  const parsed = argument === undefined ? 60 : Number(argument);
  runProductScheduleWorker(parsed).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}

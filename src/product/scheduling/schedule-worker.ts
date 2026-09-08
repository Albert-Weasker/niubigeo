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
  let stopped = false;
  const stop = () => { stopped = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  while (!stopped) {
    const occurrences = await service.runDue();
    if (occurrences.length) console.log(JSON.stringify({ type: "product_schedule_due", occurrenceCount: occurrences.length, occurrenceIds: occurrences.map((item) => item.id) }));
    await new Promise<void>((resolve) => setTimeout(resolve, pollSeconds * 1000));
  }
}

loadDotEnv();
const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  const argument = process.argv[2];
  const parsed = argument === undefined ? 60 : Number(argument);
  runProductScheduleWorker(parsed).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}

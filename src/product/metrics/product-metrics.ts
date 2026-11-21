import { sha256 } from "../../utils/hash.js";
import { keywordRunSummary } from "../keyword-monitor-insights.js";
import type { KeywordMonitorRun } from "../keyword-monitor-schema.js";
import type { KeywordMonitorStore } from "../keyword-monitor-store.js";
import type { ProductProjectService } from "../projects/project-service.js";
import type { WorkerStatusStore } from "../scheduling/worker-status.js";
import { formatPrometheus, type PrometheusSample } from "./prometheus-format.js";

interface MetricsStores {
  projects: Pick<ProductProjectService, "list">;
  keywords: Pick<KeywordMonitorStore, "listMonitors" | "listRuns">;
  workers: Pick<WorkerStatusStore, "readAll">;
}

const help = {
  build_info: "NiubiGEO build information.",
  projects: "Number of non-deleted projects.",
  keyword_monitors: "Number of stored keyword monitors by project and state.",
  keyword_runs: "Number of stored keyword runs by monitor and status.",
  keyword_last_run_timestamp_seconds: "Unix timestamp of the latest finished keyword run.",
  keyword_mention_ratio: "Fraction of valid samples mentioning the monitored identity in the latest finished run.",
  keyword_best_position: "Best rank among valid samples in the latest finished run (1 = top).",
  keyword_model_errors: "Number of errored model samples in the latest finished run.",
  workers: "Number of stored scheduler workers in each state.",
  worker_last_heartbeat_timestamp_seconds: "Newest scheduler worker heartbeat as a Unix timestamp.",
  project_info: "Project domain information.",
  keyword_monitor_info: "Keyword monitor information.",
  model_info: "Model name information from the latest finished runs.",
};

type Metric = keyof typeof help;
const nameMetrics = new Set(["project_info", "keyword_monitor_info", "model_info"]);
const runStatuses = ["completed", "failed", "queued"] as const;
const workerStates = ["running", "stale", "stopped", "failed"] as const;

function customModelName(id: string, fallback: string): string {
  // The encoded ID contains [endpoint URL, upstream model ID].
  try {
    const decoded: unknown = JSON.parse(Buffer.from(id.slice("custom:".length), "base64url").toString("utf8"));
    const name: unknown = Array.isArray(decoded) ? decoded[1] : undefined;
    if (typeof name === "string" && name && !name.includes("://") && !name.startsWith("//")) return name;
  } catch {
    // Older or malformed custom IDs still have an opaque label.
  }
  return fallback;
}

function compareRuns(left: KeywordMonitorRun, right: KeywordMonitorRun): number {
  return right.startedAt.localeCompare(left.startedAt) || right.id.localeCompare(left.id);
}

export async function collectProductMetrics(
  { projects, keywords, workers }: MetricsStores,
  { version, includeNames }: { version: string; includeNames: boolean },
): Promise<string> {
  const samples = new Map<string, PrometheusSample[]>();
  function add(metric: Metric, value: number, labels?: PrometheusSample["labels"]): void {
    const sample = labels ? { value, labels } : { value };
    const family = samples.get(metric);
    if (family) family.push(sample);
    else samples.set(metric, [sample]);
  }

  const [projectRows, workerRows] = await Promise.all([projects.list({ includeArchived: true }), workers.readAll()]);
  add("build_info", 1, { version });
  add("projects", projectRows.length);
  for (const state of workerStates) {
    add("workers", workerRows.filter(row => row.state === state).length, { state });
  }
  let heartbeat = -Infinity;
  for (const worker of workerRows) {
    const timestamp = Date.parse(worker.heartbeatAt);
    if (Number.isFinite(timestamp)) heartbeat = Math.max(heartbeat, timestamp);
  }
  if (Number.isFinite(heartbeat)) add("worker_last_heartbeat_timestamp_seconds", heartbeat / 1000);

  const modelNames = new Map<string, { name: string; run: KeywordMonitorRun }>();
  for (const project of projectRows) {
    const projectLabels = { project_id: project.id };
    if (includeNames) add("project_info", 1, { ...projectLabels, domain: project.primaryDomain });
    const [monitors, runs] = await Promise.all([keywords.listMonitors(project.id), keywords.listRuns(project.id)]);
    const enabled = monitors.filter(monitor => monitor.enabled).length;
    add("keyword_monitors", enabled, { ...projectLabels, state: "enabled" });
    add("keyword_monitors", monitors.length - enabled, { ...projectLabels, state: "disabled" });

    const runsByMonitor = new Map<string, KeywordMonitorRun[]>();
    for (const run of runs) {
      const history = runsByMonitor.get(run.monitorId);
      if (history) history.push(run);
      else runsByMonitor.set(run.monitorId, [run]);
    }

    for (const monitor of monitors) {
      const monitorLabels = { ...projectLabels, monitor_id: monitor.id };
      if (includeNames) {
        add("keyword_monitor_info", 1, { monitor_id: monitor.id, keyword: monitor.keyword, kind: monitor.kind, frequency: monitor.frequency });
      }
      const history = (runsByMonitor.get(monitor.id) ?? []).sort(compareRuns);
      for (const status of runStatuses) {
        add("keyword_runs", history.filter(run => run.status === status).length, { ...monitorLabels, status });
      }
      const latest = history.find(run => run.status === "completed" || run.status === "failed");
      if (!latest) continue;
      const timestamp = Date.parse(latest.completedAt ?? latest.startedAt);
      if (Number.isFinite(timestamp)) add("keyword_last_run_timestamp_seconds", timestamp / 1000, monitorLabels);

      const bestPositions = new Map<string, number>();
      for (const sample of latest.modelResults ?? []) {
        const position = sample.position;
        if (sample.error || position == null || !Number.isInteger(position) || position < 0) continue;
        bestPositions.set(sample.modelId, Math.min(bestPositions.get(sample.modelId) ?? Infinity, position + 1));
      }
      for (const summary of keywordRunSummary(latest)) {
        const custom = summary.modelId.startsWith("custom:");
        const modelId = custom ? "custom-" + sha256(summary.modelId).slice(0, 12) : summary.modelId;
        const labels = { ...monitorLabels, model_id: modelId };
        if (summary.mentionRate !== null) add("keyword_mention_ratio", summary.mentionRate, labels);
        const position = bestPositions.get(summary.modelId);
        if (position !== undefined) add("keyword_best_position", position, labels);
        add("keyword_model_errors", summary.failed, labels);
        if (includeNames) {
          const name = custom ? customModelName(summary.modelId, modelId) : summary.modelName;
          const previous = modelNames.get(modelId);
          const order = previous ? compareRuns(latest, previous.run) : -1;
          if (name && (order < 0 || (order === 0 && previous && name < previous.name))) {
            modelNames.set(modelId, { name, run: latest });
          }
        }
      }
    }
  }
  for (const [modelId, { name }] of modelNames) add("model_info", 1, { model_id: modelId, model_name: name });

  return formatPrometheus(Object.entries(help)
    .filter(([metric]) => includeNames || !nameMetrics.has(metric))
    .map(([metric, description]) => ({
      name: "niubigeo_" + metric,
      help: description,
      type: "gauge",
      samples: samples.get(metric) ?? [],
    })));
}

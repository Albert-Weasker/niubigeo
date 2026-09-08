import type { ProductProjectService } from "../projects/project-service.js";
import type { ProductMeasurementRunService } from "./measurement-service.js";
import type { ProductMeasurementStatsService } from "./measurement-stats.js";
import type { ProductWatchSetService } from "./watchset-service.js";

type Sender = (status: number, body: unknown) => void;
type Reader = () => Promise<Record<string, unknown>>;

function listOfText(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return undefined;
  return value as string[];
}

function numberValue(value: unknown): number | undefined { return typeof value === "number" ? value : undefined; }

function error(send: Sender, value: unknown): void {
  const message = value instanceof Error ? value.message : String(value);
  const lower = message.toLocaleLowerCase();
  if (lower.includes("not found")) return send(404, { code: "measurement_not_found", error: message });
  if (lower.includes("scope") || lower.includes("configuration") || lower.includes("model") || lower.includes("budget") || lower.includes("sample")) return send(422, { code: "measurement_invalid", error: message });
  return send(500, { code: "measurement_operation_failed", error: message });
}

export async function handleMeasurementApi(input: {
  method: string;
  route: string[];
  readJson: Reader;
  send: Sender;
  projects: ProductProjectService;
  watchSets: ProductWatchSetService;
  measurements: ProductMeasurementRunService;
  stats: ProductMeasurementStatsService;
}): Promise<boolean> {
  const { method, route, readJson, send, projects, watchSets, measurements, stats } = input;
  try {
    if (route.length < 4 || route[0] !== "api" || route[1] !== "projects") return false;
    const projectId = route[2];
    if (!projectId) return false;
    if (route[3] === "watch-sets") {
      if (route.length === 5 && route[4] === "suggestion" && method === "GET") return send(200, { suggestion: await watchSets.suggest(projectId) }), true;
      if (route.length === 4 && method === "GET") return send(200, { watchSets: await watchSets.list(projectId) }), true;
      if (route.length === 4 && method === "POST") {
        const body = await readJson();
        const objectIds = listOfText(body.objectIds);
        const keywordIds = listOfText(body.keywordIds);
        const repetitions = numberValue(body.repetitions);
        return send(201, {
          watchSet: await watchSets.createFromSuggestion(projectId, {
            ...(objectIds ? { objectIds } : {}),
            ...(keywordIds ? { keywordIds } : {}),
            ...(repetitions === undefined ? {} : { repetitions }),
          }),
        }), true;
      }
      if (route.length === 5 && method === "GET") return send(200, { watchSet: await watchSets.get(projectId, route[4] || "") }), true;
      if (route.length === 6 && route[5] === "confirm" && method === "POST") return send(200, { watchSet: await watchSets.confirm(projectId, route[4] || "") }), true;
      return false;
    }
    if (route[3] === "measurement-runs") {
      if (route.length === 4 && method === "GET") return send(200, { runs: await measurements.list(projectId) }), true;
      if (route.length === 4 && method === "POST") {
        const body = await readJson();
        const budget = body.budget && typeof body.budget === "object" ? body.budget as Record<string, unknown> : {};
        const modelIds = listOfText(body.modelIds);
        const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined;
        const requestLimit = numberValue(budget.requestLimit);
        const dailyRequestLimit = numberValue(budget.dailyRequestLimit);
        const tokenLimit = numberValue(budget.tokenLimit);
        const costLimitUsd = numberValue(budget.costLimitUsd);
        return send(202, {
          run: await measurements.start(projectId, {
            ...(modelIds ? { modelIds } : {}),
            ...(idempotencyKey ? { idempotencyKey } : {}),
            budget: {
              ...(requestLimit === undefined ? {} : { requestLimit }),
              ...(dailyRequestLimit === undefined ? {} : { dailyRequestLimit }),
              ...(tokenLimit === undefined ? {} : { tokenLimit }),
              ...(costLimitUsd === undefined ? {} : { costLimitUsd }),
            },
          }),
        }), true;
      }
      if (route.length === 5 && route[4] === "new-models" && method === "POST") return send(202, { run: await measurements.startNewModels(projectId) }), true;
      const runId = route[4];
      if (!runId) return false;
      if (route.length === 5 && method === "GET") return send(200, await measurements.get(projectId, runId)), true;
      if (route.length === 9 && route[5] === "model-runs" && route[7] === "probes" && method === "GET") return send(200, await measurements.getProbe(projectId, runId, route[6] || "", route[8] || "")), true;
      if (route.length === 10 && route[5] === "model-runs" && route[7] === "probes" && route[9] === "retry" && method === "POST") {
        await measurements.retryProbe(projectId, runId, route[6] || "", route[8] || "");
        return send(202, { accepted: true }), true;
      }
      return false;
    }
    if (route[3] === "measurement-stats") {
      if (route.length === 4 && method === "POST") return send(201, { snapshot: await stats.build(projectId) }), true;
      const snapshotId = route[4];
      if (!snapshotId) return false;
      if (route.length === 5 && method === "GET") return send(200, { snapshot: await stats.get(projectId, snapshotId) }), true;
      if (route.length === 8 && route[5] === "points" && route[7] === "samples" && method === "GET") return send(200, await stats.pointSamples(projectId, snapshotId, route[6] || "")), true;
      return false;
    }
    return false;
  } catch (value) {
    error(send, value);
    return true;
  }
}

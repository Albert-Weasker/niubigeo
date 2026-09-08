import { ProductProjectNotFoundError } from "../projects/project-errors.js";
import { RecognitionAttemptNotFoundError, RecognitionInputError, RecognitionModelRunNotFoundError, RecognitionRunNotFoundError } from "./recognition-errors.js";
import { ProductRecognitionRunService } from "./recognition-service.js";

export type RecognitionJsonSender = (status: number, body: unknown) => void;

function sendError(send: RecognitionJsonSender, error: unknown): void {
  if (error instanceof ProductProjectNotFoundError) return send(404, { error: error.message, code: "project_not_found" });
  if (error instanceof RecognitionRunNotFoundError) return send(404, { error: error.message, code: "recognition_run_not_found" });
  if (error instanceof RecognitionModelRunNotFoundError) return send(404, { error: error.message, code: "recognition_model_run_not_found" });
  if (error instanceof RecognitionAttemptNotFoundError) return send(404, { error: error.message, code: "recognition_attempt_not_found" });
  if (error instanceof RecognitionInputError) return send(422, { error: error.message, code: "recognition_invalid" });
  return send(500, { error: error instanceof Error ? error.message : String(error), code: "recognition_operation_failed" });
}

export async function handleProductRecognitionApi(input: {
  method: string;
  route: string[];
  idempotencyKey?: string | undefined;
  readJson?: (() => Promise<Record<string, unknown>>) | undefined;
  send: RecognitionJsonSender;
  service: ProductRecognitionRunService;
}): Promise<boolean> {
  const { method, route, send, service, idempotencyKey } = input;
  try {
    if (route.length < 4 || route[0] !== "api" || route[1] !== "projects") return false;
    const projectId = route[2];
    if (!projectId || route[3] !== "recognition-runs") return false;
    if (route.length === 4 && method === "GET") return send(200, { runs: await service.list(projectId) }), true;
    if (route.length === 4 && method === "POST") {
      const body = input.readJson ? await input.readJson() : {};
      const modelIds = Array.isArray(body.modelIds) && body.modelIds.every((item) => typeof item === "string") ? body.modelIds as string[] : undefined;
      return send(202, await service.start(projectId, { ...(idempotencyKey ? { idempotencyKey } : {}), ...(modelIds ? { modelIds } : {}) })), true;
    }
    const runId = route[4];
    if (!runId) return false;
    if (route.length === 5 && method === "GET") return send(200, await service.get(projectId, runId)), true;
    if (route.length !== 7 && route.length !== 9 && route.length !== 10) return false;
    if (route[5] !== "model-runs") return false;
    const modelRunId = route[6];
    if (!modelRunId) return false;
    if (route.length === 7 && method === "GET") return send(200, await service.getModelRun(projectId, runId, modelRunId)), true;
    if (route.length === 9 && method === "GET" && route[7] === "attempts" && route[8]) {
      return send(200, await service.getAttempt(projectId, runId, modelRunId, route[8])), true;
    }
    if (route.length === 10 && method === "POST" && route[7] === "attempts" && route[8] && route[9] === "reanalyze") {
      return send(200, { revision: await service.reanalyze(projectId, runId, modelRunId, route[8]) }), true;
    }
    return false;
  } catch (error) {
    sendError(send, error);
    return true;
  }
}

export async function handleProductRecognitionRetryApi(input: {
  method: string;
  route: string[];
  send: RecognitionJsonSender;
  service: ProductRecognitionRunService;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  try {
    if (method !== "POST" || route.length !== 8 || route[0] !== "api" || route[1] !== "projects") return false;
    const [projectId, recognitionRuns, runId, modelRuns, modelRunId, retry] = route.slice(2);
    if (!projectId || recognitionRuns !== "recognition-runs" || !runId || modelRuns !== "model-runs" || !modelRunId || retry !== "retry") return false;
    return send(202, await service.retry(projectId, runId, modelRunId)), true;
  } catch (error) {
    sendError(send, error);
    return true;
  }
}

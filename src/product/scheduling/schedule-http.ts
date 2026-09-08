import type { ProductScheduleService } from "./schedule-service.js";
import type { MonitoringScheduleRule } from "./schedule-schema.js";

type Sender = (status: number, body: unknown) => void;
type Reader = () => Promise<Record<string, unknown>>;

function rule(value: unknown): MonitoringScheduleRule {
  if (!value || typeof value !== "object") throw new Error("A schedule rule is required.");
  const row = value as Record<string, unknown>;
  if (row.frequency !== "daily" && row.frequency !== "weekly" && row.frequency !== "monthly" && row.frequency !== "custom") throw new Error("Schedule frequency is invalid.");
  if (typeof row.timezone !== "string" || !row.timezone.trim()) throw new Error("Schedule timezone is required.");
  return {
    frequency: row.frequency,
    timezone: row.timezone,
    hour: typeof row.hour === "number" ? row.hour : undefined,
    minute: typeof row.minute === "number" ? row.minute : undefined,
    weekday: typeof row.weekday === "number" ? row.weekday : undefined,
    dayOfMonth: typeof row.dayOfMonth === "number" ? row.dayOfMonth : undefined,
    cron: typeof row.cron === "string" ? row.cron : undefined,
  };
}

function modelScope(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return undefined;
  return value as string[];
}

function sendError(send: Sender, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLocaleLowerCase();
  if (lowered.includes("not found")) return send(404, { code: "monitoring_task_not_found", error: message });
  return send(422, { code: "monitoring_task_invalid", error: message });
}

export async function handleScheduleApi(input: { method: string; route: string[]; readJson: Reader; send: Sender; service: ProductScheduleService }): Promise<boolean> {
  const { method, route, readJson, send, service } = input;
  try {
    if (route[0] === "api" && route[1] === "scheduler" && route[2] === "due" && route.length === 3 && method === "POST") return send(200, { occurrences: await service.runDue() }), true;
    if (route.length < 4 || route[0] !== "api" || route[1] !== "projects" || route[3] !== "monitoring-tasks") return false;
    const projectId = route[2];
    if (!projectId) return false;
    if (route.length === 4 && method === "GET") return send(200, { tasks: await service.list(projectId) }), true;
    if (route.length === 4 && method === "POST") {
      const body = await readJson();
      const selectedModels = modelScope(body.modelScope);
      return send(201, {
        task: await service.create(projectId, {
          name: typeof body.name === "string" ? body.name : "",
          rule: rule(body.rule),
          ...(selectedModels ? { modelScope: selectedModels } : {}),
        }),
      }), true;
    }
    if (route.length === 5 && route[4] === "preview" && method === "POST") {
      const body = await readJson();
      return send(200, { occurrences: await service.preview(projectId, rule(body.rule)) }), true;
    }
    const taskId = route[4];
    if (!taskId) return false;
    if (route.length === 5 && method === "GET") return send(200, { task: await service.get(projectId, taskId) }), true;
    if (route.length === 5 && method === "PATCH") {
      const body = await readJson();
      const selectedModels = modelScope(body.modelScope);
      return send(200, {
        task: await service.update(projectId, taskId, {
          name: typeof body.name === "string" ? body.name : "",
          rule: rule(body.rule),
          ...(selectedModels ? { modelScope: selectedModels } : {}),
        }),
      }), true;
    }
    if (route.length === 6 && route[5] === "pause" && method === "POST") return send(200, { task: await service.pause(projectId, taskId) }), true;
    if (route.length === 6 && route[5] === "resume" && method === "POST") return send(200, { task: await service.resume(projectId, taskId) }), true;
    if (route.length === 6 && route[5] === "preview" && method === "GET") {
      const task = await service.get(projectId, taskId);
      return send(200, { occurrences: await service.preview(projectId, task.rule) }), true;
    }
    if (route.length === 6 && route[5] === "occurrences" && method === "GET") return send(200, { occurrences: await service.occurrences(projectId, taskId) }), true;
    if (route.length === 5 && method === "DELETE") return send(200, { task: await service.remove(projectId, taskId) }), true;
    return false;
  } catch (error) {
    sendError(send, error);
    return true;
  }
}

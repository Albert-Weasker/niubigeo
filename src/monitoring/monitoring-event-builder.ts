import { createHash } from "node:crypto";
import type { ObservationChange } from "../changes/change-schema.js";
import type { ProjectRunRecord, MonitoringNotificationCondition, MonitoringTask } from "./monitoring-task-schema.js";
import type { MonitoringEvent } from "./monitoring-event-schema.js";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function eventId(task: MonitoringTask, runId: string, condition: MonitoringNotificationCondition): string {
  return `event-${createHash("sha256").update([task.id, runId, condition].join("::")).digest("hex").slice(0, 20)}`;
}

function conditionFor(change: ObservationChange): MonitoringNotificationCondition | undefined {
  if (change.kind === "brand_disappeared") return "brand_disappeared";
  if (change.kind === "competitor_appeared_without_target") return "competitor_appeared";
  if (change.kind === "official_citation_added") return "official_citation_added";
  if (change.kind === "recommendation_gained" || change.kind === "recommendation_lost") return "recommendation_changed";
  return undefined;
}

function eventFromChanges(
  task: MonitoringTask,
  run: ProjectRunRecord,
  condition: MonitoringNotificationCondition,
  changes: ObservationChange[],
  createdAt: string,
): MonitoringEvent {
  return {
    id: eventId(task, run.id, condition),
    projectId: task.projectId,
    taskId: task.id,
    runId: run.id,
    condition,
    occurrenceCount: changes.length,
    observationIds: unique(changes.flatMap((change) => change.currentObservationIds)),
    previousObservationIds: unique(changes.flatMap((change) => change.previousObservationIds)),
    promptIds: unique(changes.flatMap((change) => change.promptIds)),
    models: unique(changes.flatMap((change) => change.models)),
    entityNames: unique(changes.flatMap((change) => change.entityNames)),
    citationUrls: unique(changes.flatMap((change) => change.citationUrls)),
    status: "recorded",
    deliveries: [],
    createdAt,
  };
}

export class MonitoringEventBuilder {
  afterRun(task: MonitoringTask, run: ProjectRunRecord, changes: ObservationChange[], createdAt = new Date().toISOString()): MonitoringEvent[] {
    const enabled = new Set(task.notifications.conditions);
    const grouped = new Map<MonitoringNotificationCondition, ObservationChange[]>();
    for (const change of changes) {
      const condition = conditionFor(change);
      if (!condition || !enabled.has(condition)) continue;
      const rows = grouped.get(condition) || [];
      rows.push(change);
      grouped.set(condition, rows);
    }
    const events = [...grouped.entries()].map(([condition, rows]) => eventFromChanges(task, run, condition, rows, createdAt));
    if (run.status === "completed" && enabled.has("run_completed")) {
      events.push(eventFromChanges(task, run, "run_completed", [], createdAt));
    }
    return events;
  }

  afterFailure(task: MonitoringTask, createdAt = new Date().toISOString()): MonitoringEvent[] {
    if (!task.notifications.conditions.includes("run_failed")) return [];
    return [{
      id: eventId(task, task.lastAttemptAt || createdAt, "run_failed"),
      projectId: task.projectId,
      taskId: task.id,
      condition: "run_failed",
      occurrenceCount: 1,
      observationIds: [],
      previousObservationIds: [],
      promptIds: [],
      models: [],
      entityNames: [],
      citationUrls: [],
      status: "recorded",
      deliveries: [],
      createdAt,
    }];
  }
}

import type { MeasurementBudget } from "../measurements/measurement-schema.js";

export type MonitoringFrequency = "daily" | "weekly" | "monthly" | "custom";
export type MonitoringTaskStatus = "active" | "paused" | "deleted" | "incompatible";
export type ScheduledOccurrenceStatus = "planned" | "started" | "completed" | "skipped" | "unknown" | "budget_blocked";

export interface MonitoringScheduleRule {
  frequency: MonitoringFrequency;
  timezone: string;
  hour?: number | undefined;
  minute?: number | undefined;
  weekday?: number | undefined;
  dayOfMonth?: number | undefined;
  cron?: string | undefined;
}

export interface MonitoringTask {
  id: string;
  projectId: string;
  version: number;
  name: string;
  status: MonitoringTaskStatus;
  baselineId: string;
  watchSetId: string;
  modelScope: string[];
  rule: MonitoringScheduleRule;
  budget: MeasurementBudget;
  plannedRequestCount: number;
  missedRunPolicy: "skip";
  overlapPolicy: "skip";
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  pausedAt?: string | undefined;
  deletedAt?: string | undefined;
}

export interface ScheduledOccurrence {
  id: string;
  projectId: string;
  taskId: string;
  taskVersion: number;
  scheduledFor: string;
  status: ScheduledOccurrenceStatus;
  runId?: string | undefined;
  reason?: string | undefined;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
}

export interface BudgetLedgerEntry {
  id: string;
  projectId: string;
  taskId: string;
  occurrenceId: string;
  dateKey: string;
  reservedRequests: number;
  knownCostUsd: number | null;
  costState: "reserved" | "known" | "unknown" | "released";
  createdAt: string;
  updatedAt: string;
}

import { randomUUID } from "node:crypto";
import { CronExpressionParser } from "cron-parser";
import { ProductBaselineService } from "../configuration/baseline-service.js";
import { ProductProjectService } from "../projects/project-service.js";
import { ProductMeasurementRunService } from "../measurements/measurement-service.js";
import { ProductWatchSetService } from "../measurements/watchset-service.js";
import type { MeasurementBudget } from "../measurements/measurement-schema.js";
import type { MonitoringScheduleRule, MonitoringTask, ScheduledOccurrence } from "./schedule-schema.js";
import { ProductScheduleFileStore } from "./schedule-store.js";

function now(): string { return new Date().toISOString(); }
function validInteger(value: number | undefined, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function cron(rule: MonitoringScheduleRule): string {
  const hour = rule.hour === undefined ? 9 : rule.hour;
  const minute = rule.minute === undefined ? 0 : rule.minute;
  if (!validInteger(hour, 0, 23) || !validInteger(minute, 0, 59)) throw new Error("Schedule hour and minute are invalid.");
  if (rule.frequency === "daily") return `0 ${minute} ${hour} * * *`;
  if (rule.frequency === "weekly") {
    if (!validInteger(rule.weekday, 0, 6)) throw new Error("Weekly schedule weekday is invalid.");
    return `0 ${minute} ${hour} * * ${rule.weekday}`;
  }
  if (rule.frequency === "monthly") {
    if (!validInteger(rule.dayOfMonth, 1, 31)) throw new Error("Monthly schedule day is invalid.");
    return `0 ${minute} ${hour} ${rule.dayOfMonth} * *`;
  }
  if (!rule.cron?.trim()) throw new Error("A custom Cron expression is required.");
  return rule.cron.trim();
}

function nextDates(rule: MonitoringScheduleRule, after: Date, count: number): Date[] {
  const expression = CronExpressionParser.parse(cron(rule), { currentDate: after, tz: rule.timezone });
  const values: Date[] = [];
  for (let index = 0; index < count; index += 1) values.push(expression.next().toDate());
  return values;
}

function dateKey(value: Date, timezone: string): string {
  const pieces = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const byType = new Map(pieces.map((item) => [item.type, item.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export class ProductScheduleService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly baselines: ProductBaselineService,
    private readonly watchSets: ProductWatchSetService,
    private readonly measurements: ProductMeasurementRunService,
    private readonly store: ProductScheduleFileStore,
  ) {}

  async create(projectId: string, input: { name: string; rule: MonitoringScheduleRule; modelScope?: string[]; budget?: Partial<MeasurementBudget> }): Promise<MonitoringTask> {
    const project = await this.projects.get(projectId);
    if (!project.activeBaselineId) throw new Error("Save a monitoring configuration before creating a monitoring task.");
    const baseline = await this.baselines.get(projectId, project.activeBaselineId);
    const watchSet = await this.watchSets.current(projectId);
    if (watchSet.baselineId !== baseline.id) throw new Error("Confirm a monitoring scope for the current configuration before creating a task.");
    const requested = new Set(input.modelScope || baseline.modelSnapshots.map((model) => model.modelId));
    const models = baseline.modelSnapshots.filter((model) => requested.has(model.modelId));
    if (models.length === 0 || models.length !== requested.size) throw new Error("The task model scope is not part of the current monitoring configuration.");
    const planned = models.length * this.measurements.plannedProbeCount(watchSet);
    const budget: MeasurementBudget = { requestLimit: planned, dailyRequestLimit: null, tokenLimit: null, costLimitUsd: null, ...input.budget };
    if (planned > budget.requestLimit) throw new Error("The monitoring task exceeds its request limit.");
    const nextRunAt = nextDates(input.rule, new Date(), 1)[0]?.toISOString() || null;
    const task: MonitoringTask = { id: randomUUID(), projectId, version: 1, name: input.name.trim() || "Monitoring task", status: "active", baselineId: baseline.id, watchSetId: watchSet.id, modelScope: models.map((model) => model.modelId), rule: input.rule, budget, plannedRequestCount: planned, missedRunPolicy: "skip", overlapPolicy: "skip", nextRunAt, createdAt: now(), updatedAt: now() };
    await this.store.saveTask(task);
    return task;
  }

  async update(projectId: string, taskId: string, input: { name: string; rule: MonitoringScheduleRule; modelScope?: string[]; budget?: Partial<MeasurementBudget> }): Promise<MonitoringTask> {
    const task = await this.get(projectId, taskId);
    if (task.status === "deleted") throw new Error("A deleted monitoring task cannot be edited.");
    const project = await this.projects.get(projectId);
    if (!project.activeBaselineId || project.activeBaselineId !== task.baselineId) throw new Error("This monitoring task uses an older monitoring configuration and cannot be edited.");
    const baseline = await this.baselines.get(projectId, task.baselineId);
    const watchSet = await this.watchSets.current(projectId);
    if (watchSet.id !== task.watchSetId) throw new Error("This monitoring task uses an older monitoring scope and cannot be edited.");
    const requested = new Set(input.modelScope || task.modelScope);
    const models = baseline.modelSnapshots.filter((model) => requested.has(model.modelId));
    if (models.length === 0 || models.length !== requested.size) throw new Error("The task model scope is not part of the current monitoring configuration.");
    const planned = models.length * this.measurements.plannedProbeCount(watchSet);
    const budget: MeasurementBudget = { ...task.budget, ...input.budget };
    if (planned > budget.requestLimit) throw new Error("The monitoring task exceeds its request limit.");
    const active = task.status === "active";
    const next: MonitoringTask = {
      ...task,
      version: task.version + 1,
      name: input.name.trim() || task.name,
      modelScope: models.map((model) => model.modelId),
      rule: input.rule,
      budget,
      plannedRequestCount: planned,
      nextRunAt: active ? nextDates(input.rule, new Date(), 1)[0]?.toISOString() || null : null,
      updatedAt: now(),
    };
    await this.store.saveTask(next);
    return next;
  }

  async list(projectId: string): Promise<MonitoringTask[]> { await this.projects.get(projectId); return this.store.listTasks(projectId); }
  async get(projectId: string, taskId: string): Promise<MonitoringTask> { await this.projects.get(projectId); const task = await this.store.readTask(projectId, taskId); if (!task) throw new Error("Monitoring task was not found."); return task; }
  async pause(projectId: string, taskId: string): Promise<MonitoringTask> { const task = await this.get(projectId, taskId); if (task.status === "deleted") throw new Error("A deleted monitoring task cannot be paused."); const next = { ...task, status: "paused" as const, pausedAt: now(), updatedAt: now(), nextRunAt: null }; await this.store.saveTask(next); return next; }
  async resume(projectId: string, taskId: string): Promise<MonitoringTask> { const task = await this.get(projectId, taskId); if (task.status === "deleted" || task.status === "incompatible") throw new Error("This monitoring task cannot be resumed until its configuration is updated."); const next = { ...task, status: "active" as const, pausedAt: undefined, updatedAt: now(), nextRunAt: nextDates(task.rule, new Date(), 1)[0]?.toISOString() || null }; await this.store.saveTask(next); return next; }
  async remove(projectId: string, taskId: string): Promise<MonitoringTask> { const task = await this.get(projectId, taskId); const next = { ...task, status: "deleted" as const, deletedAt: now(), updatedAt: now(), nextRunAt: null }; await this.store.saveTask(next); return next; }
  async preview(projectId: string, rule: MonitoringScheduleRule, count = 3): Promise<string[]> { await this.projects.get(projectId); return nextDates(rule, new Date(), count).map((date) => date.toISOString()); }
  async occurrences(projectId: string, taskId?: string): Promise<ScheduledOccurrence[]> { await this.projects.get(projectId); return this.store.listOccurrences(projectId, taskId); }

  async runDue(at = new Date()): Promise<ScheduledOccurrence[]> {
    const all = await this.projects.list({ includeArchived: true });
    const created: ScheduledOccurrence[] = [];
    for (const project of all) {
      for (const task of await this.store.listTasks(project.id)) {
        await this.reconcileOccurrences(project.id, task.id);
        if (task.status !== "active" || !task.nextRunAt || Date.parse(task.nextRunAt) > at.getTime()) continue;
        const guarded = await this.store.withTaskLock(project.id, task.id, async () => {
          const current = await this.store.readTask(project.id, task.id);
          if (!current || current.status !== "active" || !current.nextRunAt || Date.parse(current.nextRunAt) > at.getTime()) return null;
          const occurrenceResult = await this.store.getOrCreateOccurrence({ projectId: project.id, taskId: current.id, taskVersion: current.version, scheduledFor: current.nextRunAt, status: "planned" });
          if (!occurrenceResult.created) return null;
          return this.executeOccurrence(project, current, occurrenceResult.occurrence, at);
        });
        if (guarded.acquired && guarded.value) created.push(guarded.value);
      }
    }
    return created;
  }

  private async executeOccurrence(project: import("../projects/project-schema.js").ProductProject, task: MonitoringTask, occurrence: ScheduledOccurrence, at: Date): Promise<ScheduledOccurrence> {
    if (project.status === "archived" || project.status === "deleted") return this.finish(occurrence, "skipped", "project_not_active");
    if (task.status !== "active") return this.finish(occurrence, "skipped", "task_not_active");
    if (project.activeBaselineId !== task.baselineId) {
      await this.store.saveTask({ ...task, status: "incompatible", updatedAt: now(), nextRunAt: null });
      return this.finish(occurrence, "skipped", "task_configuration_changed");
    }
    const activeRuns = (await this.measurements.list(project.id)).filter((run) => run.source === "scheduled" && (run.status === "queued" || run.status === "running"));
    if (activeRuns.length > 0) return this.finish(occurrence, "skipped", "previous_run_still_active");
    const date = dateKey(at, task.rule.timezone);
    const ledger = await this.store.listLedger(project.id, task.id);
    const usedToday = ledger.filter((entry) => entry.dateKey === date && entry.costState !== "released").reduce((total, entry) => total + entry.reservedRequests, 0);
    if (task.budget.dailyRequestLimit !== null && usedToday + task.plannedRequestCount > task.budget.dailyRequestLimit) return this.finish(occurrence, "budget_blocked", "daily_request_limit");
    const entry = { id: randomUUID(), projectId: project.id, taskId: task.id, occurrenceId: occurrence.id, dateKey: date, reservedRequests: task.plannedRequestCount, knownCostUsd: null, costState: "reserved" as const, createdAt: now(), updatedAt: now() };
    await this.store.saveLedger(entry);
    try {
      const run = await this.measurements.start(project.id, { modelIds: task.modelScope, source: "scheduled", occurrenceId: occurrence.id, idempotencyKey: `${task.id}:${occurrence.scheduledFor}`, budget: task.budget });
      const started = { ...occurrence, status: "started" as const, runId: run.id, startedAt: now() };
      await this.store.saveOccurrence(started);
      await this.advanceTask(task, occurrence.scheduledFor);
      return started;
    } catch (error) {
      await this.advanceTask(task, occurrence.scheduledFor);
      return this.finish(occurrence, "unknown", error instanceof Error ? error.message : String(error));
    }
  }

  private async advanceTask(task: MonitoringTask, scheduledFor: string): Promise<void> {
    const nextRunAt = nextDates(task.rule, new Date(scheduledFor), 1)[0]?.toISOString() || null;
    await this.store.saveTask({ ...task, nextRunAt, updatedAt: now() });
  }

  private async reconcileOccurrences(projectId: string, taskId: string): Promise<void> {
    for (const occurrence of await this.store.listOccurrences(projectId, taskId)) {
      if (occurrence.status !== "started" || !occurrence.runId) continue;
      const run = await this.measurements.get(projectId, occurrence.runId);
      if (run.run.status === "queued" || run.run.status === "running") continue;
      const attemptCosts: number[] = [];
      let unknownCost = false;
      for (const model of run.modelRuns) {
        for (const probeId of model.probeRunIds) {
          const detail = await this.measurements.getProbe(projectId, run.run.id, model.id, probeId);
          const latest = detail.attempts.at(-1);
          if (!latest || latest.costState === "unknown" || latest.costUsd === null || latest.costUsd === undefined) unknownCost = true;
          else attemptCosts.push(latest.costUsd);
        }
      }
      for (const ledger of await this.store.listLedger(projectId, taskId)) {
        if (ledger.occurrenceId !== occurrence.id) continue;
        await this.store.saveLedger({ ...ledger, knownCostUsd: unknownCost ? null : attemptCosts.reduce((sum, value) => sum + value, 0), costState: unknownCost ? "unknown" : "known", updatedAt: now() });
      }
      await this.finish(occurrence, "completed", run.run.status === "completed" ? "run_completed" : "run_partial_or_failed");
    }
  }

  private async finish(occurrence: ScheduledOccurrence, status: ScheduledOccurrence["status"], reason: string): Promise<ScheduledOccurrence> {
    const next = { ...occurrence, status, reason, completedAt: now() };
    await this.store.saveOccurrence(next);
    return next;
  }
}

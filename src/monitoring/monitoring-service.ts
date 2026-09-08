import { randomUUID } from "node:crypto";
import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { MonitoringProject } from "../projects/project-schema.js";
import type { ProjectMonitoringStore } from "../projects/project-store.js";
import type { BaselineRunExecutor, RunBaselineOutput } from "./run-orchestrator.js";
import { CronScheduleCalculator, type ScheduleCalculator } from "./schedule-calculator.js";
import type {
  MonitoringNotificationPolicy,
  MonitoringSchedule,
  MonitoringTask,
} from "./monitoring-task-schema.js";
import { NotificationService, type MonitoringEventProcessor } from "./notification-service.js";
import type { AuditProgressListener } from "../runner/audit-progress.js";

export interface CreateMonitoringTaskInput {
  name?: string | undefined;
  projectId: string;
  baselineId: string;
  schedule: MonitoringSchedule;
  notifications?: MonitoringNotificationPolicy | undefined;
  enabled?: boolean | undefined;
  now?: Date | undefined;
}

export interface UpdateMonitoringTaskInput {
  name?: string | undefined;
  baselineId?: string | undefined;
  schedule?: MonitoringSchedule | undefined;
  notifications?: MonitoringNotificationPolicy | undefined;
  enabled?: boolean | undefined;
  now?: Date | undefined;
}

const EMPTY_NOTIFICATIONS: MonitoringNotificationPolicy = { conditions: [], channels: [] };

export interface DueTaskRun {
  task: MonitoringTask;
  output?: RunBaselineOutput | undefined;
  error?: string | undefined;
}

export class MonitoringService {
  private readonly runningTasks = new Set<string>();
  private readonly notifications: MonitoringEventProcessor;

  constructor(
    private readonly store: ProjectMonitoringStore,
    private readonly orchestrator: BaselineRunExecutor,
    private readonly schedules: ScheduleCalculator = new CronScheduleCalculator(),
    notifications?: MonitoringEventProcessor,
  ) {
    this.notifications = notifications || new NotificationService(store);
  }

  async createTask(input: CreateMonitoringTaskInput): Promise<MonitoringTask> {
    const { project, baseline } = await this.loadContext(input.projectId, input.baselineId);
    this.assertRunnable(project, baseline);
    this.schedules.validate(input.schedule);
    const now = input.now || new Date();
    const enabled = input.enabled ?? true;
    const task: MonitoringTask = {
      id: `task-${randomUUID()}`,
      name: input.name?.trim() || baseline.name,
      projectId: project.id,
      baselineId: baseline.id,
      schedule: input.schedule,
      notifications: input.notifications || EMPTY_NOTIFICATIONS,
      enabled,
      nextRunAt: enabled ? this.schedules.next(input.schedule, now) : undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.store.saveTask(task);
    await this.refreshDashboard(project.id);
    return task;
  }

  async updateTask(projectId: string, taskId: string, input: UpdateMonitoringTaskInput): Promise<MonitoringTask> {
    const task = await this.requireTask(projectId, taskId);
    const baselineId = input.baselineId || task.baselineId;
    if (baselineId !== task.baselineId) {
      const context = await this.loadContext(projectId, baselineId);
      this.assertRunnable(context.project, context.baseline);
    }
    const schedule = input.schedule || task.schedule;
    this.schedules.validate(schedule);
    const now = input.now || new Date();
    const enabled = input.enabled === undefined ? task.enabled : input.enabled;
    const updated: MonitoringTask = {
      ...task,
      baselineId,
      name: input.name?.trim() || task.name,
      schedule,
      notifications: input.notifications || task.notifications || EMPTY_NOTIFICATIONS,
      enabled,
      nextRunAt: enabled ? this.schedules.next(schedule, now) : undefined,
      updatedAt: now.toISOString(),
    };
    await this.store.saveTask(updated);
    await this.refreshDashboard(projectId);
    return updated;
  }

  async duplicateTask(projectId: string, taskId: string, now = new Date()): Promise<MonitoringTask> {
    const task = await this.requireTask(projectId, taskId);
    return this.createTask({
      name: task.name,
      projectId,
      baselineId: task.baselineId,
      schedule: task.schedule,
      notifications: task.notifications || EMPTY_NOTIFICATIONS,
      enabled: false,
      now,
    });
  }

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    await this.requireTask(projectId, taskId);
    await this.store.deleteTask(projectId, taskId);
    await this.refreshDashboard(projectId);
  }

  previewSchedule(schedule: MonitoringSchedule, after = new Date(), count = 3): string[] {
    this.schedules.validate(schedule);
    return this.schedules.preview(schedule, after, count);
  }

  async setEnabled(projectId: string, taskId: string, enabled: boolean, now = new Date()): Promise<MonitoringTask> {
    const task = await this.requireTask(projectId, taskId);
    const updated: MonitoringTask = {
      ...task,
      name: task.name || task.id,
      notifications: task.notifications || EMPTY_NOTIFICATIONS,
      enabled,
      nextRunAt: enabled ? this.schedules.next(task.schedule, now) : undefined,
      updatedAt: now.toISOString(),
    };
    await this.store.saveTask(updated);
    await this.refreshDashboard(projectId);
    return updated;
  }

  async reschedule(projectId: string, taskId: string, schedule: MonitoringSchedule, now = new Date()): Promise<MonitoringTask> {
    this.schedules.validate(schedule);
    const task = await this.requireTask(projectId, taskId);
    const updated: MonitoringTask = {
      ...task,
      name: task.name || task.id,
      notifications: task.notifications || EMPTY_NOTIFICATIONS,
      schedule,
      nextRunAt: task.enabled ? this.schedules.next(schedule, now) : undefined,
      updatedAt: now.toISOString(),
    };
    await this.store.saveTask(updated);
    await this.refreshDashboard(projectId);
    return updated;
  }

  async runTask(projectId: string, taskId: string, now = new Date(), onProgress?: AuditProgressListener): Promise<RunBaselineOutput> {
    const task = await this.requireTask(projectId, taskId);
    if (!task.enabled) throw new Error(`Monitoring task is disabled: ${task.id}`);
    if (this.runningTasks.has(task.id)) throw new Error(`Monitoring task is already running: ${task.id}`);
    const { project, baseline } = await this.loadContext(projectId, task.baselineId);
    this.assertRunnable(project, baseline);
    const ownerId = randomUUID();
    const leaseMs = this.leaseDurationMs();
    const acquired = await this.store.acquireTaskLease(projectId, task.id, {
      ownerId,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + leaseMs).toISOString(),
    });
    if (!acquired) throw new Error(`Monitoring task is already running: ${task.id}`);
    this.runningTasks.add(task.id);
    try {
      const output = await this.orchestrator.runBaseline({ project, baseline, onProgress });
      const finishedAt = new Date();
      const savedTask: MonitoringTask = {
        ...task,
        name: task.name || task.id,
        notifications: task.notifications || EMPTY_NOTIFICATIONS,
        lastRunId: output.materialized.run.id,
        lastAttemptAt: now.toISOString(),
        lastError: undefined,
        lastNotificationError: undefined,
        nextRunAt: task.enabled ? this.schedules.next(task.schedule, finishedAt) : undefined,
        updatedAt: finishedAt.toISOString(),
      };
      await this.store.saveTask(savedTask);
      await this.refreshDashboard(projectId);
      try {
        await this.notifications.afterRun(savedTask, output.materialized.run);
      } catch (error) {
        await this.store.saveTask({
          ...savedTask,
          lastNotificationError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        });
      }
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedAt = new Date();
      const savedTask: MonitoringTask = {
        ...task,
        name: task.name || task.id,
        notifications: task.notifications || EMPTY_NOTIFICATIONS,
        lastAttemptAt: now.toISOString(),
        lastError: message,
        nextRunAt: task.enabled ? this.schedules.next(task.schedule, failedAt) : undefined,
        updatedAt: failedAt.toISOString(),
      };
      await this.store.saveTask(savedTask);
      await this.refreshDashboard(projectId);
      try {
        await this.notifications.afterFailure(savedTask);
      } catch (notificationError) {
        await this.store.saveTask({
          ...savedTask,
          lastNotificationError: notificationError instanceof Error ? notificationError.message : String(notificationError),
          updatedAt: new Date().toISOString(),
        });
      }
      throw error;
    } finally {
      this.runningTasks.delete(task.id);
      await this.store.releaseTaskLease(projectId, task.id, ownerId);
    }
  }

  async runDue(now = new Date()): Promise<DueTaskRun[]> {
    const results: DueTaskRun[] = [];
    const projects = await this.store.listProjects();
    for (const project of projects) {
      const tasks = await this.store.listTasks(project.id);
      for (const task of tasks) {
        if (!task.enabled || !task.nextRunAt || task.nextRunAt > now.toISOString()) continue;
        try {
          const output = await this.runTask(project.id, task.id, now);
          results.push({ task, output });
        } catch (error) {
          results.push({ task, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
    return results;
  }

  private async loadContext(projectId: string, baselineId: string): Promise<{ project: MonitoringProject; baseline: MonitoringBaseline }> {
    const project = await this.store.readProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const baseline = await this.store.readBaseline(projectId, baselineId);
    if (!baseline) throw new Error(`Baseline not found: ${baselineId}`);
    if (baseline.projectId !== project.id) throw new Error("Baseline does not belong to the project.");
    return { project, baseline };
  }

  private assertRunnable(project: MonitoringProject, baseline: MonitoringBaseline): void {
    if (project.status !== "active") throw new Error("Project is not active.");
    if (baseline.status !== "active") throw new Error("Baseline is not active.");
    if (!baseline.trendEligible) throw new Error(baseline.nonComparableReason || "Baseline is not eligible for monitoring.");
  }

  private async requireTask(projectId: string, taskId: string): Promise<MonitoringTask> {
    const task = await this.store.readTask(projectId, taskId);
    if (!task) throw new Error(`Monitoring task not found: ${taskId}`);
    if (task.projectId !== projectId) throw new Error("Monitoring task does not belong to the project.");
    return task;
  }

  private async refreshDashboard(projectId: string): Promise<void> {
    const project = await this.store.readProject(projectId);
    if (!project) return;
    const dashboard = await this.store.readDashboard<Record<string, unknown>>(projectId);
    if (!dashboard) return;
    const tasks = await this.store.listTasks(projectId);
    const nextRunAt = tasks
      .filter((task) => task.enabled && task.nextRunAt)
      .map((task) => task.nextRunAt as string)
      .sort((a, b) => a.localeCompare(b))[0];
    const updated = { ...dashboard };
    if (nextRunAt) updated.nextRunAt = nextRunAt;
    else delete updated.nextRunAt;
    await this.store.saveDashboard(projectId, updated);
  }

  private leaseDurationMs(): number {
    const configured = Number(process.env.MONITORING_TASK_LEASE_MS || 3_600_000);
    if (!Number.isFinite(configured) || configured < 60_000) return 3_600_000;
    return Math.floor(configured);
  }
}

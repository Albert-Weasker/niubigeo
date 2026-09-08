import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { MonitoringTask, MonitoringTaskLease, ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { BaselineStore } from "../baselines/baseline-store.js";
import type { MonitoringTaskStore } from "../monitoring/monitoring-task-store.js";
import type { RunStore } from "../monitoring/run-store.js";
import type { ObservationQuery, ObservationStore } from "../observations/observation-store.js";
import type { MonitoringEvent } from "../monitoring/monitoring-event-schema.js";
import type { MonitoringEventStore } from "../monitoring/monitoring-event-store.js";
import type { MonitoringProject } from "./project-schema.js";
import { assertProjectCollection, assertProjectOwnership } from "./project-scope.js";
import { normalizeDomain } from "../utils/domain.js";

export interface ProjectStore {
  saveProject(project: MonitoringProject): Promise<void>;
  readProject(projectId: string): Promise<MonitoringProject | null>;
  listProjects(): Promise<MonitoringProject[]>;
}

export interface DashboardStore {
  saveDashboard(projectId: string, dashboard: unknown): Promise<void>;
  readDashboard<T = unknown>(projectId: string): Promise<T | null>;
}

export type ProjectMonitoringStore = ProjectStore & BaselineStore & MonitoringTaskStore & RunStore & ObservationStore & MonitoringEventStore & DashboardStore;
export type { BaselineStore, MonitoringTaskStore, RunStore, ObservationQuery, ObservationStore, MonitoringEventStore };

function safeSegment(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("\0")) {
    throw new Error(`Invalid ${label}.`);
  }
  return trimmed;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, path);
}

async function listJsonFiles<T>(dir: string): Promise<T[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort();
    const rows: T[] = [];
    for (const file of files) rows.push(await readJson<T>(join(dir, file)));
    return rows;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export class ProjectFileStore implements ProjectMonitoringStore {
  constructor(private readonly rootDir: string) {}

  projectsDir(): string {
    return resolve(this.rootDir, "projects");
  }

  projectDir(projectId: string): string {
    return join(this.projectsDir(), safeSegment(projectId, "project id"));
  }

  baselineDir(projectId: string): string {
    return join(this.projectDir(projectId), "baselines");
  }

  taskDir(projectId: string): string {
    return join(this.projectDir(projectId), "tasks");
  }

  eventDir(projectId: string): string {
    return join(this.projectDir(projectId), "events");
  }

  runDir(projectId: string, runId: string): string {
    return join(this.projectDir(projectId), "runs", safeSegment(runId, "run id"));
  }

  async saveProject(project: MonitoringProject): Promise<void> {
    const domain = normalizeDomain(project.domain);
    const targetDomain = normalizeDomain(project.target.domain);
    if (!domain || domain !== targetDomain) throw new Error("A project must bind one primary domain shared by the project and target.");
    const existing = await this.readProject(project.id);
    if (existing && normalizeDomain(existing.domain) !== domain) {
      throw new Error("A project primary domain cannot be changed in place.");
    }
    const dir = this.projectDir(project.id);
    await mkdir(dir, { recursive: true });
    await writeJson(join(dir, "project.json"), project);
  }

  async readProject(projectId: string): Promise<MonitoringProject | null> {
    try {
      const project = await readJson<MonitoringProject>(join(this.projectDir(projectId), "project.json"));
      if (project.id !== projectId) throw new Error(`Project file does not belong to project ${projectId}.`);
      return project;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  async listProjects(): Promise<MonitoringProject[]> {
    try {
      const entries = await readdir(this.projectsDir(), { withFileTypes: true });
      const projects: MonitoringProject[] = [];
      for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        const project = await this.readProject(entry.name);
        if (project) projects.push(project);
      }
      return projects;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }

  async saveBaseline(baseline: MonitoringBaseline): Promise<void> {
    const project = await this.readProject(baseline.projectId);
    if (!project) throw new Error(`Project not found: ${baseline.projectId}`);
    const dir = this.baselineDir(baseline.projectId);
    await mkdir(dir, { recursive: true });
    await writeJson(join(dir, `${safeSegment(baseline.id, "baseline id")}.json`), baseline);
  }

  async readBaseline(projectId: string, baselineId: string): Promise<MonitoringBaseline | null> {
    try {
      const baseline = await readJson<MonitoringBaseline>(join(this.baselineDir(projectId), `${safeSegment(baselineId, "baseline id")}.json`));
      assertProjectOwnership(projectId, baseline, "Baseline");
      if (baseline.id !== baselineId) throw new Error(`Baseline file does not match baseline ${baselineId}.`);
      return baseline;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  async listBaselines(projectId: string): Promise<MonitoringBaseline[]> {
    const baselines = await listJsonFiles<MonitoringBaseline>(this.baselineDir(projectId));
    assertProjectCollection(projectId, baselines, "Baseline");
    return baselines;
  }

  async saveTask(task: MonitoringTask): Promise<void> {
    const project = await this.readProject(task.projectId);
    if (!project) throw new Error(`Project not found: ${task.projectId}`);
    const baseline = await this.readBaseline(task.projectId, task.baselineId);
    if (!baseline) throw new Error(`Baseline not found: ${task.baselineId}`);
    const dir = this.taskDir(task.projectId);
    await mkdir(dir, { recursive: true });
    await writeJson(join(dir, `${safeSegment(task.id, "task id")}.json`), task);
  }

  async readTask(projectId: string, taskId: string): Promise<MonitoringTask | null> {
    try {
      const task = await readJson<MonitoringTask>(join(this.taskDir(projectId), `${safeSegment(taskId, "task id")}.json`));
      assertProjectOwnership(projectId, task, "Monitoring task");
      if (task.id !== taskId) throw new Error(`Monitoring task file does not match task ${taskId}.`);
      return task;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  async listTasks(projectId: string): Promise<MonitoringTask[]> {
    const tasks = await listJsonFiles<MonitoringTask>(this.taskDir(projectId));
    assertProjectCollection(projectId, tasks, "Monitoring task");
    return tasks;
  }

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    try {
      await unlink(join(this.taskDir(projectId), `${safeSegment(taskId, "task id")}.json`));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }

  async acquireTaskLease(projectId: string, taskId: string, lease: MonitoringTaskLease): Promise<boolean> {
    const dir = this.taskDir(projectId);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${safeSegment(taskId, "task id")}.lock`);
    const tryCreate = async (): Promise<boolean> => {
      try {
        const handle = await open(path, "wx");
        try {
          await handle.writeFile(`${JSON.stringify(lease, null, 2)}\n`);
        } finally {
          await handle.close();
        }
        return true;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "EEXIST") return false;
        throw error;
      }
    };
    if (await tryCreate()) return true;
    try {
      const existing = await readJson<MonitoringTaskLease>(path);
      if (existing.expiresAt > lease.acquiredAt) return false;
      await unlink(path);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) return false;
    }
    return tryCreate();
  }

  async releaseTaskLease(projectId: string, taskId: string, ownerId: string): Promise<void> {
    const path = join(this.taskDir(projectId), `${safeSegment(taskId, "task id")}.lock`);
    try {
      const lease = await readJson<MonitoringTaskLease>(path);
      if (lease.ownerId !== ownerId) return;
      await unlink(path);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }

  async saveMonitoringEvent(event: MonitoringEvent): Promise<void> {
    const project = await this.readProject(event.projectId);
    if (!project) throw new Error(`Project not found: ${event.projectId}`);
    const task = await this.readTask(event.projectId, event.taskId);
    if (!task) throw new Error(`Monitoring task not found: ${event.taskId}`);
    if (event.runId) {
      const run = await this.readRun(event.projectId, event.runId);
      if (!run) throw new Error(`Run not found: ${event.runId}`);
    }
    const dir = this.eventDir(event.projectId);
    await mkdir(dir, { recursive: true });
    await writeJson(join(dir, `${safeSegment(event.id, "monitoring event id")}.json`), event);
  }

  async listMonitoringEvents(projectId: string): Promise<MonitoringEvent[]> {
    const events = await listJsonFiles<MonitoringEvent>(this.eventDir(projectId));
    assertProjectCollection(projectId, events, "Monitoring event");
    return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveRun(run: ProjectRunRecord): Promise<void> {
    const project = await this.readProject(run.projectId);
    if (!project) throw new Error(`Project not found: ${run.projectId}`);
    const baseline = await this.readBaseline(run.projectId, run.baselineId);
    if (!baseline) throw new Error(`Baseline not found: ${run.baselineId}`);
    const dir = this.runDir(run.projectId, run.id);
    await mkdir(dir, { recursive: true });
    await writeJson(join(dir, "run.json"), run);
  }

  async readRun(projectId: string, runId: string): Promise<ProjectRunRecord | null> {
    try {
      const run = await readJson<ProjectRunRecord>(join(this.runDir(projectId, runId), "run.json"));
      assertProjectOwnership(projectId, run, "Run");
      if (run.id !== runId) throw new Error(`Run file does not match run ${runId}.`);
      return run;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  async listRuns(projectId: string): Promise<ProjectRunRecord[]> {
    const runsRoot = join(this.projectDir(projectId), "runs");
    try {
      const entries = await readdir(runsRoot, { withFileTypes: true });
      const runs: ProjectRunRecord[] = [];
      for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        try {
          const run = await readJson<ProjectRunRecord>(join(runsRoot, entry.name, "run.json"));
          assertProjectOwnership(projectId, run, "Run");
          if (run.id !== entry.name) throw new Error(`Run directory does not match run ${run.id}.`);
          runs.push(run);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        }
      }
      return runs;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }

  async saveObservations(projectId: string, runId: string, observations: Observation[]): Promise<void> {
    const run = await this.readRun(projectId, runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    assertProjectCollection(projectId, observations, "Observation");
    for (const observation of observations) {
      if (observation.runId !== runId) throw new Error(`Observation does not belong to run ${runId}.`);
      if (observation.baselineId !== run.baselineId) throw new Error(`Observation does not belong to baseline ${run.baselineId}.`);
    }
    const dir = this.runDir(projectId, runId);
    await mkdir(dir, { recursive: true });
    const lines = observations.map((observation) => JSON.stringify(observation));
    const path = join(dir, "observations.jsonl");
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${lines.join("\n")}${lines.length ? "\n" : ""}`);
    await rename(temporaryPath, path);
  }

  async listObservations(projectId: string, query: ObservationQuery | string = {}): Promise<Observation[]> {
    const resolvedQuery = typeof query === "string" ? { runId: query } : query;
    const runs = resolvedQuery.runId
      ? [await this.readRun(projectId, resolvedQuery.runId)].filter((run): run is ProjectRunRecord => Boolean(run))
      : await this.listRuns(projectId);
    const observations: Observation[] = [];
    for (const run of runs) {
      try {
        const content = await readFile(join(this.runDir(projectId, run.id), "observations.jsonl"), "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const observation = JSON.parse(trimmed) as Observation;
          assertProjectOwnership(projectId, observation, "Observation");
          if (observation.runId !== run.id) throw new Error(`Observation does not belong to run ${run.id}.`);
          if (observation.baselineId !== run.baselineId) throw new Error(`Observation does not belong to baseline ${run.baselineId}.`);
          if (!resolvedQuery.baselineId || observation.baselineId === resolvedQuery.baselineId) observations.push(observation);
        }
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      }
    }
    return observations;
  }

  async saveDashboard(projectId: string, dashboard: unknown): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    if (!dashboard || typeof dashboard !== "object" || !("projectId" in dashboard)) {
      throw new Error("Dashboard must include its project id.");
    }
    const candidate = dashboard as { projectId?: unknown };
    if (candidate.projectId !== projectId) throw new Error(`Dashboard does not belong to project ${projectId}.`);
    const dir = this.projectDir(projectId);
    await mkdir(dir, { recursive: true });
    await writeJson(join(dir, "dashboard.json"), dashboard);
  }

  async readDashboard<T = unknown>(projectId: string): Promise<T | null> {
    try {
      const dashboard = await readJson<T>(join(this.projectDir(projectId), "dashboard.json"));
      if (!dashboard || typeof dashboard !== "object" || !("projectId" in dashboard)) {
        throw new Error("Dashboard does not declare its project id.");
      }
      const candidate = dashboard as { projectId?: unknown };
      if (candidate.projectId !== projectId) throw new Error(`Dashboard does not belong to project ${projectId}.`);
      return dashboard;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }
}

import type { AuditPlan, ReportBundle } from "../core/types.js";
import { randomUUID } from "node:crypto";
import { ANALYSIS_RULES_VERSION, PROMPT_SET_VERSION } from "../core/version.js";
import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { MonitoringProject } from "../projects/project-schema.js";
import type { ProjectMonitoringStore } from "../projects/project-store.js";
import { ProjectService, type MaterializedAuditRun } from "../projects/project-service.js";
import { AuditRunner, type AuditRunnerInput, type AuditRunnerOutput } from "../runner/audit-runner.js";
import { ProjectDashboardBuilder } from "../dashboard/project-dashboard-model.js";
import type { AuditProgressListener } from "../runner/audit-progress.js";

export interface RunBaselineInput {
  project: MonitoringProject;
  baseline: MonitoringBaseline;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  runsRoot?: string | undefined;
  onProgress?: AuditProgressListener | undefined;
}

export interface RunBaselineOutput {
  runnerOutput: AuditRunnerOutput;
  materialized: MaterializedAuditRun;
}

export interface BaselineRunExecutor {
  runBaseline(input: RunBaselineInput): Promise<RunBaselineOutput>;
}

export interface AuditExecutionEngine {
  run(input: AuditRunnerInput): Promise<AuditRunnerOutput>;
}

function auditPlanFromBaseline(project: MonitoringProject, baseline: MonitoringBaseline): AuditPlan {
  return {
    id: `plan-from-${baseline.id}`,
    submittedDomain: project.domain,
    target: project.target,
    competitors: project.competitors,
    prompts: baseline.prompts,
    providerTargets: baseline.providerTargets,
    language: baseline.language,
    autoDiscover: baseline.autoDiscover,
    keywordMode: baseline.keywordMode,
    promptSetId: `${baseline.promptSetVersion || PROMPT_SET_VERSION}-${baseline.promptSetHash}`,
    promptSetHash: baseline.promptSetHash,
    promptSetVersion: baseline.promptSetVersion || PROMPT_SET_VERSION,
    analysisRulesVersion: baseline.analysisRulesVersion || ANALYSIS_RULES_VERSION,
    runCountPerPrompt: baseline.runCountPerPrompt || 1,
    plannedAt: new Date().toISOString(),
    estimate: {
      enabledPromptCount: baseline.prompts.filter((prompt) => prompt.enabled).length,
      disabledPromptCount: baseline.prompts.filter((prompt) => !prompt.enabled).length,
      providerTargetCount: baseline.providerTargets.length,
      providerRunCount:
        baseline.prompts.filter((prompt) => prompt.enabled).length * baseline.providerTargets.length * (baseline.runCountPerPrompt || 1),
    },
  };
}

export class RunOrchestrator implements BaselineRunExecutor {
  private readonly service = new ProjectService();
  private readonly dashboards = new ProjectDashboardBuilder();

  constructor(
    private readonly store: ProjectMonitoringStore,
    private readonly runner: AuditExecutionEngine = new AuditRunner(),
  ) {}

  async runBaseline(input: RunBaselineInput): Promise<RunBaselineOutput> {
    if (input.baseline.projectId !== input.project.id) throw new Error("Baseline does not belong to the project.");
    if (input.project.status !== "active") throw new Error("Project is not active.");
    if (input.baseline.status !== "active") throw new Error("Baseline is not active.");
    const confirmedPlan = auditPlanFromBaseline(input.project, input.baseline);
    const startedAt = new Date().toISOString();
    const projectRunId = `run-${randomUUID()}`;
    const running = {
      id: projectRunId,
      projectId: input.project.id,
      baselineId: input.baseline.id,
      status: "running" as const,
      plannedObservationCount: confirmedPlan.estimate.providerRunCount,
      completedObservationCount: 0,
      failedObservationCount: 0,
      comparableKey: input.baseline.comparableKey,
      trendEligible: input.baseline.trendEligible,
      analysisStatus: "pending" as const,
      analysisCompletedObservationCount: 0,
      analysisIncompleteObservationCount: 0,
      startedAt,
      createdAt: startedAt,
    };
    await this.store.saveRun(running);
    let progressWrite = Promise.resolve();
    try {
      const runnerOutput = await this.runner.run({
        confirmedPlan,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        runsRoot: input.runsRoot,
        onProgress: (progress) => {
          progressWrite = progressWrite.then(async () => {
            await input.onProgress?.(progress);
            await this.store.saveRun({
              ...running,
              completedObservationCount: progress.completedObservationCount,
              failedObservationCount: progress.failedObservationCount,
            });
          });
          return progressWrite;
        },
      });
      await progressWrite;
      const materialized = await this.recordAuditOutput(runnerOutput.audit, runnerOutput.paths, {
        project: input.project,
        baseline: input.baseline,
        projectRunId,
      });
      return { runnerOutput, materialized };
    } catch (error) {
      const failedAt = new Date().toISOString();
      await this.store.saveRun({
        ...running,
        status: "failed",
        finishedAt: failedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.refreshDashboard(input.project.id);
      throw error;
    }
  }

  async recordAuditOutput(
    audit: AuditRunnerOutput["audit"],
    paths?: ReportBundle | undefined,
    context?: { project: MonitoringProject; baseline: MonitoringBaseline; projectRunId?: string | undefined } | undefined,
  ): Promise<MaterializedAuditRun> {
    const existing = context?.project || (await this.store.readProject(this.service.projectFromAuditRun(audit).id));
    const materialized = this.service.materializeAuditRun({
      audit,
      existingProject: existing || undefined,
      existingBaseline: context?.baseline,
      projectRunId: context?.projectRunId,
      paths,
    });
    await this.store.saveProject(materialized.project);
    await this.store.saveBaseline(materialized.baseline);
    await this.store.saveRun(materialized.run);
    await this.store.saveObservations(materialized.project.id, materialized.run.id, materialized.observations);
    await this.refreshDashboard(materialized.project.id);
    return materialized;
  }

  async refreshDashboard(projectId: string): Promise<void> {
    const project = await this.store.readProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const [baselines, runs, observations, tasks] = await Promise.all([
      this.store.listBaselines(projectId),
      this.store.listRuns(projectId),
      this.store.listObservations(projectId),
      this.store.listTasks(projectId),
    ]);
    const dashboard = this.dashboards.build({ project, baselines, runs, observations, tasks });
    await this.store.saveDashboard(projectId, dashboard);
  }
}

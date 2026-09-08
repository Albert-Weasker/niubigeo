import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { MonitoringTask } from "../monitoring/monitoring-task-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { MonitoringProject } from "../projects/project-schema.js";
import type { ProjectInsight } from "../insights/insight-schema.js";
import { ProjectInsightBuilder } from "../insights/project-insight-builder.js";
import { scopeToProject } from "../projects/project-scope.js";
import { isCompleteRun, isCurrentDataRun, RunSelector } from "./run-selection.js";

export interface BaselineDashboardSummary {
  baselineId: string;
  name: string;
  trendEligible: boolean;
  runCount: number;
  comparableRunCount: number;
  latestRunId?: string | undefined;
  latestFinishedAt?: string | undefined;
  latestRunStatus?: ProjectRunRecord["status"] | undefined;
  completedObservationCount: number;
  failedObservationCount: number;
}

export interface ProjectDashboardModel {
  projectId: string;
  projectName: string;
  domain: string;
  latestRunId?: string | undefined;
  latestFinishedAt?: string | undefined;
  latestRunStatus?: ProjectRunRecord["status"] | undefined;
  baselineSummaries: BaselineDashboardSummary[];
  totalObservations: number;
  completedObservations: number;
  failedObservations: number;
  nextRunAt?: string | undefined;
  insight: ProjectInsight;
}

export class ProjectDashboardBuilder {
  private readonly insights = new ProjectInsightBuilder();
  private readonly runSelector = new RunSelector();

  build(input: {
    project: MonitoringProject;
    baselines: MonitoringBaseline[];
    runs: ProjectRunRecord[];
    observations: Observation[];
    tasks?: MonitoringTask[] | undefined;
  }): ProjectDashboardModel {
    const projectId = input.project.id;
    const baselines = scopeToProject(projectId, input.baselines);
    const runs = scopeToProject(projectId, input.runs);
    const observations = scopeToProject(projectId, input.observations);
    const tasks = scopeToProject(projectId, input.tasks || []);
    const latestRun = this.runSelector.select({ projectId, baselines, runs }).selection.latestRun;
    const baselineSummaries = baselines
      .map((baseline) => {
        const baselineSelection = this.runSelector.select({
          projectId,
          baselines,
          runs,
          requestedBaselineId: baseline.id,
        }).selection;
        const baselineRuns = runs
          .filter((run) => run.baselineId === baseline.id)
          .sort((left, right) => (right.finishedAt || right.startedAt).localeCompare(left.finishedAt || left.startedAt));
        const comparableRunCount = baselineRuns.filter(
          (run) =>
            run.trendEligible &&
            Boolean(run.finishedAt) &&
            run.comparableKey === baseline.comparableKey &&
            isCurrentDataRun(run),
        ).length;
        const latest = baselineSelection.latestRun?.baselineId === baseline.id ? baselineSelection.latestRun : baselineRuns[0];
        const summary: BaselineDashboardSummary = {
          baselineId: baseline.id,
          name: baseline.name,
          trendEligible: baseline.trendEligible,
          runCount: baselineRuns.length,
          comparableRunCount,
          completedObservationCount: baselineRuns.reduce((sum, run) => sum + run.completedObservationCount, 0),
          failedObservationCount: baselineRuns.reduce((sum, run) => sum + run.failedObservationCount, 0),
        };
        if (latest) {
          summary.latestRunId = latest.id;
          summary.latestFinishedAt = latest.finishedAt || latest.startedAt;
          summary.latestRunStatus = latest.status;
        }
        return summary;
      })
      .sort((a, b) => {
        const latest = (b.latestFinishedAt || "").localeCompare(a.latestFinishedAt || "");
        if (latest !== 0) return latest;
        return a.name.localeCompare(b.name);
      });
    const model: ProjectDashboardModel = {
      projectId,
      projectName: input.project.name,
      domain: input.project.domain,
      baselineSummaries,
      totalObservations: observations.length,
      completedObservations: observations.filter((observation) => observation.status === "completed").length,
      failedObservations: observations.filter((observation) => observation.status === "failed").length,
      insight: this.insights.build({ project: input.project, baselines, runs, observations }),
    };
    if (latestRun) {
      model.latestRunId = latestRun.id;
      model.latestFinishedAt = latestRun.finishedAt || latestRun.startedAt;
      model.latestRunStatus = latestRun.status;
    }
    const nextRunAt = tasks
      .filter((task) => task.enabled && task.nextRunAt)
      .map((task) => task.nextRunAt as string)
      .sort((a, b) => a.localeCompare(b))[0];
    if (nextRunAt) model.nextRunAt = nextRunAt;
    return model;
  }
}

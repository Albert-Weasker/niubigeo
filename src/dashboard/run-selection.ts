import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import { runHasCurrentAnalysis } from "../observations/analysis-qualification.js";

export interface RunSelection {
  latestRun: ProjectRunRecord | null;
  latestCompleteRun: ProjectRunRecord | null;
  currentDataRun: ProjectRunRecord | null;
  comparisonCurrentRun: ProjectRunRecord | null;
  comparisonPreviousRun: ProjectRunRecord | null;
  latestProviderCompleteRun: ProjectRunRecord | null;
}

export interface RunSelectionDecision {
  baselineId: string | null;
  selection: RunSelection;
}

export function runFinishedAt(run: ProjectRunRecord): string {
  return run.finishedAt || run.startedAt;
}

export function isCompleteRun(run: ProjectRunRecord): boolean {
  return (
    run.status === "completed" &&
    run.plannedObservationCount > 0 &&
    run.completedObservationCount === run.plannedObservationCount &&
    run.failedObservationCount === 0
  );
}

export function isCurrentDataRun(run: ProjectRunRecord): boolean {
  return isCompleteRun(run) && runHasCurrentAnalysis(run);
}

export function newestRunsFirst(runs: ProjectRunRecord[]): ProjectRunRecord[] {
  return [...runs].sort((left, right) => runFinishedAt(right).localeCompare(runFinishedAt(left)));
}

export class RunSelector {
  select(input: {
    projectId: string;
    baselines: MonitoringBaseline[];
    runs: ProjectRunRecord[];
    requestedBaselineId?: string | undefined;
  }): RunSelectionDecision {
    const projectBaselines = input.baselines.filter((baseline) => baseline.projectId === input.projectId);
    const projectRuns = newestRunsFirst(input.runs.filter((run) => run.projectId === input.projectId));
    const latestRun = projectRuns[0] || null;
    const latestCompleteRun = projectRuns.find(isCompleteRun) || null;
    const requestedBaseline = projectBaselines.find((baseline) => baseline.id === input.requestedBaselineId);
    const latestRunBaseline = projectBaselines.find((baseline) => baseline.id === latestRun?.baselineId);
    const activeBaseline = [...projectBaselines]
      .filter((baseline) => baseline.status === "active")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const selectedBaseline = requestedBaseline || activeBaseline || latestRunBaseline || projectBaselines[0] || null;
    const baselineRuns = selectedBaseline
      ? projectRuns.filter((run) => run.baselineId === selectedBaseline.id)
      : [];
    const latestProviderCompleteRun = baselineRuns.find(isCompleteRun) || null;
    const currentDataRun = baselineRuns.find(isCurrentDataRun) || null;
    const comparableRuns = selectedBaseline
      ? baselineRuns.filter(
          (run) =>
            isCurrentDataRun(run) &&
            run.trendEligible &&
            selectedBaseline.trendEligible &&
            run.comparableKey === selectedBaseline.comparableKey,
        )
      : [];

    return {
      baselineId: selectedBaseline?.id || null,
      selection: {
        latestRun,
        latestCompleteRun,
        currentDataRun,
        comparisonCurrentRun: comparableRuns[0] || null,
        comparisonPreviousRun: comparableRuns[1] || null,
        latestProviderCompleteRun,
      },
    };
  }
}

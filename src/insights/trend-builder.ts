import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { BaselineTrend, TrendPoint } from "./insight-schema.js";
import { aggregateObservations } from "./observation-aggregate.js";
import { isCurrentDataRun } from "../dashboard/run-selection.js";

export class TrendBuilder {
  build(input: {
    baseline: MonitoringBaseline;
    baselines: MonitoringBaseline[];
    runs: ProjectRunRecord[];
    observations: Observation[];
  }): BaselineTrend {
    if (!input.baseline.trendEligible) {
      return {
        baselineId: input.baseline.id,
        comparableKey: input.baseline.comparableKey,
        comparable: false,
        reason: input.baseline.nonComparableReason || "Baseline is not eligible for trend comparison.",
        points: [],
      };
    }
    const comparableRuns = input.runs
      .filter((run) => {
        return (
          run.projectId === input.baseline.projectId &&
          run.baselineId === input.baseline.id &&
          run.comparableKey === input.baseline.comparableKey &&
          run.trendEligible &&
          Boolean(run.finishedAt) &&
          isCurrentDataRun(run)
        );
      })
      .sort((a, b) => (a.finishedAt || a.startedAt).localeCompare(b.finishedAt || b.startedAt));
    const points: TrendPoint[] = comparableRuns.map((run) => ({
      runId: run.id,
      finishedAt: run.finishedAt || run.startedAt,
      ...aggregateObservations(input.observations.filter((observation) => observation.runId === run.id)),
    }));
    return {
      baselineId: input.baseline.id,
      comparableKey: input.baseline.comparableKey,
      comparable: points.length >= 2,
      reason: points.length >= 2 ? "Runs share the same monitoring conditions." : "At least two comparable runs are required for a trend.",
      points,
    };
  }
}

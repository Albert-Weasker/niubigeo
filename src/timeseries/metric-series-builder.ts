import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import { MonitoringMetricCalculator, type MonitoringMetricId } from "../metrics/monitoring-metrics.js";
import { ComparablePeriodSelector } from "./comparable-period-selector.js";
import type { MetricSeries, TrendFilter, TrendEligibilityState } from "./timeseries-schema.js";
import { isCurrentDataRun } from "../dashboard/run-selection.js";
import { MetricEvidenceDiff } from "./metric-evidence-diff.js";

function stateFor(input: {
  pointCount: number;
  completeRunCount: number;
  distinctDayCount: number;
  partialRunCount: number;
  range: TrendFilter["range"];
  hasOtherCompleteBaseline: boolean;
}): TrendEligibilityState {
  if (input.pointCount >= 2) return "ready";
  if (input.range !== "24h" && input.completeRunCount > 1 && input.distinctDayCount === 1) return "same_day_only";
  if (input.hasOtherCompleteBaseline) return "baseline_changed";
  if (input.completeRunCount === 0) return input.partialRunCount > 0 ? "partial_run" : "no_data";
  if (input.pointCount === 0) return "no_data";
  return "first_observation";
}

const EXPLANATION_KEYS: Record<TrendEligibilityState, string> = {
  ready: "trend.ready",
  first_observation: "trend.firstObservation",
  same_day_only: "trend.sameDayOnly",
  partial_run: "trend.partialRun",
  baseline_changed: "trend.baselineChanged",
  no_data: "trend.noData",
};

export class MetricSeriesBuilder {
  private readonly periods = new ComparablePeriodSelector();
  private readonly metrics = new MonitoringMetricCalculator();
  private readonly evidenceDiff = new MetricEvidenceDiff();

  build(input: {
    projectId: string;
    baselineId: string;
    metricId: MonitoringMetricId;
    runs: ProjectRunRecord[];
    observations: Observation[];
    filter: TrendFilter;
  }): MetricSeries {
    const projectRuns = input.runs.filter((run) => run.projectId === input.projectId);
    const projectObservations = input.observations.filter((observation) => observation.projectId === input.projectId);
    const selection = this.periods.select(projectRuns, input.baselineId, input.filter);
    const snapshots = selection.runs.map((run) => {
      const observations = projectObservations.filter((observation) => {
        if (observation.runId !== run.id) return false;
        if (input.filter.model && observation.model !== input.filter.model) return false;
        if (input.filter.searchUsed !== undefined && observation.search?.used !== input.filter.searchUsed) return false;
        return true;
      });
      return {
        observations,
        point: {
          runId: run.id,
          baselineId: input.baselineId,
          bucket: this.periods.bucket(run, input.filter),
          observedAt: run.finishedAt || run.startedAt,
          result: this.metrics.calculate(input.metricId, observations, {
            projectId: input.projectId,
            baselineId: input.baselineId,
            runId: run.id,
            model: input.filter.model,
            searchUsed: input.filter.searchUsed,
          }),
        },
      };
    });
    const points = snapshots.map((snapshot, index) => {
      const point = snapshot.point;
      const previous = snapshots[index - 1];
      if (!previous) return point;
      const evidenceChange = this.evidenceDiff.compare(
        input.metricId,
        snapshot.observations,
        previous.observations,
      );
      const comparable =
        evidenceChange.comparable &&
        point.result.denominator > 0 &&
        previous.point.result.denominator > 0 &&
        point.result.denominator === previous.point.result.denominator;
      return {
        ...point,
        previousComparableRunId: previous.point.runId,
        change: {
          comparable,
          delta: comparable ? point.result.numerator - previous.point.result.numerator : null,
        },
        evidenceChange,
      };
    });
    const state = stateFor({
      pointCount: points.filter((point) => point.result.value !== null).length,
      completeRunCount: selection.completeRunCount,
      distinctDayCount: selection.distinctDayCount,
      partialRunCount: selection.partialRunCount,
      range: input.filter.range,
      hasOtherCompleteBaseline: projectRuns.some(
        (run) => run.baselineId !== input.baselineId && isCurrentDataRun(run) && run.trendEligible && Boolean(run.finishedAt),
      ),
    });
    return {
      metricId: input.metricId,
      baselineId: input.baselineId,
      state,
      explanationKey: EXPLANATION_KEYS[state],
      points,
      excludedRunIds: selection.excludedRunIds,
    };
  }
}

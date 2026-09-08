import type { EntityRelationship, EntityRelationshipType } from "../intent/intent-schema.js";
import type { MonitoringMetricId, MonitoringMetricResult } from "../metrics/monitoring-metrics.js";
import {
  MONITORING_METRIC_VERSION,
  MonitoringMetricCalculator,
  monitoringMetricEligible,
} from "../metrics/monitoring-metrics.js";
import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import { EntityRegistryBuilder } from "../entities/entity-registry-builder.js";
import type { ResolvedEntity } from "../entities/entity-schema.js";
import { ComparablePeriodSelector } from "./comparable-period-selector.js";
import type { BrandComparisonLine, BrandComparisonSeries, MetricSeriesPoint, TrendEligibilityState, TrendFilter } from "./timeseries-schema.js";
import { isCurrentDataRun } from "../dashboard/run-selection.js";
import { MetricEvidenceDiff } from "./metric-evidence-diff.js";

const CANDIDATE_RELATIONSHIPS = new Set<EntityRelationshipType>([
  "recommended_option",
  "compared_option",
  "direct_alternative",
  "indirect_alternative",
  "evaluated_candidate",
  "competitor",
]);

function relationship(entity: EntityRelationship): EntityRelationshipType {
  return entity.relationshipToTarget !== "unclear" ? entity.relationshipToTarget : entity.relationshipToQuestion;
}

function confirmedIdentity(entity: EntityRelationship, competitor: ResolvedEntity): boolean {
  return Boolean(
    entity.identityStatus === "confirmed" &&
    entity.entityRole === "product_or_brand" &&
    entity.canonicalUrl &&
    entity.canonicalUrl === competitor.canonicalUrl &&
    entity.evidenceQuote &&
    entity.sourceUrls.includes(entity.canonicalUrl),
  );
}

function competitorMatches(metricId: MonitoringMetricId, observation: Observation, competitor: ResolvedEntity): boolean {
  if (observation.intentAnalysis?.status !== "completed") return false;
  const entities = observation.intentAnalysis.entities.filter((entity) => confirmedIdentity(entity, competitor));
  if (metricId === "brand_discovery") return entities.length > 0;
  if (metricId === "official_citation") return entities.some((entity) => Boolean(entity.canonicalUrl && entity.sourceUrls.includes(entity.canonicalUrl)));
  if (metricId === "explicit_recommendation") return entities.some((entity) => relationship(entity) === "recommended_option");
  return entities.some((entity) => CANDIDATE_RELATIONSHIPS.has(relationship(entity)));
}

function competitorMetric(
  metricId: MonitoringMetricId,
  observations: Observation[],
  competitor: ResolvedEntity,
  scope: MonitoringMetricResult["scope"],
): MonitoringMetricResult {
  const denominatorRows = observations.filter((observation) => monitoringMetricEligible(metricId, observation));
  const numeratorRows = denominatorRows.filter((observation) => competitorMatches(metricId, observation, competitor));
  return {
    metricId,
    metricVersion: MONITORING_METRIC_VERSION,
    numerator: numeratorRows.length,
    denominator: denominatorRows.length,
    value: denominatorRows.length > 0 ? numeratorRows.length / denominatorRows.length : null,
    observationIds: numeratorRows.map((observation) => observation.id),
    denominatorObservationIds: denominatorRows.map((observation) => observation.id),
    excludedObservationIds: observations.filter((observation) => !denominatorRows.includes(observation)).map((observation) => observation.id),
    scope,
  };
}

function stateFor(input: {
  validPoints: number;
  completeRuns: number;
  distinctDays: number;
  partialRuns: number;
  range: TrendFilter["range"];
  hasOtherBaseline: boolean;
}): TrendEligibilityState {
  if (input.validPoints >= 2) return "ready";
  if (input.range !== "24h" && input.completeRuns > 1 && input.distinctDays === 1) return "same_day_only";
  if (input.hasOtherBaseline) return "baseline_changed";
  if (input.completeRuns === 0) return input.partialRuns > 0 ? "partial_run" : "no_data";
  if (input.validPoints === 0) return "no_data";
  return "first_observation";
}

const EXPLANATIONS: Record<TrendEligibilityState, string> = {
  ready: "trend.ready",
  first_observation: "trend.firstObservation",
  same_day_only: "trend.sameDayOnly",
  partial_run: "trend.partialRun",
  baseline_changed: "trend.baselineChanged",
  no_data: "trend.noData",
};

export class BrandComparisonSeriesBuilder {
  private readonly periods = new ComparablePeriodSelector();
  private readonly targetMetrics = new MonitoringMetricCalculator();
  private readonly registry = new EntityRegistryBuilder();
  private readonly evidenceDiff = new MetricEvidenceDiff();

  build(input: {
    projectId: string;
    projectName: string;
    baselineId: string;
    metricId: MonitoringMetricId;
    runs: ProjectRunRecord[];
    observations: Observation[];
    filter: TrendFilter;
  }): BrandComparisonSeries {
    const projectRuns = input.runs.filter((run) => run.projectId === input.projectId);
    const projectObservations = input.observations.filter((observation) => observation.projectId === input.projectId);
    const selection = this.periods.select(projectRuns, input.baselineId, input.filter);
    const runIds = new Set(selection.runs.map((run) => run.id));
    const baselineObservations = projectObservations.filter((observation) => observation.baselineId === input.baselineId && runIds.has(observation.runId));
    const competitors = this.registry.build(baselineObservations).confirmedCompetitors.slice(0, 4);
    const lineDefinitions: Array<{ key: string; name: string; competitor?: ResolvedEntity }> = [
      { key: "target", name: input.projectName },
      ...competitors.map((competitor) => ({ key: competitor.key, name: competitor.canonicalName || competitor.name, competitor })),
    ];
    const brands: BrandComparisonLine[] = lineDefinitions.map((definition) => {
      const snapshots = selection.runs.map((run) => {
        const observations = projectObservations.filter((observation) => {
          if (observation.runId !== run.id) return false;
          if (input.filter.model && observation.model !== input.filter.model) return false;
          if (input.filter.searchUsed !== undefined && observation.search?.used !== input.filter.searchUsed) return false;
          return true;
        });
        const scope = {
          projectId: input.projectId,
          baselineId: input.baselineId,
          runId: run.id,
          model: input.filter.model,
          searchUsed: input.filter.searchUsed,
        };
        const result = definition.competitor
          ? competitorMetric(input.metricId, observations, definition.competitor, scope)
          : this.targetMetrics.calculate(input.metricId, observations, scope);
        return {
          observations,
          point: {
            runId: run.id,
            baselineId: input.baselineId,
            bucket: this.periods.bucket(run, input.filter),
            observedAt: run.finishedAt || run.startedAt,
            result,
          } satisfies MetricSeriesPoint,
        };
      });
      const points: MetricSeriesPoint[] = snapshots.map((snapshot, index) => {
        const previous = snapshots[index - 1];
        if (!previous) return snapshot.point;
        const matches = definition.competitor
          ? (observation: Observation) => competitorMatches(input.metricId, observation, definition.competitor as ResolvedEntity)
          : undefined;
        const evidenceChange = this.evidenceDiff.compare(
          input.metricId,
          snapshot.observations,
          previous.observations,
          matches,
        );
        const comparable =
          evidenceChange.comparable &&
          snapshot.point.result.denominator > 0 &&
          previous.point.result.denominator > 0 &&
          snapshot.point.result.denominator === previous.point.result.denominator;
        return {
          ...snapshot.point,
          previousComparableRunId: previous.point.runId,
          change: {
            comparable,
            delta: comparable ? snapshot.point.result.numerator - previous.point.result.numerator : null,
          },
          evidenceChange,
        };
      });
      const line: BrandComparisonLine = { key: definition.key, name: definition.name, points };
      if (definition.competitor?.canonicalUrl) line.canonicalUrl = definition.competitor.canonicalUrl;
      return line;
    });
    const target = brands[0];
    const validPoints = target?.points.filter((point) => point.result.value !== null).length || 0;
    const state = stateFor({
      validPoints,
      completeRuns: selection.completeRunCount,
      distinctDays: selection.distinctDayCount,
      partialRuns: selection.partialRunCount,
      range: input.filter.range,
      hasOtherBaseline: projectRuns.some(
        (run) => run.baselineId !== input.baselineId && isCurrentDataRun(run) && run.trendEligible && Boolean(run.finishedAt),
      ),
    });
    return {
      metricId: input.metricId,
      baselineId: input.baselineId,
      state,
      explanationKey: EXPLANATIONS[state],
      brands,
      excludedRunIds: selection.excludedRunIds,
    };
  }
}

import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { MonitoringProject } from "../projects/project-schema.js";
import { CitationLandscapeBuilder } from "./citation-landscape.js";
import { CompetitorLandscapeBuilder } from "./competitor-landscape.js";
import type { ProjectInsight } from "./insight-schema.js";
import { IntentOutcomeBuilder } from "./intent-outcome-builder.js";
import { aggregateObservations } from "./observation-aggregate.js";
import { TrendBuilder } from "./trend-builder.js";
import { ProjectChangeBuilder } from "./project-change-builder.js";
import { MonitoringMetricCalculator, MONITORING_METRIC_IDS } from "../metrics/monitoring-metrics.js";
import { MetricSeriesBuilder } from "../timeseries/metric-series-builder.js";
import { EvidenceChangeBuilder } from "../changes/evidence-change-builder.js";
import { EntityRegistryBuilder } from "../entities/entity-registry-builder.js";
import { scopeToProject } from "../projects/project-scope.js";
import { RunSelector } from "../dashboard/run-selection.js";

export class ProjectInsightBuilder {
  private readonly trends = new TrendBuilder();
  private readonly competitors = new CompetitorLandscapeBuilder();
  private readonly citations = new CitationLandscapeBuilder();
  private readonly intentOutcomes = new IntentOutcomeBuilder();
  private readonly changes = new ProjectChangeBuilder();
  private readonly metrics = new MonitoringMetricCalculator();
  private readonly metricSeries = new MetricSeriesBuilder();
  private readonly evidenceChanges = new EvidenceChangeBuilder();
  private readonly entities = new EntityRegistryBuilder();
  private readonly runSelector = new RunSelector();

  build(input: {
    project: MonitoringProject;
    baselines: MonitoringBaseline[];
    runs: ProjectRunRecord[];
    observations: Observation[];
    generatedAt?: string | undefined;
  }): ProjectInsight {
    const projectId = input.project.id;
    const baselines = scopeToProject(projectId, input.baselines);
    const runs = scopeToProject(projectId, input.runs);
    const observations = scopeToProject(projectId, input.observations);
    const runSelection = this.runSelector.select({ projectId, baselines, runs }).selection;
    const currentDataRun = runSelection.currentDataRun;
    const latestObservations = currentDataRun
      ? observations.filter((observation) => observation.runId === currentDataRun.id)
      : [];
    const insight: ProjectInsight = {
      projectId,
      generatedAt: input.generatedAt || new Date().toISOString(),
      cumulative: aggregateObservations(observations),
      trends: baselines.map((baseline) =>
        this.trends.build({ baseline, baselines, runs, observations }),
      ),
      changes: baselines.map((baseline) =>
        this.changes.build({ baseline, baselines, runs, observations }),
      ),
      competitors: this.competitors.build(input.project.competitors, observations),
      citations: this.citations.build(observations),
      intentOutcomes: this.intentOutcomes.build(observations),
      latestMetrics: this.metrics.calculateAll(latestObservations, {
        projectId,
        baselineId: currentDataRun?.baselineId,
        runId: currentDataRun?.id,
      }),
      metricSeries: baselines.flatMap((baseline) =>
        MONITORING_METRIC_IDS.map((metricId) =>
          this.metricSeries.build({
            projectId,
            baselineId: baseline.id,
            metricId,
            runs,
            observations,
            filter: { range: "all", timezone: "UTC" },
          }),
        ),
      ),
      evidenceChanges: baselines.map((baseline) => {
        const selection = this.runSelector.select({
          projectId,
          baselines,
          runs,
          requestedBaselineId: baseline.id,
        }).selection;
        return this.evidenceChanges.build({
          baselineId: baseline.id,
          currentRun: selection.comparisonCurrentRun,
          previousRun: selection.comparisonPreviousRun,
          observations,
        });
      }),
      entityRegistry: this.entities.build(observations),
    };
    if (runSelection.latestRun) insight.latestRunId = runSelection.latestRun.id;
    if (currentDataRun) {
      insight.latestRun = aggregateObservations(observations.filter((observation) => observation.runId === currentDataRun.id));
    }
    return insight;
  }
}

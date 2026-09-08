import type { Observation } from "../observations/observation-schema.js";
import { OBSERVATION_ANALYSIS_VERSION } from "../core/version.js";

export const MONITORING_METRIC_VERSION = "monitoring-metrics-v2" as const;

export const MONITORING_METRIC_IDS = [
  "brand_discovery",
  "candidate_inclusion",
  "explicit_recommendation",
  "official_citation",
] as const;

export type MonitoringMetricId = (typeof MONITORING_METRIC_IDS)[number];

export interface ObservationScope {
  projectId?: string | undefined;
  baselineId?: string | undefined;
  runId?: string | undefined;
  model?: string | undefined;
  searchUsed?: boolean | undefined;
}

export interface MonitoringMetricResult {
  metricId: MonitoringMetricId;
  metricVersion: typeof MONITORING_METRIC_VERSION;
  numerator: number;
  denominator: number;
  value: number | null;
  observationIds: string[];
  denominatorObservationIds: string[];
  excludedObservationIds: string[];
  scope: ObservationScope;
}

function completed(observation: Observation): boolean {
  return (
    observation.status === "completed" &&
    observation.evidence.hasAnswer &&
    observation.analysisVersion === OBSERVATION_ANALYSIS_VERSION &&
    observation.analysisStatus === "completed"
  );
}

export function monitoringMetricEligible(metricId: MonitoringMetricId, observation: Observation): boolean {
  if (!completed(observation)) return false;
  if (metricId === "brand_discovery") return observation.promptAuditCategory === "organic_discovery";
  if (metricId === "candidate_inclusion") return typeof observation.analysisResult?.brandCandidate === "boolean";
  if (metricId === "explicit_recommendation") return typeof observation.analysisResult?.brandRecommended === "boolean";
  return observation.search?.requested === true;
}

export function targetMatchesMonitoringMetric(metricId: MonitoringMetricId, observation: Observation): boolean {
  if (metricId === "brand_discovery") return observation.analysisResult?.brandMentioned === true;
  if (metricId === "official_citation") return observation.evidence.officialCitationCount > 0;
  if (metricId === "explicit_recommendation") return observation.analysisResult?.brandRecommended === true;
  return observation.analysisResult?.brandCandidate === true;
}

export class MonitoringMetricCalculator {
  calculate(metricId: MonitoringMetricId, observations: Observation[], scope: ObservationScope = {}): MonitoringMetricResult {
    const scopedRows = observations.filter((observation) => {
      if (scope.projectId && observation.projectId !== scope.projectId) return false;
      if (scope.baselineId && observation.baselineId !== scope.baselineId) return false;
      if (scope.runId && observation.runId !== scope.runId) return false;
      if (scope.model && observation.model !== scope.model) return false;
      if (scope.searchUsed !== undefined && observation.search?.used !== scope.searchUsed) return false;
      return true;
    });
    const denominatorRows = scopedRows.filter((observation) => monitoringMetricEligible(metricId, observation));
    const numeratorRows = denominatorRows.filter((observation) => targetMatchesMonitoringMetric(metricId, observation));
    const denominator = denominatorRows.length;
    return {
      metricId,
      metricVersion: MONITORING_METRIC_VERSION,
      numerator: numeratorRows.length,
      denominator,
      value: denominator > 0 ? numeratorRows.length / denominator : null,
      observationIds: numeratorRows.map((observation) => observation.id),
      denominatorObservationIds: denominatorRows.map((observation) => observation.id),
      excludedObservationIds: scopedRows.filter((observation) => !denominatorRows.includes(observation)).map((observation) => observation.id),
      scope,
    };
  }

  calculateAll(observations: Observation[], scope: ObservationScope = {}): MonitoringMetricResult[] {
    return MONITORING_METRIC_IDS.map((metricId) => this.calculate(metricId, observations, scope));
  }
}

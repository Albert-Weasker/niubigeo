import {
  monitoringMetricEligible,
  targetMatchesMonitoringMetric,
  type MonitoringMetricId,
} from "../metrics/monitoring-metrics.js";
import type { Observation } from "../observations/observation-schema.js";
import type { MetricEvidenceChange, MetricEvidencePair } from "./timeseries-schema.js";

function observationIdentity(observation: Observation): string {
  return JSON.stringify([
    observation.promptId,
    observation.providerId,
    observation.model,
    observation.sampleIndex,
  ]);
}

function eligibleByIdentity(metricId: MonitoringMetricId, observations: Observation[]): Map<string, Observation> {
  const rows = observations.filter((observation) => monitoringMetricEligible(metricId, observation));
  return new Map(rows.map((observation) => [observationIdentity(observation), observation]));
}

function sameIdentities(current: Map<string, Observation>, previous: Map<string, Observation>): boolean {
  if (current.size !== previous.size) return false;
  for (const key of current.keys()) {
    if (!previous.has(key)) return false;
  }
  return true;
}

export class MetricEvidenceDiff {
  compare(
    metricId: MonitoringMetricId,
    current: Observation[],
    previous: Observation[],
    matches: (observation: Observation) => boolean = (observation) => targetMatchesMonitoringMetric(metricId, observation),
  ): MetricEvidenceChange {
    const currentEligible = eligibleByIdentity(metricId, current);
    const previousEligible = eligibleByIdentity(metricId, previous);
    if (!sameIdentities(currentEligible, previousEligible)) {
      return {
        comparable: false,
        reasonKey: "trend.denominatorIdentityChanged",
        addedCurrentObservationIds: [],
        persistedObservationPairs: [],
        removedPreviousObservationIds: [],
      };
    }

    const addedCurrentObservationIds: string[] = [];
    const persistedObservationPairs: MetricEvidencePair[] = [];
    const removedPreviousObservationIds: string[] = [];
    for (const [key, currentObservation] of currentEligible) {
      const previousObservation = previousEligible.get(key);
      if (!previousObservation) continue;
      const currentMatched = matches(currentObservation);
      const previousMatched = matches(previousObservation);
      if (currentMatched && previousMatched) {
        persistedObservationPairs.push({
          currentObservationId: currentObservation.id,
          previousObservationId: previousObservation.id,
        });
      } else if (currentMatched) {
        addedCurrentObservationIds.push(currentObservation.id);
      } else if (previousMatched) {
        removedPreviousObservationIds.push(previousObservation.id);
      }
    }

    return {
      comparable: true,
      reasonKey: "trend.sameObservationScope",
      addedCurrentObservationIds,
      persistedObservationPairs,
      removedPreviousObservationIds,
    };
  }
}

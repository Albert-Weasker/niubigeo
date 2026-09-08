import { DISPLAY_MODES, INTENT_NAMES, TASK_STATUSES, type IntentDisplayMode, type IntentName, type TaskStatus } from "../intent/intent-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { IntentOutcome } from "./insight-schema.js";

function increment<T extends string>(map: Map<T, number>, key: T): void {
  map.set(key, (map.get(key) || 0) + 1);
}

export class IntentOutcomeBuilder {
  build(observations: Observation[]): IntentOutcome {
    const intentCounts = new Map<IntentName, number>();
    const modeCounts = new Map<IntentDisplayMode, number>();
    const statusCounts = new Map<TaskStatus, number>();
    const missing = new Map<string, { requirement: string; count: number; observationIds: string[] }>();
    let analyzedObservationCount = 0;
    let failedAnalysisCount = 0;

    for (const observation of observations) {
      const analysis = observation.intentAnalysis;
      if (!analysis || analysis.status !== "completed") {
        if (analysis?.status === "failed") failedAnalysisCount += 1;
        continue;
      }
      analyzedObservationCount += 1;
      increment(intentCounts, analysis.promptIntent.primaryIntent);
      increment(modeCounts, analysis.adaptedResult.displayMode);
      for (const result of analysis.taskResults) {
        increment(statusCounts, result.status);
        if (result.status !== "missing" && result.status !== "partial") continue;
        const task = analysis.tasks.find((item) => item.id === result.taskId);
        const requirement = task?.requirement || result.explanation;
        if (!requirement) continue;
        const current = missing.get(requirement) || { requirement, count: 0, observationIds: [] };
        current.count += 1;
        if (!current.observationIds.includes(observation.id)) current.observationIds.push(observation.id);
        missing.set(requirement, current);
      }
    }

    return {
      analyzedObservationCount,
      failedAnalysisCount,
      primaryIntents: INTENT_NAMES.map((intent) => ({ intent, count: intentCounts.get(intent) || 0 })).filter((row) => row.count > 0),
      displayModes: DISPLAY_MODES.map((mode) => ({ mode, count: modeCounts.get(mode) || 0 })).filter((row) => row.count > 0),
      taskStatuses: TASK_STATUSES.map((status) => ({ status, count: statusCounts.get(status) || 0 })),
      missingRequirements: [...missing.values()].sort((a, b) => b.count - a.count || a.requirement.localeCompare(b.requirement)),
    };
  }
}

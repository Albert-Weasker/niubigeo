import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { EvidenceBackedChangeSet } from "./change-schema.js";
import { ObservationDiff } from "./observation-diff.js";
import { isCurrentDataRun } from "../dashboard/run-selection.js";

export class EvidenceChangeBuilder {
  private readonly diff = new ObservationDiff();

  build(input: {
    baselineId: string;
    currentRun: ProjectRunRecord | null;
    previousRun: ProjectRunRecord | null;
    observations: Observation[];
  }): EvidenceBackedChangeSet {
    const current = input.currentRun;
    const previous = input.previousRun;
    if (!current || !previous) return { comparable: false, reasonKey: "changes.twoCompleteRunsRequired", changes: [] };
    if (
      current.baselineId !== input.baselineId ||
      previous.baselineId !== input.baselineId ||
      current.projectId !== previous.projectId ||
      current.comparableKey !== previous.comparableKey ||
      !isCurrentDataRun(current) ||
      !isCurrentDataRun(previous)
    ) {
      return {
        comparable: false,
        reasonKey: "changes.runSelectionNotComparable",
        currentRunId: current.id,
        previousRunId: previous.id,
        changes: [],
      };
    }
    const currentRows = input.observations.filter((observation) => observation.runId === current.id);
    const previousRows = input.observations.filter((observation) => observation.runId === previous.id);
    return {
      comparable: true,
      reasonKey: "changes.comparable",
      currentRunId: current.id,
      previousRunId: previous.id,
      changes: this.diff.compare(currentRows, previousRows),
    };
  }
}

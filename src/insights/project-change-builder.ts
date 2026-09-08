import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { ProjectChangeSet } from "./insight-schema.js";
import { RunSelector } from "../dashboard/run-selection.js";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function difference(a: string[], b: string[]): string[] {
  const other = new Set(b);
  return a.filter((value) => !other.has(value));
}

function observedPrompts(observations: Observation[]): string[] {
  return unique(observations.filter((observation) => observation.evidence.targetMentioned).map((observation) => observation.promptText));
}

function observedCompetitors(observations: Observation[]): string[] {
  return unique(observations.flatMap((observation) => observation.evidence.mentionedCompetitors));
}

function observedCitations(observations: Observation[]): string[] {
  return unique(observations.flatMap((observation) => observation.citations.map((citation) => citation.url)));
}

function emptyChangeSet(baseline: MonitoringBaseline, reason: string): ProjectChangeSet {
  return {
    baselineId: baseline.id,
    comparable: false,
    reason,
    prompts: { newlyVisible: [], disappeared: [], persistentlyVisible: [], persistentlyAbsent: [] },
    competitors: { newlyObserved: [], disappeared: [] },
    citations: { newlyObserved: [], disappeared: [] },
  };
}

export class ProjectChangeBuilder {
  private readonly runs = new RunSelector();

  build(input: {
    baseline: MonitoringBaseline;
    baselines: MonitoringBaseline[];
    runs: ProjectRunRecord[];
    observations: Observation[];
  }): ProjectChangeSet {
    if (!input.baseline.trendEligible) return emptyChangeSet(input.baseline, "Baseline is not eligible for comparison.");
    const selection = this.runs.select({
      projectId: input.baseline.projectId,
      baselines: input.baselines,
      runs: input.runs,
      requestedBaselineId: input.baseline.id,
    }).selection;
    const current = selection.comparisonCurrentRun;
    const previous = selection.comparisonPreviousRun;
    if (!current || !previous) return emptyChangeSet(input.baseline, "At least two comparable runs are required.");
    const currentObservations = input.observations.filter((observation) => observation.runId === current.id);
    const previousObservations = input.observations.filter((observation) => observation.runId === previous.id);
    const currentVisible = observedPrompts(currentObservations);
    const previousVisible = observedPrompts(previousObservations);
    const allPrompts = unique(input.baseline.prompts.filter((prompt) => prompt.enabled).map((prompt) => prompt.text));
    const persistentlyVisible = currentVisible.filter((prompt) => previousVisible.includes(prompt));
    const absentNow = difference(allPrompts, currentVisible);
    const absentBefore = difference(allPrompts, previousVisible);
    const currentCompetitors = observedCompetitors(currentObservations);
    const previousCompetitors = observedCompetitors(previousObservations);
    const currentCitations = observedCitations(currentObservations);
    const previousCitations = observedCitations(previousObservations);
    return {
      baselineId: input.baseline.id,
      comparable: true,
      reason: "Both runs completed under the same monitoring conditions.",
      currentRunId: current.id,
      previousRunId: previous.id,
      prompts: {
        newlyVisible: difference(currentVisible, previousVisible),
        disappeared: difference(previousVisible, currentVisible),
        persistentlyVisible,
        persistentlyAbsent: absentNow.filter((prompt) => absentBefore.includes(prompt)),
      },
      competitors: {
        newlyObserved: difference(currentCompetitors, previousCompetitors),
        disappeared: difference(previousCompetitors, currentCompetitors),
      },
      citations: {
        newlyObserved: difference(currentCitations, previousCitations),
        disappeared: difference(previousCitations, currentCitations),
      },
    };
  }
}

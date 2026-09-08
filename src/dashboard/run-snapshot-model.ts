import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { MonitoringProject } from "../projects/project-schema.js";
import { CitationLandscapeBuilder } from "../insights/citation-landscape.js";
import { CompetitorLandscapeBuilder } from "../insights/competitor-landscape.js";
import type { CitationLandscape, CompetitorLandscape, IntentOutcome, ObservationAggregate } from "../insights/insight-schema.js";
import { IntentOutcomeBuilder } from "../insights/intent-outcome-builder.js";
import { aggregateObservations } from "../insights/observation-aggregate.js";
import { assertProjectOwnership, scopeToProject } from "../projects/project-scope.js";

export interface ObservationSnapshot {
  id: string;
  promptText: string;
  providerId: string;
  model: string;
  status: Observation["status"];
  targetMentioned: boolean;
  mentionedCompetitors: string[];
  citationUrls: string[];
  answerText?: string | undefined;
  intentAnalysis?: Observation["intentAnalysis"] | undefined;
}

export interface RunSnapshotModel {
  project: Pick<MonitoringProject, "id" | "name" | "domain">;
  baseline: Pick<
    MonitoringBaseline,
    "id" | "name" | "language" | "providerTargets" | "promptSetHash" | "promptSetVersion" | "analysisRulesVersion" | "runCountPerPrompt"
  >;
  run: ProjectRunRecord;
  result: ObservationAggregate;
  competitors: CompetitorLandscape;
  citations: CitationLandscape;
  intentOutcomes: IntentOutcome;
  observations: ObservationSnapshot[];
}

export class RunSnapshotBuilder {
  private readonly competitors = new CompetitorLandscapeBuilder();
  private readonly citations = new CitationLandscapeBuilder();
  private readonly intentOutcomes = new IntentOutcomeBuilder();

  build(input: {
    project: MonitoringProject;
    baseline: MonitoringBaseline;
    run: ProjectRunRecord;
    observations: Observation[];
  }): RunSnapshotModel {
    assertProjectOwnership(input.project.id, input.baseline, "Baseline");
    assertProjectOwnership(input.project.id, input.run, "Run");
    if (input.run.baselineId !== input.baseline.id) throw new Error("Run does not belong to the selected baseline.");
    const observations = scopeToProject(input.project.id, input.observations).filter(
      (observation) => observation.runId === input.run.id && observation.baselineId === input.baseline.id,
    );
    return {
      project: { id: input.project.id, name: input.project.name, domain: input.project.domain },
      baseline: {
        id: input.baseline.id,
        name: input.baseline.name,
        language: input.baseline.language,
        providerTargets: input.baseline.providerTargets,
        promptSetHash: input.baseline.promptSetHash,
        promptSetVersion: input.baseline.promptSetVersion,
        analysisRulesVersion: input.baseline.analysisRulesVersion,
        runCountPerPrompt: input.baseline.runCountPerPrompt,
      },
      run: input.run,
      result: aggregateObservations(observations),
      competitors: this.competitors.build(input.project.competitors, observations),
      citations: this.citations.build(observations),
      intentOutcomes: this.intentOutcomes.build(observations),
      observations: observations.map((observation) => {
        const row: ObservationSnapshot = {
          id: observation.id,
          promptText: observation.promptText,
          providerId: observation.providerId,
          model: observation.model,
          status: observation.status,
          targetMentioned: observation.evidence.targetMentioned,
          mentionedCompetitors: observation.evidence.mentionedCompetitors,
          citationUrls: observation.citations.map((citation) => citation.url),
        };
        if (observation.answerText) row.answerText = observation.answerText;
        if (observation.intentAnalysis) row.intentAnalysis = observation.intentAnalysis;
        return row;
      }),
    };
  }
}

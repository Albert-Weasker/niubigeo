import { createHash } from "node:crypto";
import type { Observation } from "../observations/observation-schema.js";
import type { ObservationChange, ObservationChangeKind } from "./change-schema.js";

function candidate(observation: Observation): boolean {
  return observation.analysisResult?.brandCandidate === true;
}

function recommendation(observation: Observation): boolean {
  return observation.analysisResult?.brandRecommended === true;
}

function officialCitations(observation: Observation): string[] {
  return observation.citations.filter((citation) => citation.citationType === "target_official").map((citation) => citation.url);
}

function competitorsWithoutTarget(observation: Observation): string[] {
  return observation.evidence.targetMentioned ? [] : observation.evidence.mentionedCompetitors;
}

function identity(observation: Observation): string {
  return [observation.promptId, observation.providerId, observation.model, observation.sampleIndex].join("::");
}

function changeId(kind: ObservationChangeKind, current: Observation, previous: Observation): string {
  return createHash("sha256").update([kind, current.id, previous.id].join("::")).digest("hex").slice(0, 16);
}

function row(kind: ObservationChangeKind, current: Observation, previous: Observation, entities: string[] = [], urls: string[] = []): ObservationChange {
  return {
    id: changeId(kind, current, previous),
    kind,
    projectId: current.projectId,
    baselineId: current.baselineId,
    currentRunId: current.runId,
    previousRunId: previous.runId,
    currentObservationIds: [current.id],
    previousObservationIds: [previous.id],
    promptIds: [current.promptId],
    models: [current.model],
    entityNames: entities,
    citationUrls: urls,
  };
}

export class ObservationDiff {
  compare(current: Observation[], previous: Observation[]): ObservationChange[] {
    const previousByIdentity = new Map(previous.map((observation) => [identity(observation), observation]));
    const changes: ObservationChange[] = [];
    for (const currentObservation of current) {
      const previousObservation = previousByIdentity.get(identity(currentObservation));
      if (!previousObservation) continue;
      if (!previousObservation.evidence.targetMentioned && currentObservation.evidence.targetMentioned) {
        changes.push(row("brand_appeared", currentObservation, previousObservation));
      }
      if (previousObservation.evidence.targetMentioned && !currentObservation.evidence.targetMentioned) {
        changes.push(row("brand_disappeared", currentObservation, previousObservation));
      }
      if (!candidate(previousObservation) && candidate(currentObservation)) changes.push(row("candidate_entered", currentObservation, previousObservation));
      if (candidate(previousObservation) && !candidate(currentObservation)) changes.push(row("candidate_left", currentObservation, previousObservation));
      if (!recommendation(previousObservation) && recommendation(currentObservation)) {
        changes.push(row("recommendation_gained", currentObservation, previousObservation));
      }
      if (recommendation(previousObservation) && !recommendation(currentObservation)) {
        changes.push(row("recommendation_lost", currentObservation, previousObservation));
      }
      const currentUrls = officialCitations(currentObservation);
      const previousUrls = officialCitations(previousObservation);
      const addedUrls = currentUrls.filter((url) => !previousUrls.includes(url));
      const removedUrls = previousUrls.filter((url) => !currentUrls.includes(url));
      if (addedUrls.length > 0) changes.push(row("official_citation_added", currentObservation, previousObservation, [], addedUrls));
      if (removedUrls.length > 0) changes.push(row("official_citation_removed", currentObservation, previousObservation, [], removedUrls));
      const currentCompetitors = competitorsWithoutTarget(currentObservation);
      const previousCompetitors = competitorsWithoutTarget(previousObservation);
      const appeared = currentCompetitors.filter((name) => !previousCompetitors.includes(name));
      const disappeared = previousCompetitors.filter((name) => !currentCompetitors.includes(name));
      if (appeared.length > 0) changes.push(row("competitor_appeared_without_target", currentObservation, previousObservation, appeared));
      if (disappeared.length > 0) changes.push(row("competitor_no_longer_replaces_target", currentObservation, previousObservation, disappeared));
    }
    return changes;
  }
}

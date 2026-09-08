import type { Mention } from "../core/types.js";
import type { Observation } from "../observations/observation-schema.js";
import type { CountFraction, ObservationAggregate } from "./insight-schema.js";

export function countFraction(numerator: number, denominator: number): CountFraction {
  return { numerator, denominator, value: denominator > 0 ? numerator / denominator : null };
}

export function targetMention(observation: Observation): Mention | undefined {
  return observation.mentions.find((mention) => mention.entityType === "target");
}

export function aggregateObservations(observations: Observation[]): ObservationAggregate {
  const completed = observations.filter((observation) => observation.status === "completed" && observation.evidence.hasAnswer);
  const mentioned = completed.filter((observation) => observation.evidence.targetMentioned);
  const recommended = completed.filter((observation) => Boolean(targetMention(observation)?.isRecommendation));
  const cited = completed.filter((observation) => observation.evidence.officialCitationCount > 0);
  return {
    total: observations.length,
    completed: completed.length,
    failed: observations.length - completed.length,
    targetMentioned: countFraction(mentioned.length, completed.length),
    targetRecommended: countFraction(recommended.length, completed.length),
    targetOfficiallyCited: countFraction(cited.length, completed.length),
  };
}

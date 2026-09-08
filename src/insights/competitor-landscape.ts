import type { Entity } from "../core/types.js";
import type { EntityRelationship, EntityRelationshipType } from "../intent/intent-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { CompetitorLandscape, ConfirmedCompetitorInsight, RelatedEntityInsight } from "./insight-schema.js";

const CANDIDATE_RELATIONSHIPS = new Set<EntityRelationshipType>(["competitor", "direct_alternative", "indirect_alternative", "compared_option"]);

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function providerModel(observation: Observation): string {
  return `${observation.providerId}/${observation.model}`;
}

function isConfirmedEntity(entity: EntityRelationship, competitors: ConfirmedCompetitorInsight[]): boolean {
  const name = entity.name.trim().toLocaleLowerCase();
  return competitors.some((competitor) => competitor.name.trim().toLocaleLowerCase() === name);
}

function hasUsableDomain(domain: string): boolean {
  const value = domain.trim().toLocaleLowerCase();
  return Boolean(value && value !== "unknown" && value.includes(".") && !value.startsWith(".") && !value.endsWith("."));
}

export class CompetitorLandscapeBuilder {
  build(competitors: Entity[], observations: Observation[]): CompetitorLandscape {
    const targetNames = new Set(
      observations.flatMap((observation) =>
        observation.mentions
          .filter((mention) => mention.entityType === "target")
          .map((mention) => mention.entityName.trim().toLocaleLowerCase())
          .filter(Boolean),
      ),
    );
    const measured = competitors
      .map((competitor) => {
        const matching = observations.filter((observation) =>
          observation.mentions.some(
            (mention) =>
              mention.entityType === "competitor" &&
              mention.isMentioned &&
              (mention.entityId === competitor.id || mention.entityName.trim().toLocaleLowerCase() === competitor.name.trim().toLocaleLowerCase()),
          ),
        );
        return {
          entityId: competitor.id,
          name: competitor.name,
          domain: competitor.domain,
          observationCount: matching.length,
          recommendationCount: matching.filter((observation) =>
            observation.mentions.some(
              (mention) => mention.entityType === "competitor" && mention.entityId === competitor.id && mention.isRecommendation,
            ),
          ).length,
          firstPositionCount: matching.filter((observation) =>
            observation.mentions.some(
              (mention) => mention.entityType === "competitor" && mention.entityId === competitor.id && mention.isFirstPosition,
            ),
          ).length,
          promptTexts: unique(matching.map((observation) => observation.promptText)),
          sourceUrls: unique(
            matching.flatMap((observation) =>
              observation.citations
                .filter((citation) => citation.citationType === "competitor_official" && (!citation.entityId || citation.entityId === competitor.id))
                .map((citation) => citation.url),
            ),
          ),
          providerModels: unique(matching.map(providerModel)),
        };
      })
      .sort((a, b) => b.observationCount - a.observationCount || a.name.localeCompare(b.name));
    const confirmed: ConfirmedCompetitorInsight[] = measured.filter(
      (competitor) => competitor.observationCount > 0 && hasUsableDomain(competitor.domain) && competitor.sourceUrls.length > 0,
    );

    const candidateRows = new Map<string, RelatedEntityInsight>();
    for (const competitor of measured.filter((item) => !confirmed.some((confirmedItem) => confirmedItem.entityId === item.entityId))) {
      if (competitor.observationCount === 0) continue;
      const matching = observations.filter((observation) =>
        observation.mentions.some(
          (mention) => mention.entityType === "competitor" && mention.isMentioned && mention.entityName.trim().toLocaleLowerCase() === competitor.name.trim().toLocaleLowerCase(),
        ),
      );
      const key = competitor.name.trim().toLocaleLowerCase();
      const existing = candidateRows.get(key);
      const row: RelatedEntityInsight = existing || {
        name: competitor.name,
        relationship: "unclear",
        confidence: "low",
        observationIds: [],
        evidenceQuotes: [],
        sourceUrls: [],
      };
      row.observationIds = unique([...row.observationIds, ...matching.map((observation) => observation.id)]);
      row.evidenceQuotes = unique([
        ...row.evidenceQuotes,
        ...matching.flatMap((observation) =>
          observation.mentions
            .filter((mention) => mention.entityType === "competitor" && mention.entityName.trim().toLocaleLowerCase() === key)
            .map((mention) => mention.context || ""),
        ),
      ]);
      row.sourceUrls = unique([...row.sourceUrls, ...competitor.sourceUrls]);
      candidateRows.set(key, row);
    }
    for (const observation of observations) {
      if (observation.intentAnalysis?.status !== "completed") continue;
      for (const entity of observation.intentAnalysis.entities) {
        const relationship = CANDIDATE_RELATIONSHIPS.has(entity.relationshipToTarget)
          ? entity.relationshipToTarget
          : entity.relationshipToQuestion;
        if (!CANDIDATE_RELATIONSHIPS.has(relationship) || isConfirmedEntity(entity, confirmed)) continue;
        const key = entity.name.trim().toLocaleLowerCase();
        if (!key || targetNames.has(key)) continue;
        const current = candidateRows.get(key) || {
          name: entity.name.trim(),
          relationship,
          confidence: entity.confidence,
          observationIds: [],
          evidenceQuotes: [],
          sourceUrls: [],
        };
        current.observationIds = unique([...current.observationIds, observation.id]);
        current.evidenceQuotes = unique([...current.evidenceQuotes, entity.evidenceQuote || ""]);
        current.sourceUrls = unique([...current.sourceUrls, ...entity.sourceUrls]);
        if (entity.confidence === "high" || (entity.confidence === "medium" && current.confidence === "low")) current.confidence = entity.confidence;
        candidateRows.set(key, current);
      }
    }
    const relatedCandidates = [...candidateRows.values()].sort(
      (a, b) => b.observationIds.length - a.observationIds.length || a.name.localeCompare(b.name),
    );
    return { confirmed, relatedCandidates };
  }
}

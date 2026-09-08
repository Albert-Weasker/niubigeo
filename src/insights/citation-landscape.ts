import type { Citation } from "../core/types.js";
import type { Observation } from "../observations/observation-schema.js";
import type { CitationDomainInsight, CitationLandscape, CitationSourceInsight } from "./insight-schema.js";

function publicType(citation: Citation): CitationSourceInsight["citationType"] {
  if (citation.citationType === "target_official" || citation.citationType === "target_github") return "target";
  if (citation.citationType === "competitor_official") return "competitor";
  if (citation.citationType === "third_party") return "third_party";
  return "unknown";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function domains(sources: CitationSourceInsight[]): CitationDomainInsight[] {
  const rows = new Map<string, { pages: CitationSourceInsight[]; observationIds: Set<string> }>();
  for (const source of sources) {
    const current = rows.get(source.domain) || { pages: [], observationIds: new Set<string>() };
    current.pages.push(source);
    for (const observationId of source.observationIds) current.observationIds.add(observationId);
    rows.set(source.domain, current);
  }
  return [...rows.entries()]
    .map(([domain, row]) => ({
      domain,
      observationCount: row.observationIds.size,
      observationIds: [...row.observationIds],
      pages: row.pages.sort((left, right) => right.observationCount - left.observationCount || left.url.localeCompare(right.url)),
    }))
    .sort((left, right) => right.observationCount - left.observationCount || left.domain.localeCompare(right.domain));
}

export class CitationLandscapeBuilder {
  build(observations: Observation[]): CitationLandscape {
    const rows = new Map<string, { insight: CitationSourceInsight; observationIds: Set<string> }>();
    for (const observation of observations) {
      for (const citation of observation.citations) {
        const existing = rows.get(citation.url);
        if (existing) {
          existing.observationIds.add(observation.id);
          existing.insight.observationCount = existing.observationIds.size;
          existing.insight.observationIds = [...existing.observationIds];
          existing.insight.promptTexts = unique([...existing.insight.promptTexts, observation.promptText]);
          existing.insight.providerModels = unique([...existing.insight.providerModels, `${observation.providerId}/${observation.model}`]);
          if (!existing.insight.title && citation.title) existing.insight.title = citation.title;
          continue;
        }
        const row: CitationSourceInsight = {
          url: citation.url,
          domain: citation.domain,
          citationType: publicType(citation),
          observationCount: 1,
          observationIds: [observation.id],
          promptTexts: [observation.promptText],
          providerModels: [`${observation.providerId}/${observation.model}`],
        };
        if (citation.title) row.title = citation.title;
        rows.set(citation.url, { insight: row, observationIds: new Set([observation.id]) });
      }
    }
    const sorted = [...rows.values()].map((row) => row.insight).sort((a, b) => b.observationCount - a.observationCount || a.url.localeCompare(b.url));
    const targetSources = sorted.filter((row) => row.citationType === "target");
    return {
      targetSources,
      targetDomains: domains(targetSources),
      competitorSources: sorted.filter((row) => row.citationType === "competitor"),
      thirdPartySources: sorted.filter((row) => row.citationType === "third_party"),
      unknownSources: sorted.filter((row) => row.citationType === "unknown"),
    };
  }
}

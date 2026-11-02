import type { Citation, CitationDomainGroup, Entity } from "../core/types.js";
import { domainMatches, extractDomainFromUrl, githubRepoSlug } from "../utils/domain.js";

function matchesGithubRepository(url: string, repository: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || extractDomainFromUrl(url) !== "github.com") return false;
    const expected = githubRepoSlug(repository)?.toLowerCase();
    const actual = parsed.pathname.split("/").filter(Boolean).slice(0, 2).join("/").toLowerCase();
    return Boolean(expected && actual === expected);
  } catch { return false; }
}

export function attachCitationTypes(citations: Citation[], target: Entity, competitors: Entity[]): Citation[] {
  return citations.map((citation) => {
    const domain = extractDomainFromUrl(citation.url || citation.domain);
    if (domainMatches(domain, target.domain) && !(domain === "github.com" && target.githubRepo)) {
      const isGithub = domain === "github.com";
      return {
        ...citation,
        domain,
        entityId: target.id,
        entityName: target.name,
        citationType: isGithub ? "target_github" : "target_official",
      };
    }

    if (target.githubRepo && matchesGithubRepository(citation.url, target.githubRepo)) {
      return {
        ...citation,
        domain,
        entityId: target.id,
        entityName: target.name,
        citationType: "target_github",
      };
    }

    const competitor = competitors.find((entity) => domainMatches(domain, entity.domain));
    if (competitor) {
      return {
        ...citation,
        domain,
        entityId: competitor.id,
        entityName: competitor.name,
        citationType: "competitor_official",
      };
    }

    return { ...citation, domain, citationType: "third_party" };
  });
}

export function citationDomainGroups(citations: Citation[]): CitationDomainGroup[] {
  const groups = new Map<string, CitationDomainGroup & { promptIds: Set<string>; providerIds: Set<string> }>();

  for (const citation of citations) {
    const existing = groups.get(citation.domain) || {
      domain: citation.domain,
      type: citation.citationType,
      citationCount: 0,
      urlCount: 0,
      promptCount: 0,
      providerCount: 0,
      urls: [],
      promptIds: new Set<string>(),
      providerIds: new Set<string>(),
    };
    existing.citationCount += 1;
    if (!existing.urls.includes(citation.url)) existing.urls.push(citation.url);
    if (citation.promptId) existing.promptIds.add(citation.promptId);
    if (citation.runId) existing.providerIds.add(citation.runId.split("::")[0] || citation.runId);
    existing.urlCount = existing.urls.length;
    existing.promptCount = existing.promptIds.size;
    existing.providerCount = existing.providerIds.size;
    groups.set(citation.domain, existing);
  }

  return [...groups.values()]
    .map(({ promptIds: _promptIds, providerIds: _providerIds, ...group }) => group)
    .sort((a, b) => b.citationCount - a.citationCount || a.domain.localeCompare(b.domain));
}

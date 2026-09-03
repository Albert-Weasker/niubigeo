import type { KeywordCandidate, KeywordRelevance, KeywordSource, SiteEvidence, SiteEvidencePage } from "../core/types.js";

const SOURCE_WEIGHT: Record<KeywordSource, number> = {
  user: 0.04,
  meta_keywords: 0.42,
  title: 0.38,
  heading: 0.34,
  description: 0.3,
  json_ld: 0.28,
  github_topic: 0.26,
  github_readme: 0.2,
  provider_profile: 0.16,
  body: 0.14,
  sitemap: 0.1,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function meaningfulTokens(value: string): string[] {
  return value
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9.+#-]/gi, "").trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !/^(and|are|best|for|from|how|into|the|to|what|when|with|your)$/i.test(token));
}

function textMatchesKeyword(text: string | undefined, keyword: KeywordCandidate): boolean {
  if (!text) return false;
  const haystack = normalizeText(text);
  const needle = keyword.normalized || normalizeText(keyword.phrase);
  if (!haystack || !needle) return false;
  if (haystack.includes(needle)) return true;
  if (isCjk(needle)) return haystack.includes(needle);

  const tokens = meaningfulTokens(needle);
  if (tokens.length < 2) return false;
  const matched = tokens.filter((token) => new RegExp(`(?:^|\\W)${escapeRegex(token)}(?:$|\\W)`, "i").test(haystack)).length;
  return matched / tokens.length >= 0.75;
}

function addEvidence(
  rows: KeywordRelevance["evidence"],
  sourceBreakdown: Record<string, number>,
  source: KeywordSource,
  text: string | undefined,
  url?: string | undefined,
): void {
  const compact = text?.replace(/\s+/g, " ").trim();
  if (!compact) return;
  const row = {
    source,
    url,
    text: compact.slice(0, 360),
  };
  const key = `${row.source}:${row.url || ""}:${row.text.toLowerCase()}`;
  if (rows.some((item) => `${item.source}:${item.url || ""}:${item.text.toLowerCase()}` === key)) return;
  rows.push(row);
  sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
}

function inspectPage(page: SiteEvidencePage, keyword: KeywordCandidate): KeywordRelevance["evidence"] {
  const rows: KeywordRelevance["evidence"] = [];
  const noopBreakdown: Record<string, number> = {};
  for (const phrase of page.metaKeywords) {
    if (textMatchesKeyword(phrase, keyword)) addEvidence(rows, noopBreakdown, "meta_keywords", phrase, page.url);
  }
  for (const value of [page.title, page.ogTitle, page.twitterTitle]) {
    if (textMatchesKeyword(value, keyword)) addEvidence(rows, noopBreakdown, "title", value, page.url);
  }
  for (const value of [page.description, page.ogDescription, page.twitterDescription]) {
    if (textMatchesKeyword(value, keyword)) addEvidence(rows, noopBreakdown, "description", value, page.url);
  }
  for (const heading of page.headings) {
    if (textMatchesKeyword(heading, keyword)) addEvidence(rows, noopBreakdown, "heading", heading, page.url);
  }
  for (const value of [...page.jsonLdKeywords, ...page.jsonLdNames, ...page.jsonLdDescriptions]) {
    if (textMatchesKeyword(value, keyword)) addEvidence(rows, noopBreakdown, "json_ld", value, page.url);
  }
  if (textMatchesKeyword(page.textSnippet, keyword)) addEvidence(rows, noopBreakdown, "body", page.textSnippet, page.url);
  return rows;
}

function scoreEvidence(keyword: KeywordCandidate, sourceBreakdown: Record<string, number>, evidenceCount: number): number {
  const sources = Object.keys(sourceBreakdown) as KeywordSource[];
  if (evidenceCount === 0) return keyword.userDefined ? 0.05 : 0;

  const weightedPresence = sources.reduce((sum, source) => {
    const count = sourceBreakdown[source] || 0;
    return sum + SOURCE_WEIGHT[source] * Math.min(1, count / 2);
  }, 0);
  const diversityBoost = Math.min(0.18, Math.max(0, sources.length - 1) * 0.045);
  const frequencyBoost = Math.min(0.16, evidenceCount * 0.025);
  const confidenceBoost = Math.min(0.14, keyword.confidence * 0.14);
  return clamp01(weightedPresence + diversityBoost + frequencyBoost + confidenceBoost);
}

export class KeywordRelevanceScorer {
  score(input: { keywords: KeywordCandidate[]; siteEvidence?: SiteEvidence | undefined }): KeywordRelevance[] {
    return input.keywords.map((keyword) => {
      const evidence: KeywordRelevance["evidence"] = [];
      const sourceBreakdown: Record<string, number> = {};

      if (keyword.source !== "user" && keyword.evidenceText) {
        addEvidence(evidence, sourceBreakdown, keyword.source, keyword.evidenceText, keyword.evidenceUrl);
      }

      if (input.siteEvidence) {
        for (const page of input.siteEvidence.pages) {
          for (const row of inspectPage(page, keyword)) {
            addEvidence(evidence, sourceBreakdown, row.source, row.text, row.url);
          }
        }
        for (const url of input.siteEvidence.sitemapUrls) {
          if (textMatchesKeyword(url.replace(/[-_/]+/g, " "), keyword)) {
            addEvidence(evidence, sourceBreakdown, "sitemap", url, url);
          }
        }
        if (input.siteEvidence.github) {
          for (const topic of input.siteEvidence.github.topics) {
            if (textMatchesKeyword(topic.replace(/[-_]+/g, " "), keyword)) {
              addEvidence(evidence, sourceBreakdown, "github_topic", topic, undefined);
            }
          }
          if (textMatchesKeyword(input.siteEvidence.github.readmeSnippet, keyword)) {
            addEvidence(evidence, sourceBreakdown, "github_readme", input.siteEvidence.github.readmeSnippet, undefined);
          }
        }
      }

      const limitedEvidence = evidence.slice(0, 12);
      return {
        keywordId: keyword.id,
        score: scoreEvidence(keyword, sourceBreakdown, evidence.length),
        evidenceCount: evidence.length,
        sourceBreakdown,
        evidence: limitedEvidence,
      };
    });
  }
}

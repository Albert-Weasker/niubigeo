import type {
  DomainProfile,
  KeywordCandidate,
  KeywordCluster,
  KeywordMode,
  KeywordSource,
  SiteEvidence,
  SiteEvidencePage,
} from "../core/types.js";
import { slugify } from "../utils/domain.js";
import { sha256 } from "../utils/hash.js";

const SOURCE_CONFIDENCE: Record<KeywordSource, number> = {
  user: 0.95,
  meta_keywords: 0.9,
  title: 0.86,
  heading: 0.82,
  description: 0.76,
  json_ld: 0.74,
  github_topic: 0.72,
  provider_profile: 0.66,
  github_readme: 0.62,
  body: 0.46,
  sitemap: 0.34,
};

const GENERIC_ENGLISH = new Set([
  "tool",
  "tools",
  "platform",
  "platforms",
  "software",
  "service",
  "services",
  "solution",
  "solutions",
  "product",
  "products",
  "pricing",
  "about",
  "home",
  "docs",
  "blog",
]);

function normalizedKeyword(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordId(phrase: string): string {
  const slug = slugify(phrase).slice(0, 42) || "keyword";
  return `kw-${slug}-${sha256(normalizedKeyword(phrase)).slice(0, 8)}`;
}

function isCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function isUsefulDiscoveredPhrase(value: string): boolean {
  const normalized = normalizedKeyword(value);
  if (!normalized) return false;
  if (isCjk(normalized)) return normalized.length >= 2 && normalized.length <= 40;
  const words = wordCount(normalized);
  if (words < 2 || words > 8) return false;
  if (GENERIC_ENGLISH.has(normalized)) return false;
  if (/^(learn more|read more|get started|sign in|log in|contact us)$/i.test(normalized)) return false;
  return true;
}

function splitPhraseList(value: string): string[] {
  return value
    .split(/[,，;；|｜/]/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function titleParts(value: string): string[] {
  return value
    .split(/\s+[|｜:：\-–—·]\s+|[|｜]/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function phraseCandidatesFromText(value: string | undefined): string[] {
  if (!value) return [];
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return [];
  const pieces = compact
    .split(/[.!?。！？\n\r]/)
    .flatMap(splitPhraseList)
    .flatMap(titleParts)
    .map((item) => item.replace(/^(best|top|leading|trusted)\s+/i, "").trim())
    .filter(Boolean);

  const candidates: string[] = [];
  for (const piece of pieces) {
    if (isUsefulDiscoveredPhrase(piece)) {
      candidates.push(piece);
      continue;
    }
    if (!isCjk(piece) && wordCount(piece) > 8) {
      const words = piece.split(/\s+/).filter((word) => !/^(the|a|an|and|or|for|with|to|of|in|on|your|you)$/i.test(word));
      for (let size = 4; size >= 2; size -= 1) {
        if (words.length < size) continue;
        for (let index = 0; index <= Math.min(words.length - size, 4); index += 1) {
          const phrase = words.slice(index, index + size).join(" ");
          if (isUsefulDiscoveredPhrase(phrase)) candidates.push(phrase);
        }
      }
    }
  }
  return [...new Set(candidates)].slice(0, 30);
}

function sourceForPageText(source: KeywordSource, page: SiteEvidencePage): Array<{ phrase: string; evidenceText: string }> {
  const rows: Array<{ phrase: string; evidenceText: string }> = [];
  if (source === "meta_keywords") {
    for (const keyword of page.metaKeywords) rows.push({ phrase: keyword, evidenceText: keyword });
  }
  if (source === "title") {
    for (const phrase of phraseCandidatesFromText(page.title)) rows.push({ phrase, evidenceText: page.title || phrase });
  }
  if (source === "description") {
    for (const value of [page.description, page.ogDescription, page.twitterDescription]) {
      for (const phrase of phraseCandidatesFromText(value)) rows.push({ phrase, evidenceText: value || phrase });
    }
  }
  if (source === "heading") {
    for (const heading of page.headings) {
      for (const phrase of phraseCandidatesFromText(heading)) rows.push({ phrase, evidenceText: heading });
    }
  }
  if (source === "json_ld") {
    for (const value of [...page.jsonLdKeywords, ...page.jsonLdNames, ...page.jsonLdDescriptions]) {
      for (const phrase of phraseCandidatesFromText(value)) rows.push({ phrase, evidenceText: value });
    }
  }
  return rows;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class KeywordUniverseBuilder {
  build(input: {
    siteEvidence?: SiteEvidence | undefined;
    domainProfile?: DomainProfile | undefined;
    userKeywords?: string[] | undefined;
    language: string;
    mode: KeywordMode;
    limit: number;
  }): { keywords: KeywordCandidate[]; clusters: KeywordCluster[] } {
    const candidates = new Map<string, KeywordCandidate>();

    const addPhrase = (value: string, source: KeywordSource, userDefined: boolean, evidenceUrl?: string, evidenceText?: string) => {
      const phrase = value.replace(/\s+/g, " ").trim();
      if (!phrase) return;
      if (!userDefined && !isUsefulDiscoveredPhrase(phrase)) return;
      const normalized = normalizedKeyword(phrase);
      if (!normalized) return;
      const existing = candidates.get(normalized);
      const confidence = SOURCE_CONFIDENCE[source];
      if (!existing) {
        candidates.set(normalized, {
          id: keywordId(phrase),
          phrase,
          normalized,
          language: input.language,
          source,
          evidenceUrl,
          evidenceText,
          confidence,
          enabled: true,
          userDefined,
        });
        return;
      }
      const shouldPromoteToUser = userDefined && !existing.userDefined;
      const shouldReplaceEvidence = confidence > existing.confidence || shouldPromoteToUser;
      candidates.set(normalized, {
        ...existing,
        source: shouldPromoteToUser ? "user" : shouldReplaceEvidence ? source : existing.source,
        evidenceUrl: shouldReplaceEvidence ? evidenceUrl || existing.evidenceUrl : existing.evidenceUrl,
        evidenceText: shouldReplaceEvidence ? evidenceText || existing.evidenceText : existing.evidenceText,
        confidence: clamp01(Math.max(existing.confidence, confidence)),
        userDefined: existing.userDefined || userDefined,
      });
    };

    const userKeywords = (input.userKeywords || []).map((keyword) => keyword.trim()).filter(Boolean);
    if (input.mode !== "site_only") {
      for (const keyword of userKeywords) addPhrase(keyword, "user", true, undefined, keyword);
    }

    if (input.mode !== "user_only" && input.siteEvidence) {
      for (const page of input.siteEvidence.pages) {
        for (const source of ["meta_keywords", "title", "description", "heading", "json_ld"] as KeywordSource[]) {
          for (const row of sourceForPageText(source, page)) {
            addPhrase(row.phrase, source, false, page.url, row.evidenceText);
          }
        }
      }
      for (const url of input.siteEvidence.sitemapUrls.slice(0, 20)) {
        try {
          const segments = new URL(url).pathname
            .split("/")
            .map((segment) => segment.replace(/[-_]+/g, " ").trim())
            .filter(Boolean);
          for (const segment of segments) addPhrase(segment, "sitemap", false, url, url);
        } catch {
          continue;
        }
      }
      if (input.siteEvidence.github) {
        for (const topic of input.siteEvidence.github.topics) addPhrase(topic.replace(/[-_]+/g, " "), "github_topic", false, undefined, topic);
        for (const phrase of phraseCandidatesFromText(input.siteEvidence.github.readmeSnippet)) {
          addPhrase(phrase, "github_readme", false, undefined, input.siteEvidence.github.readmeSnippet);
        }
      }
    }

    if (input.mode !== "user_only" && input.domainProfile) {
      addPhrase(input.domainProfile.category, "provider_profile", false, undefined, input.domainProfile.description);
      for (const suggestion of input.domainProfile.promptSuggestions) {
        addPhrase(suggestion.topic, "provider_profile", false, undefined, suggestion.prompt);
      }
    }

    const all = [...candidates.values()].sort((a, b) => {
      if (a.userDefined !== b.userDefined) return a.userDefined ? -1 : 1;
      return b.confidence - a.confidence || a.phrase.localeCompare(b.phrase);
    });
    const userDefinedRows = all.filter((keyword) => keyword.userDefined);
    const discoveredRows = all.filter((keyword) => !keyword.userDefined).slice(0, Math.max(0, input.limit - userDefinedRows.length));
    const keywords = [...userDefinedRows, ...discoveredRows].slice(0, Math.max(userDefinedRows.length, input.limit));
    const clusters = keywords.map((keyword) => ({
      id: `cluster-${keyword.id}`,
      label: keyword.phrase,
      primaryKeywordId: keyword.id,
      keywordIds: [keyword.id],
    }));

    return { keywords, clusters };
  }
}

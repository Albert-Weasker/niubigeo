import type {
  AnswerProvider,
  Entity,
  KeywordCandidate,
  KeywordCluster,
  KeywordMode,
  KeywordRelevance,
  KeywordSource,
  PromptGenerationEvidence,
  SiteEvidence,
} from "../core/types.js";
import { slugify } from "../utils/domain.js";
import { sha256 } from "../utils/hash.js";
import { compactWhitespace, jsonContainer } from "../utils/text.js";

interface EvidenceItem {
  id: string;
  source: KeywordSource;
  text: string;
  url?: string | undefined;
}

interface UserKeywordSeed {
  id: string;
  phrase: string;
}

interface AnalyzedKeywordRow {
  phrase: string;
  userSeedId?: string | undefined;
  relevance: number;
  evidenceIds: string[];
}

export interface KeywordAnalysisResult {
  keywords: KeywordCandidate[];
  clusters: KeywordCluster[];
  relevance: KeywordRelevance[];
  evidence: PromptGenerationEvidence;
}

function normalizedKeyword(value: string): string {
  return compactWhitespace(value).toLocaleLowerCase();
}

function keywordId(phrase: string): string {
  const slug = slugify(phrase).slice(0, 42) || "keyword";
  return `kw-${slug}-${sha256(normalizedKeyword(phrase)).slice(0, 8)}`;
}

function appendEvidence(
  rows: EvidenceItem[],
  seen: Set<string>,
  source: KeywordSource,
  text: string | undefined,
  url?: string,
): void {
  const value = compactWhitespace(text || "");
  if (!value) return;
  const key = `${source}:${url || ""}:${value}`;
  if (seen.has(key)) return;
  seen.add(key);
  const row: EvidenceItem = {
    id: `evidence-${rows.length + 1}`,
    source,
    text: value.slice(0, 1600),
  };
  if (url) row.url = url;
  rows.push(row);
}

function evidenceCatalog(siteEvidence: SiteEvidence | undefined): EvidenceItem[] {
  if (!siteEvidence) return [];
  const rows: EvidenceItem[] = [];
  const seen = new Set<string>();
  for (const page of siteEvidence.pages) {
    for (const value of page.metaKeywords) appendEvidence(rows, seen, "meta_keywords", value, page.url);
    for (const value of [page.title, page.ogTitle, page.twitterTitle]) appendEvidence(rows, seen, "title", value, page.url);
    for (const value of [page.description, page.ogDescription, page.twitterDescription]) {
      appendEvidence(rows, seen, "description", value, page.url);
    }
    for (const value of page.headings) appendEvidence(rows, seen, "heading", value, page.url);
    for (const value of page.jsonLdKeywords) appendEvidence(rows, seen, "json_ld", value, page.url);
    for (const value of page.jsonLdNames) appendEvidence(rows, seen, "json_ld", value, page.url);
    for (const value of page.jsonLdDescriptions) appendEvidence(rows, seen, "json_ld", value, page.url);
    appendEvidence(rows, seen, "body", page.textSnippet, page.url);
  }
  for (const url of siteEvidence.sitemapUrls) appendEvidence(rows, seen, "sitemap", url, url);
  if (siteEvidence.github) {
    appendEvidence(rows, seen, "github_readme", siteEvidence.github.description);
    for (const topic of siteEvidence.github.topics) appendEvidence(rows, seen, "github_topic", topic);
    appendEvidence(rows, seen, "github_readme", siteEvidence.github.readmeSnippet);
  }
  return rows.slice(0, 120);
}

function userSeeds(values: string[]): UserKeywordSeed[] {
  const rows: UserKeywordSeed[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const phrase = compactWhitespace(value);
    const normalized = normalizedKeyword(phrase);
    if (!phrase || seen.has(normalized)) continue;
    seen.add(normalized);
    rows.push({ id: `user-keyword-${rows.length + 1}`, phrase });
  }
  return rows;
}

function finiteScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

function stringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))];
}

function parseRows(text: string): unknown[] {
  const parsed = JSON.parse(jsonContainer(text, "{", "}"));
  if (!parsed || typeof parsed !== "object") throw new Error("Keyword analyzer output is not an object.");
  const rows = (parsed as Record<string, unknown>).keywords;
  if (!Array.isArray(rows)) throw new Error("Keyword analyzer output does not contain a keywords array.");
  return rows;
}

function analysisPrompt(input: {
  target: Entity;
  language: string;
  mode: KeywordMode;
  limit: number;
  seeds: UserKeywordSeed[];
  evidence: EvidenceItem[];
}): string {
  return [
    "Analyze keyword relevance for a domain monitoring plan.",
    "Return only one valid JSON object with a keywords array.",
    "Semantic selection and relevance must be based only on the supplied target, user keywords, and evidence catalog.",
    "Do not use a canned industry vocabulary or add facts that are absent from the evidence.",
    "Every user keyword allowed by Mode must be returned with its exact phrase and userSeedId.",
    "Every discovered keyword must cite one or more evidenceIds from the catalog.",
    "Relevance is a number from 0 to 1 describing how directly the keyword represents the target's product, users, or use cases.",
    "A low relevance user keyword must still be returned so the user can see that judgment.",
    "Do not infer relevance from the domain spelling alone.",
    "Each keyword item must contain phrase, userSeedId when applicable, relevance, and evidenceIds.",
    `Mode: ${input.mode}`,
    `Maximum discovered keywords: ${input.limit}`,
    `Language context: ${input.language}`,
    `Target: ${JSON.stringify({ name: input.target.name, domain: input.target.domain, aliases: input.target.aliases, githubRepo: input.target.githubRepo })}`,
    `User keywords: ${JSON.stringify(input.seeds)}`,
    `Evidence catalog: ${JSON.stringify(input.evidence)}`,
  ].join("\n");
}

function validateRows(input: {
  raw: unknown[];
  seeds: UserKeywordSeed[];
  evidence: EvidenceItem[];
  language: string;
  mode: KeywordMode;
  limit: number;
}): { keywords: KeywordCandidate[]; relevance: KeywordRelevance[] } {
  const seedById = new Map(input.seeds.map((seed) => [seed.id, seed]));
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const selected = new Map<string, { keyword: KeywordCandidate; relevance: KeywordRelevance }>();
  const returnedSeedIds = new Set<string>();

  for (const item of input.raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const requestedSeedId = typeof row.userSeedId === "string" ? row.userSeedId.trim() : "";
    const seed = requestedSeedId ? seedById.get(requestedSeedId) : undefined;
    const isUserKeyword = Boolean(seed);
    if (requestedSeedId && !seed) continue;
    if (input.mode === "site_only" && isUserKeyword) continue;
    if (input.mode === "user_only" && !isUserKeyword) continue;
    const suppliedPhrase = typeof row.phrase === "string" ? compactWhitespace(row.phrase) : "";
    const phrase = seed?.phrase || suppliedPhrase;
    if (!phrase || (seed && suppliedPhrase !== seed.phrase)) continue;
    const normalized = normalizedKeyword(phrase);
    if (!normalized || selected.has(normalized)) continue;
    const score = finiteScore(row.relevance);
    if (score === null) continue;
    const evidence = stringIds(row.evidenceIds).map((id) => evidenceById.get(id)).filter((value): value is EvidenceItem => Boolean(value));
    if (!isUserKeyword && evidence.length === 0) continue;
    const sourceBreakdown: Record<string, number> = {};
    for (const evidenceItem of evidence) sourceBreakdown[evidenceItem.source] = (sourceBreakdown[evidenceItem.source] || 0) + 1;
    const id = keywordId(phrase);
    const firstEvidence = evidence[0];
    const keyword: KeywordCandidate = {
      id,
      phrase,
      normalized,
      language: input.language,
      source: isUserKeyword ? "user" : firstEvidence?.source || "provider_profile",
      confidence: score,
      enabled: true,
      userDefined: isUserKeyword,
    };
    if (firstEvidence?.url) keyword.evidenceUrl = firstEvidence.url;
    if (firstEvidence?.text) keyword.evidenceText = firstEvidence.text;
    selected.set(normalized, {
      keyword,
      relevance: {
        keywordId: id,
        score,
        evidenceCount: evidence.length,
        sourceBreakdown,
        evidence: evidence.map((evidenceItem) => {
          const row: KeywordRelevance["evidence"][number] = {
            source: evidenceItem.source,
            text: evidenceItem.text,
          };
          if (evidenceItem.url) row.url = evidenceItem.url;
          return row;
        }),
      },
    });
    if (seed) returnedSeedIds.add(seed.id);
  }

  if (input.mode !== "site_only") {
    const missing = input.seeds.filter((seed) => !returnedSeedIds.has(seed.id));
    if (missing.length > 0) throw new Error("Keyword analyzer did not return every user keyword.");
  }

  const all = [...selected.values()];
  const userRows = all.filter((row) => row.keyword.userDefined);
  const discoveredRows = all.filter((row) => !row.keyword.userDefined).slice(0, input.limit);
  const rows = [...userRows, ...discoveredRows];
  if (rows.length === 0) throw new Error("Keyword analyzer returned no evidence-backed keywords.");
  return {
    keywords: rows.map((row) => row.keyword),
    relevance: rows.map((row) => row.relevance),
  };
}

export class KeywordAnalyzer {
  async analyze(input: {
    target: Entity;
    siteEvidence?: SiteEvidence | undefined;
    userKeywords: string[];
    language: string;
    mode: KeywordMode;
    limit: number;
    provider: AnswerProvider;
    model: string;
    apiKey: string;
  }): Promise<KeywordAnalysisResult> {
    const seeds = userSeeds(input.userKeywords);
    const evidence = evidenceCatalog(input.siteEvidence);
    if (input.mode !== "site_only" && seeds.length === 0 && input.mode === "user_only") {
      throw new Error("User-only keyword analysis requires at least one user keyword.");
    }
    if (input.mode !== "user_only" && evidence.length === 0) {
      throw new Error("Site keyword analysis requires collected site evidence.");
    }
    const prompt = analysisPrompt({
      target: input.target,
      language: input.language,
      mode: input.mode,
      limit: input.limit,
      seeds,
      evidence,
    });
    const result = await input.provider.run({
      prompt,
      model: input.model,
      apiKey: input.apiKey,
      maxTokens: 1800,
      temperature: 0,
      webSearchEnabled: false,
      responseFormat: input.provider.definition.supportsAnyModel ? "json_object" : undefined,
    });
    const validated = validateRows({
      raw: parseRows(result.text),
      seeds,
      evidence,
      language: input.language,
      mode: input.mode,
      limit: input.limit,
    });
    return {
      ...validated,
      clusters: validated.keywords.map((keyword) => ({
        id: `cluster-${keyword.id}`,
        label: keyword.phrase,
        primaryKeywordId: keyword.id,
        keywordIds: [keyword.id],
      })),
      evidence: {
        providerId: input.provider.definition.id,
        model: input.model,
        sourceLabel: result.sourceLabel,
        prompt,
        text: result.text,
      },
    };
  }
}

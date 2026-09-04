import type { AuditRun, Citation, Entity, Mention, PromptRun } from "../core/types.js";
import type { IntentRunAnalysis } from "../intent/intent-schema.js";

export type HumanReportLocale = "en" | "zh";

export interface EvidenceStatement {
  text: string;
  answerIndexes: number[];
  sourceUrls: string[];
}

export interface CompetitorStory {
  name: string;
  description: string;
  why: string;
  threat: string;
  answerIndexes: number[];
  sourceUrls: string[];
}

export type SourceRelevance = "related" | "possible" | "excluded";

export interface SourceStory {
  title: string;
  domain: string;
  url: string;
  supports: string;
  answerIndexes: number[];
  relevance: SourceRelevance;
  relevanceReason: string;
}

export interface ModelComparisonStory {
  sourceName: string;
  displayName: string;
  summary: string;
  recognition: string;
  naturalDiscovery: string;
  competitors: string[];
  sourceUrls: string[];
  answerIndexes: number[];
}

export interface AnswerStory {
  index: number;
  prompt: string;
  summary: string;
  answer: string;
  returnedAnswer: boolean;
  targetMentioned: boolean;
  competitorsMentioned: string[];
  citations: Citation[];
  sourceName: string;
  model: string;
  webSearch: string;
  intentAnalysis?: IntentRunAnalysis | undefined;
}

export interface HumanReport {
  locale: HumanReportLocale;
  title: string;
  subtitle: string;
  caveat: string;
  sections: {
    headline: string;
    modelComparisons: ModelComparisonStory[];
    brandRecognition: string;
    brandDescriptions: EvidenceStatement[];
    brandEmphasis: EvidenceStatement[];
    brandMissing: string[];
    brandUncertainty: string[];
    competitors: CompetitorStory[];
    otherCompetitors: string[];
    competitorAdvantages: EvidenceStatement[];
    targetAdvantages: EvidenceStatement[];
    missingScenarios: EvidenceStatement[];
    targetSources: SourceStory[];
    competitorSources: SourceStory[];
    thirdPartySources: SourceStory[];
    allSources: SourceStory[];
    answers: AnswerStory[];
  };
}

interface IndexedRun {
  run: PromptRun;
  index: number;
}

const MAX_SNIPPET_LENGTH = 170;

function localeForAudit(audit: AuditRun): HumanReportLocale {
  return audit.prompts.some((prompt) => prompt.language.toLowerCase().startsWith("zh")) ? "zh" : "en";
}

function compactSpaces(value: string): string {
  const output: string[] = [];
  let previousWasSpace = false;
  for (const char of value) {
    const isSpace = char === " " || char === "\n" || char === "\t" || char === "\r";
    if (isSpace) {
      if (!previousWasSpace) output.push(" ");
      previousWasSpace = true;
    } else {
      output.push(char);
      previousWasSpace = false;
    }
  }
  return output.join("").trim();
}

function stripSnippetDecorators(value: string): string {
  let output = "";
  for (const char of value) {
    if (char === "*" || char === "`" || char === "#") continue;
    output += char;
  }
  let text = compactSpaces(output);
  while (text.startsWith("- ") || text.startsWith("• ")) text = text.slice(2).trim();
  if (text.length > 2) {
    const first = text.charCodeAt(0);
    const second = text.charAt(1);
    const third = text.charAt(2);
    if (first >= 48 && first <= 57 && (second === "." || second === ")")) text = text.slice(2).trim();
    const secondCode = second.charCodeAt(0);
    if (first >= 48 && first <= 57 && secondCode >= 48 && secondCode <= 57 && (third === "." || third === ")")) text = text.slice(3).trim();
  }
  const danglingSuffixes = ["： 1.", ": 1.", "：1.", ":1."];
  for (const suffix of danglingSuffixes) {
    if (text.endsWith(suffix)) text = text.slice(0, text.length - suffix.length).trim();
  }
  return text;
}

function shorten(value: string | null | undefined, maxLength = MAX_SNIPPET_LENGTH): string {
  const text = stripSnippetDecorators(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}...`;
}

function containsText(text: string, needle: string): boolean {
  const cleanedNeedle = needle.trim().toLowerCase();
  if (!cleanedNeedle) return false;
  return text.toLowerCase().includes(cleanedNeedle);
}

function completedRuns(audit: AuditRun): IndexedRun[] {
  return audit.runs
    .map((run, index) => ({ run, index: index + 1 }))
    .filter((item) => item.run.status === "completed" && Boolean(item.run.result) && Boolean(item.run.analysis));
}

function indexedRuns(audit: AuditRun): IndexedRun[] {
  return audit.runs.map((run, index) => ({ run, index: index + 1 }));
}

function targetMention(run: PromptRun): Mention | undefined {
  return run.analysis?.mentions.find((mention) => mention.entityType === "target" && mention.isMentioned);
}

function targetIsMentioned(run: PromptRun): boolean {
  return Boolean(targetMention(run));
}

function competitorMentions(run: PromptRun): Mention[] {
  return run.analysis?.mentions.filter((mention) => mention.entityType === "competitor" && mention.isMentioned) || [];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const text = compactSpaces(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

function firstSentenceLike(value: string | null | undefined): string {
  const text = compactSpaces(value || "");
  if (!text) return "";
  let current = "";
  for (const char of text) {
    current += char;
    if (char === "." || char === "!" || char === "?" || char === "。" || char === "！" || char === "？" || char === ";") {
      return shorten(current);
    }
  }
  return shorten(text);
}

function splitSentences(value: string | null | undefined): string[] {
  const text = compactSpaces(value || "");
  const sentences: string[] = [];
  let current = "";
  for (const char of text) {
    current += char;
    const isBoundary = char === "." || char === "!" || char === "?" || char === "。" || char === "！" || char === "？" || char === ";";
    if (isBoundary) {
      const cleaned = shorten(current);
      if (cleaned) sentences.push(cleaned);
      current = "";
    }
  }
  const tail = shorten(current);
  if (tail) sentences.push(tail);
  return sentences;
}

function entityTerms(entity: Entity): string[] {
  return uniqueStrings([entity.name, entity.domain, ...entity.aliases]);
}

function sentenceContaining(text: string | null | undefined, terms: string[]): string {
  for (const sentence of splitSentences(text)) {
    for (const term of terms) {
      if (containsText(sentence, term)) return sentence;
    }
  }
  return "";
}

function usefulSnippet(value: string): boolean {
  if (value.length < 16) return false;
  const letters = [...value].filter((char) => char.toLowerCase() !== char.toUpperCase());
  return letters.length >= 6 || value.length >= 24;
}

function isOverviewSnippet(value: string): boolean {
  return (
    containsText(value, "这几类") ||
    containsText(value, "这些平台") ||
    containsText(value, "以下几类") ||
    containsText(value, "比较值得关注") ||
    containsText(value, "主要差异") ||
    containsText(value, "差异如下") ||
    containsText(value, "差异主要") ||
    containsText(value, "主要体现在") ||
    containsText(value, "替代品包括") ||
    containsText(value, "都更强调") ||
    containsText(value, "这四个平台") ||
    containsText(value, "这些品牌") ||
    containsText(value, "主要是") ||
    containsText(value, "include") ||
    containsText(value, "includes") ||
    value.endsWith("包括") ||
    value.endsWith("如下") ||
    value.endsWith("如下：")
  );
}

function usefulDescription(value: string): boolean {
  return usefulSnippet(value) && !isOverviewSnippet(value);
}

function isAlphaNumeric(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function wordsFromText(value: string): string[] {
  const stop = new Set(["about", "after", "again", "their", "there", "these", "those", "through", "with", "without", "platform", "helps", "increase"]);
  const words: string[] = [];
  let current = "";
  for (const char of value) {
    if (isAlphaNumeric(char)) {
      current += char.toLowerCase();
    } else if (current) {
      if (current.length >= 4 && !stop.has(current)) words.push(current);
      current = "";
    }
  }
  if (current.length >= 4 && !stop.has(current)) words.push(current);
  return uniqueStrings(words).slice(0, 12);
}

function weaklyMatchesSiteEvidence(siteDescription: string, answerSnippet: string): boolean {
  const siteWords = wordsFromText(siteDescription);
  if (siteWords.length < 4 || !answerSnippet) return false;
  let overlap = 0;
  for (const word of siteWords) {
    if (containsText(answerSnippet, word)) overlap += 1;
  }
  return overlap <= 1;
}

function mentionEvidenceText(mention: Mention): string {
  return firstSentenceLike(mention.paragraph || mention.context || mention.entityName);
}

function sourceName(run: PromptRun): string {
  let label = run.sourceLabel || run.providerId;
  const prefix = "Source: ";
  if (label.startsWith(prefix)) label = label.slice(prefix.length);
  return compactSpaces(`${label} / ${run.model}`);
}

function searchSummary(run: PromptRun, locale: HumanReportLocale): string {
  const search = run.search || run.result?.search;
  if (!search?.used) return fallback(locale, "未联网", "No web search");
  if (search.usedMode === "provider_always_on") return fallback(locale, "Provider 天然联网", "Provider web-grounded");
  return fallback(locale, "Provider 原生联网", "Provider-native web search");
}

function categoryIsBrand(run: PromptRun): boolean {
  return run.prompt.auditCategory === "brand_awareness" || run.prompt.targetIncluded === true;
}

function categoryIsOrganic(run: PromptRun): boolean {
  return run.prompt.auditCategory === "organic_discovery" || run.prompt.targetIncluded === false;
}

function categoryIsComparison(run: PromptRun): boolean {
  return run.prompt.auditCategory === "comparison";
}

function citationTitle(citation: Citation): string {
  if (citation.title && citation.title.trim()) return citation.title.trim();
  try {
    const parsed = new URL(citation.url);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : parsed.hostname;
    return compactSpaces(path);
  } catch {
    return citation.url;
  }
}

function citationDomain(url: string): string {
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host;
  } catch {
    return "";
  }
}

function normalizedHost(value: string): string {
  let host = value.trim().toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  return host;
}

function domainMatchesKnown(candidate: string, expected: string): boolean {
  const a = normalizedHost(candidate);
  const b = normalizedHost(expected);
  return Boolean(a && b && (a === b || a.endsWith(`.${b}`)));
}

function canonicalSourceKey(url: string): string {
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    let path = parsed.pathname || "/";
    while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${host}${path}${parsed.search}`;
  } catch {
    return url;
  }
}

function citationsForRun(run: PromptRun): Citation[] {
  return run.analysis?.citations || run.result?.citations || [];
}

function citationsForEntity(runs: IndexedRun[], entityName: string): string[] {
  const urls: string[] = [];
  for (const item of runs) {
    for (const citation of citationsForRun(item.run)) {
      if (citation.entityName && containsText(citation.entityName, entityName)) urls.push(citation.url);
    }
  }
  return uniqueStrings(urls);
}

function citationBelongsToEntity(citation: Citation, entity: Entity): boolean {
  const domain = citation.domain || citationDomain(citation.url);
  if (domainMatchesKnown(domain, entity.domain)) return true;
  const searchable = `${citation.title || ""} ${citation.url} ${domain}`;
  return entityTerms(entity).some((term) => containsText(searchable, term));
}

function citationHasOfficialDomain(citation: Citation, entity: Entity): boolean {
  return domainMatchesKnown(citation.domain || citationDomain(citation.url), entity.domain);
}

function sourceStatus(input: {
  audit: AuditRun;
  citation: Citation;
  run: PromptRun;
  locale: HumanReportLocale;
}): { relevance: SourceRelevance; reason: string } {
  const { audit, citation, run, locale } = input;
  if (citation.citationType === "target_official" || citation.citationType === "target_github") {
    return { relevance: "related", reason: fallback(locale, "目标品牌官方来源", "Official source for the target brand") };
  }
  if (citation.citationType === "competitor_official") {
    return { relevance: "related", reason: fallback(locale, "竞争对手官方来源", "Official source for a competitor") };
  }
  if (citationBelongsToEntity(citation, audit.target) && targetIsMentioned(run)) {
    return { relevance: "related", reason: fallback(locale, "第三方页面直接支持目标品牌判断", "Third-party page directly supports a target-brand judgment") };
  }
  const mentionedCompetitor = audit.competitors.find((competitor) =>
    competitorMentions(run).some((mention) => mention.entityId === competitor.id) && citationBelongsToEntity(citation, competitor),
  );
  if (mentionedCompetitor) {
    return { relevance: "possible", reason: fallback(locale, "提到了相关品牌，但来源可能指向同名项目", "Mentions a related brand, but the source may point to a same-name project") };
  }
  const sourceText = `${citation.title || ""} ${citation.url} ${citation.domain}`;
  const categoryWords = wordsFromText(audit.domainProfile?.category || audit.domainProfile?.description || "");
  const hasCategoryWord = categoryWords.some((word) => containsText(sourceText, word));
  if (hasCategoryWord && (targetIsMentioned(run) || competitorMentions(run).length > 0)) {
    return { relevance: "possible", reason: fallback(locale, "和本次问题场景可能相关", "Possibly related to the audited question scenario") };
  }
  return { relevance: "excluded", reason: fallback(locale, "未能和目标品牌、确认竞品或问题场景建立清晰关系", "No clear connection to the target brand, confirmed competitors, or audited scenario") };
}

function statement(text: string, answerIndexes: number[] = [], sourceUrls: string[] = []): EvidenceStatement {
  return {
    text: compactSpaces(text),
    answerIndexes: [...new Set(answerIndexes)],
    sourceUrls: uniqueStrings(sourceUrls),
  };
}

function fallback(locale: HumanReportLocale, zh: string, en: string): string {
  return locale === "zh" ? zh : en;
}

function firstEvidenceIndex(items: IndexedRun[]): number[] {
  const item = items.find((row) => row.run.status === "completed") || items[0];
  return item ? [item.index] : [];
}

function firstSourceUrl(items: IndexedRun[]): string[] {
  for (const item of items) {
    const citation = citationsForRun(item.run)[0];
    if (citation?.url) return [citation.url];
  }
  return [];
}

function shortModelName(run: PromptRun): string {
  const model = run.model.toLowerCase();
  if (model.includes("openai/") || model.includes("gpt")) return "GPT";
  if (model.includes("gemini") || run.providerId === "gemini") return "Gemini";
  if (model.includes("claude") || model.includes("anthropic") || run.providerId === "anthropic") return "Claude";
  if (model.includes("perplexity") || model.includes("sonar") || run.providerId === "perplexity") return "Perplexity";
  if (model.includes("deepseek") || run.providerId === "deepseek") return "DeepSeek";
  return sourceName(run);
}

function hasTargetSource(run: PromptRun): boolean {
  return citationsForRun(run).some((citation) => citation.citationType === "target_official" || citation.citationType === "target_github");
}

function modelSummaryText(input: {
  brand: string;
  competitor: string;
  recognizes: boolean;
  natural: boolean;
  hasOfficialSource: boolean;
  hasCompetitor: boolean;
  failedOnly: boolean;
  locale: HumanReportLocale;
}): string {
  if (input.failedOnly) return fallback(input.locale, "没有返回可用回答", "No usable answer returned");
  if (input.recognizes && input.natural && input.hasOfficialSource) {
    return fallback(input.locale, "表现最好，能够主动提及并引用官网", "Best in this run: mentions the brand naturally and cites official sources");
  }
  if (input.recognizes && input.natural) {
    return fallback(input.locale, "知道你的品牌，也会在自然问题中想到你", "Recognizes the brand and surfaces it in natural questions");
  }
  if (input.recognizes && input.hasCompetitor) {
    return fallback(input.locale, `知道你的品牌，但更容易想到 ${input.competitor}`, `Recognizes the brand, but more readily surfaces ${input.competitor}`);
  }
  if (input.recognizes) {
    return fallback(input.locale, "知道你的品牌，但不会在自然问题中主动推荐", "Recognizes the brand, but does not surface it in natural questions");
  }
  if (input.hasCompetitor) {
    return fallback(input.locale, `暂时不能准确识别你的品牌，更容易想到 ${input.competitor}`, `Does not clearly recognize the brand and more readily surfaces ${input.competitor}`);
  }
  return fallback(input.locale, "暂时不能准确识别你的品牌", "Does not clearly recognize the brand in this run");
}

function featureSummary(text: string, locale: HumanReportLocale): string {
  const catalog = [
    { terms: ["真人", "real user", "human"], zh: "真人互助", en: "real-user participation" },
    { terms: ["免费", "free"], zh: "免费", en: "free access" },
    { terms: ["可追踪", "记录", "track"], zh: "可追踪记录", en: "traceable records" },
    { terms: ["零权限", "permission"], zh: "低权限接入", en: "low-permission setup" },
    { terms: ["积分", "credit"], zh: "积分信用", en: "credit-based exchange" },
    { terms: ["star", "stars"], zh: "Star增长", en: "star growth" },
    { terms: ["fork", "forks"], zh: "Fork增长", en: "fork growth" },
    { terms: ["watch", "watcher"], zh: "Watcher增长", en: "watcher growth" },
    { terms: ["开源", "open source"], zh: "开源项目曝光", en: "open-source project visibility" },
    { terms: ["监测", "monitor"], zh: "可见度监测", en: "visibility monitoring" },
    { terms: ["引用", "citation"], zh: "引用来源", en: "citation sources" },
  ];
  const found: string[] = [];
  for (const item of catalog) {
    if (item.terms.some((term) => containsText(text, term))) found.push(locale === "zh" ? item.zh : item.en);
  }
  return uniqueStrings(found).slice(0, 4).join(locale === "zh" ? "、" : ", ");
}

function buildHeadline(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): string {
  const name = audit.target.name;
  const modelStories = buildModelComparisons(audit, indexedRuns(audit), locale);
  const recognizedModels = modelStories.filter((item) => containsText(item.summary, "知道") || containsText(item.summary, "recognizes")).length;
  const naturalModels = modelStories.filter((item) => containsText(item.summary, "主动提及") || containsText(item.summary, "自然问题中想到") || containsText(item.summary, "surfaces it")).length;
  const topCompetitor = buildCompetitors(audit, runs, locale)[0]?.name;
  const bestModel = modelStories.find((item) => containsText(item.summary, "表现最好") || containsText(item.summary, "Best"))?.displayName;
  const weakestModel = [...modelStories].reverse().find((item) => containsText(item.summary, "暂时不能准确识别") || containsText(item.summary, "No usable"))?.displayName;
  const awareness = recognizedModels > Math.max(1, modelStories.length / 2)
    ? fallback(locale, `多数AI知道 ${name}`, `Most tested AIs recognize ${name}`)
    : fallback(locale, `部分AI知道 ${name}`, `Some tested AIs recognize ${name}`);
  const discovery = naturalModels > 1
    ? fallback(locale, "自然问题中偶尔会推荐它", "it is occasionally surfaced in natural questions")
    : fallback(locale, "自然问题中很少推荐它", "it is rarely surfaced in natural questions");
  const competitor = topCompetitor ? fallback(locale, `${topCompetitor} 是最明显竞争对手`, `${topCompetitor} is the clearest competitor`) : fallback(locale, "主要竞争对手还不清楚", "the main competitor is still unclear");
  const modelPart = bestModel && weakestModel
    ? fallback(locale, `${bestModel}识别最好，${weakestModel}最弱`, `${bestModel} is strongest; ${weakestModel} is weakest`)
    : "";
  const parts = [awareness, discovery, competitor, modelPart].filter(Boolean);
  const text = `${parts.join("；")}。`;
  return text.length <= 80 ? text : `${awareness}，但${discovery}；${competitor}。`;
}

function buildBrandRecognition(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): string {
  const brandRuns = runs.filter((item) => categoryIsBrand(item.run));
  const hasBrandRecognition = brandRuns.some((item) => targetIsMentioned(item.run));
  if (brandRuns.length === 0) {
    return fallback(locale, "本次没有直接点名品牌的问题，无法判断 AI 是否认识你的品牌。", "This run did not include direct brand questions, so brand recognition cannot be judged.");
  }
  if (hasBrandRecognition && brandRuns.every((item) => targetIsMentioned(item.run))) {
    return fallback(locale, `当问题直接点名 ${audit.target.name} 时，AI 能识别这个品牌。`, `When directly asked about ${audit.target.name}, AI recognizes the brand.`);
  }
  if (hasBrandRecognition) {
    return fallback(locale, `AI 对 ${audit.target.name} 的识别不稳定：部分直接点名的问题没有得到明确识别。`, `AI recognition of ${audit.target.name} is uneven: some direct brand questions were not clearly recognized.`);
  }
  return fallback(locale, `即使问题直接点名 ${audit.target.name}，本次 AI 回答也没有给出清晰识别。`, `Even when directly asked about ${audit.target.name}, this run did not produce clear recognition.`);
}

function buildModelComparisons(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): ModelComparisonStory[] {
  const bySource = new Map<string, IndexedRun[]>();
  for (const item of runs) {
    const key = sourceName(item.run);
    bySource.set(key, [...(bySource.get(key) || []), item]);
  }
  const stories: ModelComparisonStory[] = [];
  for (const [name, items] of bySource.entries()) {
    const completedItems = items.filter((item) => item.run.status === "completed" && Boolean(item.run.result) && Boolean(item.run.analysis));
    const firstItem = items[0];
    if (!firstItem) continue;
    const displayName = shortModelName(firstItem.run);
    if (completedItems.length === 0) {
      stories.push({
        sourceName: name,
        displayName,
        summary: modelSummaryText({
          brand: audit.target.name,
          competitor: "",
          recognizes: false,
          natural: false,
          hasOfficialSource: false,
          hasCompetitor: false,
          failedOnly: true,
          locale,
        }),
        recognition: fallback(locale, `这个 AI 来源本次没有返回可用回答。`, "This AI source did not return usable answers in this run."),
        naturalDiscovery: fallback(locale, `因此无法判断它是否会主动想到 ${audit.target.name}。`, `So this run cannot judge whether it would surface ${audit.target.name}.`),
        competitors: [],
        sourceUrls: [],
        answerIndexes: firstEvidenceIndex(items),
      });
      continue;
    }
    const brandItems = completedItems.filter((item) => categoryIsBrand(item.run));
    const organicItems = completedItems.filter((item) => categoryIsOrganic(item.run));
    const recognizes = brandItems.some((item) => targetIsMentioned(item.run));
    const natural = organicItems.some((item) => targetIsMentioned(item.run));
    const competitors = uniqueStrings(completedItems.flatMap((item) => competitorMentions(item.run).map((mention) => mention.entityName))).slice(0, 3);
    const competitorItems = completedItems.filter((item) => competitorMentions(item.run).length > 0);
    const evidenceItems = natural
      ? organicItems.filter((item) => targetIsMentioned(item.run))
      : competitors.length
        ? competitorItems
        : brandItems.length
          ? brandItems
          : completedItems;
    stories.push({
      sourceName: name,
      displayName,
      summary: modelSummaryText({
        brand: audit.target.name,
        competitor: competitors[0] || "",
        recognizes,
        natural,
        hasOfficialSource: completedItems.some((item) => hasTargetSource(item.run)),
        hasCompetitor: competitors.length > 0,
        failedOnly: false,
        locale,
      }),
      recognition: recognizes
        ? fallback(locale, `直接问到 ${audit.target.name} 时，它能识别这个品牌。`, `When directly asked about ${audit.target.name}, it recognizes the brand.`)
        : fallback(locale, `直接问到 ${audit.target.name} 时，本次没有形成清晰识别。`, `When directly asked about ${audit.target.name}, this run did not show clear recognition.`),
      naturalDiscovery: natural
        ? fallback(locale, `在自然问题里，它至少有一次主动提到 ${audit.target.name}。`, `In natural questions, it mentions ${audit.target.name} at least once.`)
        : fallback(locale, `在自然问题里，它本次没有主动想到 ${audit.target.name}。`, `In natural questions, it did not surface ${audit.target.name} in this run.`),
      competitors,
      sourceUrls: firstSourceUrl(evidenceItems),
      answerIndexes: firstEvidenceIndex(evidenceItems),
    });
  }
  return stories;
}

function buildBrandDescriptions(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): EvidenceStatement[] {
  const targetRuns = runs.filter((item) => targetIsMentioned(item.run));
  const organicTargetRuns = targetRuns.filter((item) => categoryIsOrganic(item.run));
  const brandMisses = runs.filter((item) => categoryIsBrand(item.run) && !targetIsMentioned(item.run));
  const organicMisses = runs.filter((item) => categoryIsOrganic(item.run) && !targetIsMentioned(item.run));
  const category = audit.domainProfile?.category || audit.target.domain;
  const description = audit.domainProfile?.description || "";
  const targetSources = runs.filter((item) => item.run.status === "completed" && hasTargetSource(item.run));
  const statements: EvidenceStatement[] = [];

  if (targetRuns.length > 0 || description) {
    statements.push(
      statement(
        fallback(
          locale,
          `AI主要把 ${audit.target.name} 理解为${category}。`,
          `AI mainly understands ${audit.target.name} as ${category}.`,
        ),
        firstEvidenceIndex(targetRuns),
        firstSourceUrl(targetSources),
      ),
    );
  } else {
    statements.push(statement(fallback(locale, "本次回答不足以判断 AI 怎样理解你的品牌。", "This run is not enough to judge how AI understands the brand.")));
  }

  if (description) {
    const featureText = featureSummary(`${description} ${targetRuns.map((item) => item.run.result?.text || "").join(" ")}`, locale);
    statements.push(
      statement(
        featureText
          ? fallback(locale, `AI记住的核心点是：${featureText}。`, `AI remembers these core points: ${featureText}.`)
          : fallback(locale, "AI能描述它的基本用途，但没有形成更清晰的能力记忆。", "AI can describe the basic use, but not a clearer capability memory."),
        firstEvidenceIndex(targetRuns),
        firstSourceUrl(targetSources),
      ),
    );
  }

  if (organicMisses.length > 0 || brandMisses.length > 0) {
    statements.push(
      statement(
        organicMisses.length > 0
          ? fallback(
              locale,
              `AI还没有稳定把 ${audit.target.name} 和不点名品牌的用户需求联系起来。`,
              `AI does not yet reliably connect ${audit.target.name} with unbranded user needs.`,
            )
          : fallback(
              locale,
              `部分模型直接被问到 ${audit.target.name} 时仍回答含糊。`,
              `Some models still answer vaguely when directly asked about ${audit.target.name}.`,
            ),
        firstEvidenceIndex(organicMisses.length > 0 ? organicMisses : brandMisses),
        firstSourceUrl(organicMisses.length > 0 ? organicMisses : brandMisses),
      ),
    );
  }

  return uniqueStatementTexts(statements).slice(0, 3);
}

function buildBrandEmphasis(runs: IndexedRun[], locale: HumanReportLocale): EvidenceStatement[] {
  const targetRuns = runs.filter((row) => targetIsMentioned(row.run));
  if (targetRuns.length === 0) return [];
  return [
    statement(
      fallback(locale, "直接点名品牌时，AI可以给出相关描述；自然发现仍不稳定。", "When named directly, AI can describe the brand; natural discovery is still uneven."),
      firstEvidenceIndex(targetRuns),
      firstSourceUrl(targetRuns),
    ),
  ];
}

function buildBrandMissing(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): string[] {
  const organicCompetitorOnly = runs.filter((item) => categoryIsOrganic(item.run) && !targetIsMentioned(item.run) && competitorMentions(item.run).length > 0);
  if (organicCompetitorOnly.length === 0) {
    return [fallback(locale, "当前回答不足以判断 AI 忽略了哪些重要能力。", "Current answers are not enough to determine which important capabilities AI is missing.")];
  }
  return [
    fallback(
      locale,
      `AI尚未稳定把 ${audit.target.name} 和不点名品牌的搜索、推荐、替代品问题联系起来。`,
      `AI does not yet reliably connect ${audit.target.name} with unbranded search, recommendation, or alternative questions.`,
    ),
  ];
}

function buildBrandUncertainty(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): string[] {
  const vagueBrandRuns = runs.filter((item) => categoryIsBrand(item.run) && !targetIsMentioned(item.run));
  if (vagueBrandRuns.length > 0) {
    return [
      fallback(
        locale,
        `部分模型直接被问到 ${audit.target.name} 时仍没有给出清晰识别。`,
        `Some models still do not clearly recognize ${audit.target.name} when asked directly.`,
      ),
    ];
  }
  return [
    fallback(
      locale,
      "当前回答没有足够证据确认明显错误或过时理解。",
      "Current answers are not enough to confirm clearly wrong or outdated understanding.",
    ),
  ];
}

function uniqueStatementTexts(items: EvidenceStatement[]): EvidenceStatement[] {
  const seen = new Set<string>();
  const output: EvidenceStatement[] = [];
  for (const item of items) {
    const key = item.text.toLowerCase();
    if (!item.text || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

interface CompetitorEvidence {
  competitor: Entity;
  mentionedRuns: IndexedRun[];
  organicOnlyRuns: IndexedRun[];
  comparisonRuns: IndexedRun[];
  sourceUrls: string[];
  officialSourceUrls: string[];
  hasProductDescription: boolean;
  modelNames: string[];
  score: number;
}

function buildCompetitorEvidence(audit: AuditRun, runs: IndexedRun[]): CompetitorEvidence[] {
  const rows: CompetitorEvidence[] = [];
  const seenCompetitors = new Set<string>();
  for (const competitor of audit.competitors) {
    const competitorKey = `${competitor.name.toLowerCase()}::${competitor.domain.toLowerCase()}`;
    if (seenCompetitors.has(competitorKey)) continue;
    seenCompetitors.add(competitorKey);
    const mentionedRuns = runs.filter((item) => competitorMentions(item.run).some((mention) => mention.entityId === competitor.id));
    const comparisonRuns = mentionedRuns.filter((item) => categoryIsComparison(item.run));
    const organicOnlyRuns = runs.filter(
      (item) => categoryIsOrganic(item.run) && !targetIsMentioned(item.run) && competitorMentions(item.run).some((mention) => mention.entityId === competitor.id),
    );
    const sourceUrls = citationsForEntity(mentionedRuns, competitor.name);
    const officialSourceUrls = uniqueStrings(
      mentionedRuns.flatMap((item) =>
        citationsForRun(item.run)
          .filter((citation) => citationHasOfficialDomain(citation, competitor))
          .map((citation) => citation.url),
      ),
    );
    const hasProductDescription = mentionedRuns.some((item) => {
      const fromAnswer = sentenceContaining(item.run.result?.text, entityTerms(competitor));
      const fromMention = competitorMentions(item.run)
        .filter((mention) => mention.entityId === competitor.id)
        .map(mentionEvidenceText)
        .find(Boolean);
      return usefulDescription(fromAnswer) || usefulDescription(fromMention || "");
    });
    const modelNames = uniqueStrings(mentionedRuns.map((item) => shortModelName(item.run)));
    if (mentionedRuns.length === 0 && sourceUrls.length === 0) continue;
    rows.push({
      competitor,
      mentionedRuns,
      organicOnlyRuns,
      comparisonRuns,
      sourceUrls,
      officialSourceUrls,
      hasProductDescription,
      modelNames,
      score: organicOnlyRuns.length * 4 + modelNames.length * 3 + sourceUrls.length * 2 + comparisonRuns.length,
    });
  }
  return rows.sort((a, b) => b.score - a.score);
}

function isPrimaryCompetitor(row: CompetitorEvidence): boolean {
  return row.organicOnlyRuns.length >= 2 && row.modelNames.length >= 2 && row.officialSourceUrls.length > 0 && row.hasProductDescription;
}

function buildCompetitors(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): CompetitorStory[] {
  const category = audit.domainProfile?.category || fallback(locale, "同一类用户需求", "the same user need");
  return buildCompetitorEvidence(audit, runs)
    .filter(isPrimaryCompetitor)
    .slice(0, 3)
    .map((row) => ({
      name: row.competitor.name,
      description: fallback(
        locale,
        `AI把它归入${category}的候选范围。`,
        `AI places it in the candidate set for ${category}.`,
      ),
      why: fallback(
        locale,
        "多个AI在自然问题中主动提到，并且有明确官网和产品描述支撑。",
        "Multiple AIs surface it in natural questions, with a clear homepage and product description behind it.",
      ),
      threat: fallback(locale, "已确认竞争对手", "Confirmed competitor"),
      answerIndexes: firstEvidenceIndex(row.organicOnlyRuns.length ? row.organicOnlyRuns : row.mentionedRuns),
      sourceUrls: row.officialSourceUrls.slice(0, 1),
    }));
}

function buildOtherCompetitors(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): string[] {
  return buildCompetitorEvidence(audit, runs)
    .filter((row) => !isPrimaryCompetitor(row))
    .map((row) =>
      row.officialSourceUrls.length > 0
        ? row.competitor.name
        : fallback(
            locale,
            `${row.competitor.name}（AI多次提及，但现有来源可能指向多个同名项目，建议进一步确认）`,
            `${row.competitor.name} (mentioned by AI, but current sources may point to same-name projects; confirm further)`,
          ),
    )
    .slice(0, 8);
}

function buildCompetitorAdvantages(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): EvidenceStatement[] {
  const primary = buildCompetitorEvidence(audit, runs).filter(isPrimaryCompetitor);
  if (primary.length === 0) {
    return [statement(fallback(locale, "本次证据不足，无法判断竞争对手在哪些地方明显领先。", "This run is not enough to judge where competitors clearly outperform you."))];
  }
  const top = primary[0];
  if (!top) return [];
  const topic = top.organicOnlyRuns[0]?.run.prompt.topic || audit.domainProfile?.category || fallback(locale, "核心用户问题", "core user questions");
  return [
    statement(
      fallback(
        locale,
        `${top.competitor.name} 更容易被AI和「${shorten(topic, 24)}」联系起来；它在多个自然问题中出现，并有来源支撑。`,
        `${top.competitor.name} is more strongly associated with "${shorten(topic, 38)}"; multiple AIs surface it in natural questions with sources.`,
      ),
      firstEvidenceIndex(top.organicOnlyRuns),
      top.sourceUrls.slice(0, 1),
    ),
  ];
}

function buildTargetAdvantages(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): EvidenceStatement[] {
  const organicTargetOnly = runs.filter((item) => categoryIsOrganic(item.run) && targetIsMentioned(item.run) && competitorMentions(item.run).length === 0);
  const sourceBackedTarget = runs.filter((item) => categoryIsOrganic(item.run) && targetIsMentioned(item.run) && hasTargetSource(item.run));
  if (organicTargetOnly.length >= 2) {
    return [
      statement(
        fallback(
          locale,
          `${audit.target.name} 在部分自然问题中能单独出现，说明AI已经把它和少数需求建立了直接联系。`,
          `${audit.target.name} appears alone in some natural questions, showing AI connects it with a few needs directly.`,
        ),
        firstEvidenceIndex(organicTargetOnly),
        firstSourceUrl(organicTargetOnly),
      ),
    ];
  }
  if (sourceBackedTarget.length >= 2) {
    return [
      statement(
        fallback(
          locale,
          `${audit.target.name} 的官网来源能支撑部分自然回答，但还不足以证明它明显领先竞争对手。`,
          `${audit.target.name} has official sources supporting some natural answers, but not enough to prove a clear lead.`,
        ),
        firstEvidenceIndex(sourceBackedTarget),
        firstSourceUrl(sourceBackedTarget),
      ),
    ];
  }
  return [statement(fallback(locale, "本次证据不足，无法确认你在哪些方面明显领先竞争对手。", "This run is not enough to confirm where you clearly outperform competitors."))];
}

function buildMissingScenarios(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): EvidenceStatement[] {
  const byPrompt = new Map<string, { prompt: string; competitors: string[]; runs: IndexedRun[] }>();
  for (const item of runs) {
    const competitors = uniqueStrings(competitorMentions(item.run).map((mention) => mention.entityName));
    if (!categoryIsOrganic(item.run) || targetIsMentioned(item.run) || competitors.length === 0) continue;
    const existing = byPrompt.get(item.run.prompt.text);
    if (existing) {
      existing.competitors = uniqueStrings([...existing.competitors, ...competitors]);
      existing.runs.push(item);
    } else {
      byPrompt.set(item.run.prompt.text, { prompt: item.run.prompt.text, competitors, runs: [item] });
    }
  }
  const findings: EvidenceStatement[] = [];
  for (const item of byPrompt.values()) {
    findings.push(
      statement(
        fallback(
          locale,
          `寻找「${shorten(item.prompt, 30)}」时，AI能想到 ${item.competitors.slice(0, 3).join("、")}，但没有想到 ${audit.target.name}。`,
          `For "${shorten(item.prompt, 48)}", AI surfaces ${item.competitors.slice(0, 3).join(", ")} but not ${audit.target.name}.`,
        ),
        firstEvidenceIndex(item.runs),
        firstSourceUrl(item.runs),
      ),
    );
  }
  return uniqueStatementTexts(findings).slice(0, 5);
}

function relevanceRank(relevance: SourceRelevance): number {
  if (relevance === "related") return 3;
  if (relevance === "possible") return 2;
  return 1;
}

function groupSources(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): {
  targetSources: SourceStory[];
  competitorSources: SourceStory[];
  thirdPartySources: SourceStory[];
  allSources: SourceStory[];
} {
  const byUrl = new Map<string, SourceStory & { weight: number; type: "target" | "competitor" | "third" }>();
  for (const item of runs) {
    for (const citation of citationsForRun(item.run)) {
      if (!citation.url) continue;
      const status = sourceStatus({ audit, citation, run: item.run, locale });
      const type =
        citation.citationType === "target_official" || citation.citationType === "target_github"
          ? "target"
          : citation.citationType === "competitor_official"
            ? "competitor"
            : "third";
      const sourceKey = canonicalSourceKey(citation.url);
      const existing = byUrl.get(sourceKey);
      const supports =
        type === "target"
          ? fallback(locale, `支持 ${audit.target.name} 相关回答`, `Supports answers about ${audit.target.name}`)
          : type === "competitor"
            ? fallback(locale, `支持竞争对手相关回答`, "Supports competitor-related answers")
            : status.relevance === "excluded"
              ? status.reason
              : fallback(locale, "影响 AI 的背景判断或推荐依据", "Supports AI background judgment or recommendations");
      if (existing) {
        existing.weight += 1;
        existing.answerIndexes = [...new Set([...existing.answerIndexes, item.index])];
        if (relevanceRank(status.relevance) > relevanceRank(existing.relevance)) {
          existing.relevance = status.relevance;
          existing.relevanceReason = status.reason;
        }
      } else {
        byUrl.set(sourceKey, {
          title: citationTitle(citation),
          domain: citation.domain || citationDomain(citation.url),
          url: citation.url,
          supports,
          answerIndexes: [item.index],
          relevance: status.relevance,
          relevanceReason: status.reason,
          weight: 1,
          type,
        });
      }
    }
  }
  const all = [...byUrl.values()].sort((a, b) => relevanceRank(b.relevance) - relevanceRank(a.relevance) || b.weight - a.weight);
  const clean = (items: Array<SourceStory & { weight: number; type: "target" | "competitor" | "third" }>): SourceStory[] =>
    items.map((item) => ({
      title: item.title,
      domain: item.domain,
      url: item.url,
      supports: item.supports,
      answerIndexes: item.answerIndexes,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    }));
  const related = all.filter((item) => item.relevance === "related");
  return {
    targetSources: clean(related.filter((item) => item.type === "target")),
    competitorSources: clean(related.filter((item) => item.type === "competitor")),
    thirdPartySources: clean(related.filter((item) => item.type === "third")),
    allSources: clean(all),
  };
}

function buildAnswers(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale, sources: SourceStory[]): AnswerStory[] {
  const visibleSourceKeys = new Set(
    sources
      .filter((source) => source.relevance !== "excluded")
      .map((source) => canonicalSourceKey(source.url)),
  );
  return runs.map((item) => {
    if (item.run.status !== "completed" || !item.run.result) {
      return {
        index: item.index,
        prompt: item.run.prompt.text,
        summary: fallback(locale, "这个请求没有返回可用回答。", "This request did not return a usable answer."),
        answer: fallback(locale, "没有返回可用回答。", "No usable answer was returned."),
        returnedAnswer: false,
        targetMentioned: false,
        competitorsMentioned: [],
        citations: [],
        sourceName: sourceName(item.run),
        model: item.run.model,
        webSearch: searchSummary(item.run, locale),
        intentAnalysis: item.run.intentAnalysis,
      };
    }
    const targetMentioned = targetIsMentioned(item.run);
    const competitors = uniqueStrings(competitorMentions(item.run).map((mention) => mention.entityName));
    const intentSummary = item.run.intentAnalysis?.status === "completed" ? item.run.intentAnalysis.adaptedResult.oneSentence : "";
    const summary = intentSummary || (targetMentioned && competitors.length
      ? fallback(locale, `AI同时提到了 ${audit.target.name} 和 ${competitors.slice(0, 4).join("、")}。`, `AI mentions both ${audit.target.name} and ${competitors.slice(0, 4).join(", ")}.`)
      : targetMentioned
        ? fallback(locale, `AI提到了 ${audit.target.name}。`, `AI mentions ${audit.target.name}.`)
        : competitors.length
          ? fallback(locale, `AI提到了 ${competitors.slice(0, 4).join("、")}，但没有提到 ${audit.target.name}。`, `AI mentions ${competitors.slice(0, 4).join(", ")} but not ${audit.target.name}.`)
          : fallback(locale, `AI没有提到 ${audit.target.name} 或已监测竞争对手。`, `AI does not mention ${audit.target.name} or monitored competitors.`));
    return {
      index: item.index,
      prompt: item.run.prompt.text,
      summary,
      answer: item.run.result?.text || item.run.error || "",
      returnedAnswer: true,
      targetMentioned,
      competitorsMentioned: competitors,
      citations: citationsForRun(item.run).filter((citation) => visibleSourceKeys.has(canonicalSourceKey(citation.url))),
      sourceName: sourceName(item.run),
      model: item.run.model,
      webSearch: searchSummary(item.run, locale),
      intentAnalysis: item.run.intentAnalysis,
    };
  });
}

export function buildHumanReport(audit: AuditRun): HumanReport {
  const locale = localeForAudit(audit);
  const allRuns = indexedRuns(audit);
  const runs = completedRuns(audit);
  const groupedSources = groupSources(audit, runs, locale);
  const brandDescriptions = buildBrandDescriptions(audit, runs, locale);
  const brandEmphasis = buildBrandEmphasis(runs, locale);
  const competitors = buildCompetitors(audit, runs, locale);
  const competitorAdvantages = buildCompetitorAdvantages(audit, runs, locale);
  const targetAdvantages = buildTargetAdvantages(audit, runs, locale);
  const missingScenarios = buildMissingScenarios(audit, runs, locale);
  const name = audit.target.name;
  return {
    locale,
    title: fallback(locale, `${name} 的 AI 可见度报告`, `${name} AI Visibility Report`),
    subtitle: fallback(locale, "这份报告只展示本次 AI 实际回答中能被证据支持的结论。", "This report only shows conclusions supported by this run's actual AI answers."),
    caveat: fallback(
      locale,
      "本报告来自你选择的 AI API 和模型，不代表网页端产品或真人地区结果。",
      "This report comes from the selected AI APIs and models, not browser products or human-verified regional results.",
    ),
    sections: {
      headline: buildHeadline(audit, runs, locale),
      modelComparisons: buildModelComparisons(audit, allRuns, locale),
      brandRecognition: buildBrandRecognition(audit, runs, locale),
      brandDescriptions,
      brandEmphasis,
      brandMissing: buildBrandMissing(audit, runs, locale),
      brandUncertainty: buildBrandUncertainty(audit, runs, locale),
      competitors,
      otherCompetitors: buildOtherCompetitors(audit, runs, locale),
      competitorAdvantages: competitorAdvantages.length
        ? competitorAdvantages
        : [
            statement(
              fallback(locale, "当前回答不足以判断哪些竞争对手比你做得好。", "Current answers are not enough to judge which competitors perform better."),
            ),
          ],
      targetAdvantages: targetAdvantages.length
        ? targetAdvantages
        : [statement(fallback(locale, "当前回答不足以判断你比竞争对手做得好的地方。", "Current answers are not enough to judge where you perform better than competitors."))],
      missingScenarios: missingScenarios.length
        ? missingScenarios
        : [statement(fallback(locale, "当前回答不足以确定用户在哪些问题里只会看到竞争对手。", "Current answers are not enough to identify questions where users only see competitors."))],
      targetSources: groupedSources.targetSources,
      competitorSources: groupedSources.competitorSources,
      thirdPartySources: groupedSources.thirdPartySources,
      allSources: groupedSources.allSources,
      answers: buildAnswers(audit, allRuns, locale, groupedSources.allSources),
    },
  };
}

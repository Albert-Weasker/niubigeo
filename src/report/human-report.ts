import type { AuditRun, Citation, Mention, PromptRun } from "../core/types.js";
import type { EntityRelationship, EntityRelationshipType, IntentRunAnalysis } from "../intent/intent-schema.js";

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

interface EntityEvidence {
  entity: EntityRelationship;
  run: PromptRun;
  index: number;
}

const COMPETITIVE_RELATIONSHIPS = new Set<EntityRelationshipType>(["competitor", "direct_alternative", "indirect_alternative", "compared_option"]);

function localeFor(audit: AuditRun): HumanReportLocale {
  const language = audit.prompts.find((prompt) => prompt.language.trim())?.language.trim().toLocaleLowerCase() || "en";
  return language.startsWith("zh") ? "zh" : "en";
}

function tr(locale: HumanReportLocale, zh: string, en: string): string {
  return locale === "zh" ? zh : en;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

function targetMention(run: PromptRun): Mention | undefined {
  return run.analysis?.mentions.find((mention) => mention.entityType === "target" && mention.isMentioned);
}

function citations(run: PromptRun): Citation[] {
  return run.analysis?.citations || run.result?.citations || [];
}

function indexed(audit: AuditRun): IndexedRun[] {
  return audit.runs.map((run, index) => ({ run, index: index + 1 }));
}

function completed(audit: AuditRun): IndexedRun[] {
  return indexed(audit).filter((item) => item.run.status === "completed" && Boolean(item.run.result));
}

function statement(text: string, answerIndexes: number[] = [], sourceUrls: string[] = []): EvidenceStatement {
  return { text: text.trim(), answerIndexes: [...new Set(answerIndexes)], sourceUrls: unique(sourceUrls) };
}

function sourceName(run: PromptRun): string {
  let label = run.sourceLabel || run.providerId;
  if (label.startsWith("Source: ")) label = label.slice("Source: ".length);
  return `${label} / ${run.model}`;
}

function modelName(run: PromptRun): string {
  const parts = run.model.split("/").filter(Boolean);
  return parts[parts.length - 1] || run.model || run.providerId;
}

function searchSummary(run: PromptRun, locale: HumanReportLocale): string {
  const search = run.search || run.result?.search;
  if (!search?.used) {
    return search?.requested
      ? tr(locale, "已请求联网，但 Provider 未确认执行", "Web search requested but not confirmed by the provider")
      : tr(locale, "未联网", "No web search");
  }
  return tr(locale, "Provider 原生联网", "Provider-native web search");
}

function entities(runs: IndexedRun[]): EntityEvidence[] {
  return runs.flatMap((item) => {
    if (item.run.intentAnalysis?.status !== "completed") return [];
    return item.run.intentAnalysis.entities.map((entity) => ({ entity, run: item.run, index: item.index }));
  });
}

function relation(entity: EntityRelationship): EntityRelationshipType {
  return entity.relationshipToTarget !== "unclear" ? entity.relationshipToTarget : entity.relationshipToQuestion;
}

function competitive(entity: EntityRelationship): boolean {
  return entity.entityRole === "product_or_brand" && COMPETITIVE_RELATIONSHIPS.has(relation(entity));
}

function confirmed(entity: EntityRelationship): boolean {
  return Boolean(
    competitive(entity) &&
    entity.identityStatus === "confirmed" &&
    entity.canonicalUrl &&
    entity.evidenceQuote &&
    entity.sourceUrls.includes(entity.canonicalUrl),
  );
}

function intentStatements(runs: IndexedRun[], select: (analysis: IntentRunAnalysis) => string[]): EvidenceStatement[] {
  const output: EvidenceStatement[] = [];
  const seen = new Set<string>();
  for (const item of runs) {
    const analysis = item.run.intentAnalysis;
    if (!analysis || analysis.status !== "completed") continue;
    const verified = analysis.taskResults.filter((result) => Boolean(result.evidenceQuote));
    if (verified.length === 0) continue;
    for (const value of select(analysis)) {
      const text = value.trim();
      const key = text.toLocaleLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      output.push(statement(text, [item.index], verified.flatMap((result) => result.sourceUrls)));
    }
  }
  return output;
}

function competitorStories(runs: IndexedRun[], locale: HumanReportLocale): CompetitorStory[] {
  const grouped = new Map<string, EntityEvidence[]>();
  for (const row of entities(runs).filter((item) => confirmed(item.entity))) {
    const key = row.entity.canonicalUrl || row.entity.canonicalName || row.entity.name;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  return [...grouped.values()]
    .map((items) => {
      const first = items[0];
      if (!first) throw new Error("Competitor evidence group is empty.");
      return {
        name: first.entity.canonicalName || first.entity.name,
        description: first.entity.explanation,
        why: first.entity.explanation,
        threat: tr(locale, "已确认竞争对手", "Confirmed competitor"),
        answerIndexes: [...new Set(items.map((item) => item.index))],
        sourceUrls: unique(items.flatMap((item) => item.entity.sourceUrls)),
      };
    })
    .sort((a, b) => b.answerIndexes.length - a.answerIndexes.length || a.name.localeCompare(b.name))
    .slice(0, 3);
}

function modelComparisons(audit: AuditRun, runs: IndexedRun[], locale: HumanReportLocale): ModelComparisonStory[] {
  const groups = new Map<string, IndexedRun[]>();
  for (const item of runs) {
    const key = `${item.run.providerId}::${item.run.model}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return [...groups.values()].map((items) => {
    const first = items[0];
    if (!first) throw new Error("Model comparison group is empty.");
    const usable = items.filter((item) => item.run.status === "completed" && Boolean(item.run.result));
    const recognizes = usable.some((item) => Boolean(targetMention(item.run)));
    const natural = usable.some((item) => item.run.prompt.auditCategory === "organic_discovery" && Boolean(targetMention(item.run)));
    const competitorRows = entities(usable).filter((item) => competitive(item.entity));
    const summary = usable.length === 0
      ? tr(locale, "没有返回可用回答", "No usable answer returned")
      : recognizes && natural
        ? tr(locale, `能识别 ${audit.target.name}，并在自然问题中提到它。`, `Recognizes ${audit.target.name} and surfaces it in unbranded questions.`)
        : recognizes
          ? tr(locale, `能识别 ${audit.target.name}，但自然问题中没有稳定提到它。`, `Recognizes ${audit.target.name}, but does not surface it reliably in unbranded questions.`)
          : tr(locale, `本次没有形成对 ${audit.target.name} 的清晰识别。`, `This run did not show clear recognition of ${audit.target.name}.`);
    return {
      sourceName: sourceName(first.run),
      displayName: modelName(first.run),
      summary,
      recognition: recognizes ? tr(locale, "能够识别品牌", "Recognizes the brand") : tr(locale, "未形成清晰识别", "No clear recognition"),
      naturalDiscovery: natural ? tr(locale, "自然问题中出现", "Appears in unbranded questions") : tr(locale, "自然问题中未稳定出现", "Not reliably present in unbranded questions"),
      competitors: unique(competitorRows.map((item) => item.entity.canonicalName || item.entity.name)),
      sourceUrls: unique(competitorRows.flatMap((item) => item.entity.sourceUrls)),
      answerIndexes: competitorRows.length ? [...new Set(competitorRows.map((item) => item.index))] : usable.slice(0, 1).map((item) => item.index),
    };
  });
}

function headline(audit: AuditRun, runs: IndexedRun[], competitors: CompetitorStory[], locale: HumanReportLocale): string {
  const recognized = runs.some((item) => Boolean(targetMention(item.run)));
  const natural = runs.some((item) => item.run.prompt.auditCategory === "organic_discovery" && Boolean(targetMention(item.run)));
  const competitor = competitors[0]?.name;
  if (recognized && natural && competitor) return tr(locale, `AI 能识别 ${audit.target.name}，自然问题中也会想到它；${competitor} 是本次证据最清晰的竞争对象。`, `AI recognizes ${audit.target.name} and surfaces it in unbranded questions; ${competitor} is the clearest competitor in this evidence.`);
  if (recognized && natural) return tr(locale, `AI 能识别 ${audit.target.name}，并会在部分自然问题中想到它；当前证据不足以确认主要竞争对手。`, `AI recognizes ${audit.target.name} and surfaces it in some unbranded questions; the evidence does not confirm a main competitor.`);
  if (recognized && competitor) return tr(locale, `AI 能识别 ${audit.target.name}，但自然问题中没有稳定想到它；${competitor} 有更明确的竞争证据。`, `AI recognizes ${audit.target.name}, but does not surface it reliably in unbranded questions; ${competitor} has clearer competitive evidence.`);
  if (recognized) return tr(locale, `AI 能识别 ${audit.target.name}，但在自然问题中没有稳定想到它；主要竞争对手尚无法确认。`, `AI recognizes ${audit.target.name}, but does not surface it reliably in unbranded questions; no main competitor is confirmed.`);
  return tr(locale, `本次回答不足以确认 AI 是否准确认识 ${audit.target.name}。`, `This run does not provide enough evidence that AI accurately recognizes ${audit.target.name}.`);
}

function differenceStatements(runs: IndexedRun[], locale: HumanReportLocale): EvidenceStatement[] {
  const output: EvidenceStatement[] = [];
  for (const item of runs) {
    if (item.run.prompt.auditCategory !== "organic_discovery" || targetMention(item.run)) continue;
    const rows = entities([item]).filter((entry) => competitive(entry.entity));
    if (rows.length === 0) continue;
    const names = unique(rows.map((entry) => entry.entity.canonicalName || entry.entity.name));
    output.push(statement(
      tr(locale, `在“${item.run.prompt.text}”这条问题中，AI 提到了 ${names.join("、")}，但没有提到目标品牌。`, `For “${item.run.prompt.text}”, AI mentioned ${names.join(", ")} but not the target brand.`),
      [item.index],
      rows.flatMap((entry) => entry.entity.sourceUrls),
    ));
  }
  return output.slice(0, 5);
}

function citationTitle(citation: Citation): string {
  if (citation.title?.trim()) return citation.title.trim();
  try {
    const url = new URL(citation.url);
    return url.pathname && url.pathname !== "/" ? url.pathname : url.hostname;
  } catch {
    return citation.url;
  }
}

function sourceStory(citation: Citation, index: number, locale: HumanReportLocale): SourceStory {
  const target = citation.citationType === "target_official" || citation.citationType === "target_github";
  const competitor = citation.citationType === "competitor_official";
  const thirdParty = citation.citationType === "third_party";
  const relevance: SourceRelevance = target || competitor ? "related" : thirdParty ? "possible" : "excluded";
  const supports = target
    ? tr(locale, "支持目标品牌相关回答", "Supports an answer about the target brand")
    : competitor
      ? tr(locale, "支持竞争对象相关回答", "Supports an answer about a competitor")
      : thirdParty
        ? tr(locale, "为回答提供第三方背景", "Provides third-party context for the answer")
        : tr(locale, "当前结构化证据无法确认用途", "The structured evidence does not confirm how this source was used");
  return {
    title: citationTitle(citation),
    domain: citation.domain,
    url: citation.url,
    supports,
    answerIndexes: [index],
    relevance,
    relevanceReason: supports,
  };
}

function sourceStories(runs: IndexedRun[], locale: HumanReportLocale): SourceStory[] {
  const output = new Map<string, SourceStory>();
  for (const item of runs) {
    for (const citation of citations(item.run)) {
      const current = output.get(citation.url);
      if (current) current.answerIndexes = [...new Set([...current.answerIndexes, item.index])];
      else output.set(citation.url, sourceStory(citation, item.index, locale));
    }
  }
  return [...output.values()];
}

function answerStories(audit: AuditRun, locale: HumanReportLocale): AnswerStory[] {
  return indexed(audit).map((item) => {
    const returnedAnswer = item.run.status === "completed" && Boolean(item.run.result?.text);
    const analysis = item.run.intentAnalysis;
    const summary = analysis?.status === "completed"
      ? analysis.adaptedResult.oneSentence
      : returnedAnswer
        ? targetMention(item.run)
          ? tr(locale, `AI 提到了 ${audit.target.name}。`, `AI mentioned ${audit.target.name}.`)
          : tr(locale, `AI 没有提到 ${audit.target.name}。`, `AI did not mention ${audit.target.name}.`)
        : tr(locale, "这条问题没有返回可用回答。", "This question did not return a usable answer.");
    const story: AnswerStory = {
      index: item.index,
      prompt: item.run.prompt.text,
      summary,
      answer: item.run.result?.text || item.run.error || "",
      returnedAnswer,
      targetMentioned: Boolean(targetMention(item.run)),
      competitorsMentioned: unique(analysis?.status === "completed" ? analysis.entities.filter(competitive).map((entity) => entity.canonicalName || entity.name) : []),
      citations: citations(item.run),
      sourceName: sourceName(item.run),
      model: item.run.model,
      webSearch: searchSummary(item.run, locale),
    };
    if (analysis) story.intentAnalysis = analysis;
    return story;
  });
}

export function buildHumanReport(audit: AuditRun): HumanReport {
  const locale = localeFor(audit);
  const runs = completed(audit);
  const competitors = competitorStories(runs, locale);
  const allSources = sourceStories(runs, locale);
  const descriptions = intentStatements(runs.filter((item) => Boolean(targetMention(item.run))), (analysis) => [analysis.adaptedResult.oneSentence]).slice(0, 3);
  const differences = differenceStatements(runs, locale);
  const other = unique(entities(runs).filter((item) => competitive(item.entity) && !confirmed(item.entity)).map((item) => item.entity.canonicalName || item.entity.name));
  const insufficientCompetitor = statement(tr(locale, "本次证据不足，无法确认竞争对象在哪些场景更容易出现。", "This run does not contain enough evidence to confirm where competitors appear more easily."));
  const insufficientTarget = statement(tr(locale, "本次证据不足，无法确认目标品牌在哪些方面明显领先。", "This run does not contain enough evidence to confirm a clear target-brand advantage."));
  const insufficientMissing = statement(tr(locale, "当前回答不足以确定哪些重要问题只出现了竞争对象。", "Current answers are not enough to identify important questions occupied only by competitors."));
  return {
    locale,
    title: tr(locale, `${audit.target.name} 的 AI 可见度报告`, `${audit.target.name} AI Visibility Report`),
    subtitle: tr(locale, "这份报告只展示本次 AI 回答中有证据支持的结论。", "This report includes only conclusions supported by this run's AI answers."),
    caveat: tr(locale, "数据来源：你选择的 AI Provider API。", "Data source: the AI provider APIs selected for this run."),
    sections: {
      headline: headline(audit, runs, competitors, locale),
      modelComparisons: modelComparisons(audit, indexed(audit), locale),
      brandRecognition: runs.some((item) => Boolean(targetMention(item.run))) ? tr(locale, "AI 在本次回答中识别了目标品牌。", "AI recognized the target brand in this run.") : tr(locale, "本次没有形成清晰的品牌识别。", "This run did not show clear brand recognition."),
      brandDescriptions: descriptions.length ? descriptions : [statement(tr(locale, "当前回答不足以总结 AI 怎样描述这个品牌。", "Current answers are not enough to summarize how AI describes the brand."))],
      brandEmphasis: descriptions,
      brandMissing: intentStatements(runs, (analysis) => analysis.adaptedResult.missing).map((item) => item.text).slice(0, 3),
      brandUncertainty: intentStatements(runs, (analysis) => analysis.adaptedResult.uncertain).map((item) => item.text).slice(0, 3),
      competitors,
      otherCompetitors: other,
      competitorAdvantages: differences.length ? differences.slice(0, 3) : [insufficientCompetitor],
      targetAdvantages: [insufficientTarget],
      missingScenarios: differences.length ? differences : [insufficientMissing],
      targetSources: allSources.filter((source) => runs.some((item) => citations(item.run).some((citation) => citation.url === source.url && (citation.citationType === "target_official" || citation.citationType === "target_github")))).slice(0, 10),
      competitorSources: allSources.filter((source) => runs.some((item) => citations(item.run).some((citation) => citation.url === source.url && citation.citationType === "competitor_official"))).slice(0, 10),
      thirdPartySources: allSources.filter((source) => source.relevance === "possible").slice(0, 10),
      allSources,
      answers: answerStories(audit, locale),
    },
  };
}

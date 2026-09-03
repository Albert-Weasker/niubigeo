import type { Entity, KeywordCandidate, KeywordIntent, KeywordSeedSource, MonitoringPrompt, PromptType } from "../core/types.js";
import { slugify } from "../utils/domain.js";
import { promptContainsTarget } from "./prompt-generator.js";
import { withAuditCategory } from "./audit-category.js";

interface KeywordPromptTemplate {
  intent: KeywordIntent;
  type: PromptType;
  text: string;
  targetIncluded: boolean;
}

function seedSource(keyword: KeywordCandidate): KeywordSeedSource {
  if (keyword.userDefined || keyword.source === "user") return "user_keyword";
  if (keyword.source === "github_readme" || keyword.source === "github_topic") return "github_keyword";
  if (keyword.source === "provider_profile") return "provider_generated";
  return "site_keyword";
}

function competitorNames(competitors: Entity[], limit = 3): string {
  return competitors.slice(0, limit).map((competitor) => competitor.name).join(", ");
}

function englishTemplates(input: { keyword: KeywordCandidate; target: Entity; competitors: Entity[] }): KeywordPromptTemplate[] {
  const keyword = input.keyword.phrase;
  const competitors = competitorNames(input.competitors);
  return [
    {
      intent: "category",
      type: "keyword_category",
      text: `Which products or projects are known for ${keyword}?`,
      targetIncluded: false,
    },
    {
      intent: "recommendation",
      type: "keyword_recommendation",
      text: `What are the best tools, platforms, or open-source projects for ${keyword}?`,
      targetIncluded: false,
    },
    {
      intent: "comparison",
      type: "keyword_comparison",
      text: competitors
        ? `Compare the leading options for ${keyword}, including ${competitors} if relevant.`
        : `Compare the leading options for ${keyword}.`,
      targetIncluded: false,
    },
    {
      intent: "source",
      type: "keyword_source",
      text: `Which authoritative sources or official pages explain ${keyword}?`,
      targetIncluded: false,
    },
    {
      intent: "scenario",
      type: "keyword_scenario",
      text: `How should someone choose a solution for ${keyword}?`,
      targetIncluded: false,
    },
    {
      intent: "alternative",
      type: "keyword_alternative",
      text: `What are the best alternatives to ${input.target.name} for ${keyword}?`,
      targetIncluded: true,
    },
  ];
}

function chineseTemplates(input: { keyword: KeywordCandidate; target: Entity; competitors: Entity[] }): KeywordPromptTemplate[] {
  const keyword = input.keyword.phrase;
  const competitors = competitorNames(input.competitors);
  return [
    {
      intent: "category",
      type: "keyword_category",
      text: `哪些产品、平台或开源项目和「${keyword}」最相关？`,
      targetIncluded: false,
    },
    {
      intent: "recommendation",
      type: "keyword_recommendation",
      text: `如果要解决「${keyword}」这个需求，有哪些值得考虑的工具、平台或开源项目？`,
      targetIncluded: false,
    },
    {
      intent: "comparison",
      type: "keyword_comparison",
      text: competitors
        ? `围绕「${keyword}」对比主要方案，如果相关请包括 ${competitors}。`
        : `围绕「${keyword}」对比主要方案。`,
      targetIncluded: false,
    },
    {
      intent: "source",
      type: "keyword_source",
      text: `哪些权威来源、官方页面或文档解释了「${keyword}」？`,
      targetIncluded: false,
    },
    {
      intent: "scenario",
      type: "keyword_scenario",
      text: `用户应该如何选择一个适合「${keyword}」的解决方案？`,
      targetIncluded: false,
    },
    {
      intent: "alternative",
      type: "keyword_alternative",
      text: `${input.target.name} 在「${keyword}」这个需求下有哪些替代品？`,
      targetIncluded: true,
    },
  ];
}

function templatesForLanguage(input: { keyword: KeywordCandidate; target: Entity; competitors: Entity[]; language: string }): KeywordPromptTemplate[] {
  return input.language.toLowerCase().startsWith("zh") ? chineseTemplates(input) : englishTemplates(input);
}

export class KeywordPromptPlanner {
  build(input: {
    target: Entity;
    competitors: Entity[];
    keywords: KeywordCandidate[];
    language: string;
    promptsPerKeyword: number;
  }): MonitoringPrompt[] {
    const promptsPerKeyword = Math.max(1, Math.min(input.promptsPerKeyword, 6));
    const prompts: MonitoringPrompt[] = [];
    const seen = new Set<string>();

    for (const keyword of input.keywords.filter((item) => item.enabled)) {
      const templates = templatesForLanguage({ keyword, target: input.target, competitors: input.competitors, language: input.language });
      const selected = templates.slice(0, promptsPerKeyword);
      for (const template of selected) {
        const text = template.text.replace(/\s+/g, " ").trim();
        const key = `${keyword.id}:${text.toLowerCase()}`;
        if (!text || seen.has(key)) continue;
        seen.add(key);
        const id = `${template.type}-${slugify(keyword.id)}-${prompts.length + 1}`;
        prompts.push(
          withAuditCategory({
            id,
            type: template.type,
            topic: keyword.phrase,
            language: input.language,
            text,
            enabled: true,
            targetIncluded: template.targetIncluded || promptContainsTarget(text, input.target),
            keywordIds: [keyword.id],
            keywordClusterId: `cluster-${keyword.id}`,
            keywordIntent: template.intent,
            seedSource: seedSource(keyword),
          }),
        );
      }
    }

    return prompts;
  }
}

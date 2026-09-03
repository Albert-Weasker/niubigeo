import type { DomainProfile, Entity, MonitoringPrompt, PromptType } from "../core/types.js";
import { slugify } from "../utils/domain.js";
import { promptContainsTarget } from "./prompt-generator.js";
import { withAuditCategory } from "./audit-category.js";

interface PromptTemplate {
  type: PromptType;
  topic: string;
  text: string;
}

function cleanCategory(profile: DomainProfile): string {
  const category = profile.category.trim();
  if (category && category.toLowerCase() !== "unknown") return category;
  return "products or services in this category";
}

function entityNames(competitors: Entity[], limit = 3): string {
  return competitors.slice(0, limit).map((competitor) => competitor.name).join(", ");
}

function englishTemplates(input: { target: Entity; competitors: Entity[]; profile: DomainProfile }): PromptTemplate[] {
  const category = cleanCategory(input.profile);
  const competitorNames = entityNames(input.competitors);
  const comparison = competitorNames
    ? `Compare ${input.target.name} with ${competitorNames} for ${category}.`
    : `What are the best alternatives to ${input.target.name} for ${category}?`;

  return [
    {
      type: "brand",
      topic: "brand understanding",
      text: `What is ${input.target.name}, and what problem does it solve?`,
    },
    {
      type: "category",
      topic: category,
      text: `What are the best ${category} tools or platforms?`,
    },
    {
      type: "recommendation",
      topic: category,
      text: `Which ${category} products should I consider, and why?`,
    },
    {
      type: "comparison",
      topic: "competitive comparison",
      text: comparison,
    },
    {
      type: "alternative",
      topic: "alternatives",
      text: `What are the best alternatives to ${input.target.name}?`,
    },
    {
      type: "scenario",
      topic: category,
      text: `How should someone choose a ${category} solution?`,
    },
    {
      type: "category",
      topic: "trusted sources",
      text: `Which authoritative sources or pages explain ${category}?`,
    },
    {
      type: "recommendation",
      topic: "buying criteria",
      text: `What criteria matter most when evaluating ${category} providers?`,
    },
  ];
}

function chineseTemplates(input: { target: Entity; competitors: Entity[]; profile: DomainProfile }): PromptTemplate[] {
  const category = cleanCategory(input.profile);
  const competitorNames = entityNames(input.competitors);
  const comparison = competitorNames
    ? `对比 ${input.target.name} 和 ${competitorNames} 在 ${category} 领域的差异。`
    : `${input.target.name} 在 ${category} 领域有哪些替代品？`;

  return [
    {
      type: "brand",
      topic: "品牌理解",
      text: `${input.target.name} 是什么？解决什么问题？`,
    },
    {
      type: "category",
      topic: category,
      text: `${category} 领域有哪些值得关注的工具或平台？`,
    },
    {
      type: "recommendation",
      topic: category,
      text: `如果要选择 ${category} 产品，应该考虑哪些方案？`,
    },
    {
      type: "comparison",
      topic: "竞品对比",
      text: comparison,
    },
    {
      type: "alternative",
      topic: "替代品",
      text: `${input.target.name} 有哪些替代品？`,
    },
    {
      type: "scenario",
      topic: category,
      text: `用户应该如何选择一个合适的 ${category} 解决方案？`,
    },
    {
      type: "category",
      topic: "可信来源",
      text: `哪些权威来源或页面介绍了 ${category}？`,
    },
    {
      type: "recommendation",
      topic: "评估标准",
      text: `评估 ${category} 服务商时，最重要的标准是什么？`,
    },
  ];
}

function templatesForLanguage(input: { target: Entity; competitors: Entity[]; profile: DomainProfile; language: string }): PromptTemplate[] {
  return input.language.toLowerCase().startsWith("zh") ? chineseTemplates(input) : englishTemplates(input);
}

function normalizedPromptRows(input: {
  target: Entity;
  competitors: Entity[];
  profile: DomainProfile;
  language: string;
}): PromptTemplate[] {
  const templateRows = templatesForLanguage(input);
  const generatedRows = input.profile.promptSuggestions.map((suggestion) => ({
    type: suggestion.type,
    topic: suggestion.topic,
    text: suggestion.prompt,
  }));
  const seen = new Set<string>();
  const rows: PromptTemplate[] = [];

  for (const row of [...templateRows, ...generatedRows]) {
    const text = row.text.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    rows.push({ ...row, text });
  }

  return rows;
}

export class DomainPromptPlanner {
  build(input: { target: Entity; competitors: Entity[]; profile: DomainProfile; language: string; count: number }): MonitoringPrompt[] {
    const rows = normalizedPromptRows(input);
    const selected: PromptTemplate[] = [];
    const unbrandedNeeded = Math.floor(input.count / 2);

    for (const row of rows) {
      if (selected.length >= unbrandedNeeded) break;
      if (!promptContainsTarget(row.text, input.target)) selected.push(row);
    }

    for (const row of rows) {
      if (selected.length >= input.count) break;
      if (selected.some((item) => item.text.toLowerCase() === row.text.toLowerCase())) continue;
      selected.push(row);
    }

    return selected.slice(0, input.count).map((row, index) =>
      withAuditCategory({
        id: `${row.type}-${slugify(input.target.id)}-${index + 1}`,
        type: row.type,
        topic: row.topic,
        language: input.language,
        text: row.text,
        enabled: true,
        targetIncluded: promptContainsTarget(row.text, input.target),
      }),
    );
  }
}

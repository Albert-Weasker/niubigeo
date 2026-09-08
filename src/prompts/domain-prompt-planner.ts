import type { DomainProfile, Entity, MonitoringPrompt, PromptType } from "../core/types.js";
import { slugify } from "../utils/domain.js";
import { compactWhitespace } from "../utils/text.js";
import { withAuditCategory } from "./audit-category.js";

const PROMPT_TYPES: PromptType[] = [
  "brand",
  "category",
  "recommendation",
  "comparison",
  "alternative",
  "scenario",
  "keyword_category",
  "keyword_recommendation",
  "keyword_comparison",
  "keyword_alternative",
  "keyword_scenario",
  "keyword_source",
];

export class DomainPromptPlanner {
  build(input: { target: Entity; competitors: Entity[]; profile: DomainProfile; language: string; count: number }): MonitoringPrompt[] {
    const seen = new Set<string>();
    const rows: MonitoringPrompt[] = [];
    for (const suggestion of input.profile.promptSuggestions) {
      if (!PROMPT_TYPES.includes(suggestion.type)) continue;
      const text = compactWhitespace(suggestion.prompt);
      const key = text.toLocaleLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      rows.push(
        withAuditCategory({
          id: `${suggestion.type}-${slugify(input.target.id)}-${rows.length + 1}`,
          type: suggestion.type,
          topic: compactWhitespace(suggestion.topic) || suggestion.type,
          language: input.language,
          text,
          enabled: true,
          auditCategory: suggestion.auditCategory,
          targetIncluded: suggestion.targetIncluded,
        }),
      );
      if (rows.length >= input.count) break;
    }
    return rows;
  }
}

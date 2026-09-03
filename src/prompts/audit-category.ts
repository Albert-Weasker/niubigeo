import type { MonitoringPrompt, PromptAuditCategory, PromptType } from "../core/types.js";

const COMPARISON_TYPES = new Set<PromptType>(["comparison", "alternative", "keyword_comparison", "keyword_alternative"]);

export function inferPromptAuditCategory(prompt: Pick<MonitoringPrompt, "auditCategory" | "targetIncluded" | "type">): PromptAuditCategory {
  if (prompt.auditCategory) return prompt.auditCategory;
  if (COMPARISON_TYPES.has(prompt.type)) return "comparison";
  if (prompt.type === "brand") return "brand_awareness";
  if (prompt.targetIncluded === false) return "organic_discovery";
  return "brand_awareness";
}

export function promptAuditCategoryLabel(category: PromptAuditCategory): string {
  if (category === "brand_awareness") return "Brand awareness";
  if (category === "organic_discovery") return "Organic discovery";
  if (category === "comparison") return "Comparison";
  return "Other";
}

export function withAuditCategory(prompt: MonitoringPrompt): MonitoringPrompt {
  return {
    ...prompt,
    auditCategory: inferPromptAuditCategory(prompt),
  };
}

import type { MonitoringPrompt, PromptAuditCategory } from "../core/types.js";

export function inferPromptAuditCategory(prompt: Pick<MonitoringPrompt, "auditCategory" | "targetIncluded" | "type">): PromptAuditCategory {
  return prompt.auditCategory || "other";
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

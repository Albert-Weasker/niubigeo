import type { AuditMetrics, AuditRun, GeoGapAnalysis } from "../core/types.js";

export interface ReportQualityResult {
  ok: boolean;
  errors: string[];
}

function isZhAudit(audit: AuditRun): boolean {
  return audit.prompts.some((prompt) => prompt.language.toLowerCase().startsWith("zh"));
}

function requiredSections(audit: AuditRun): string[] {
  if (isZhAudit(audit)) {
    return [
      "## 总结",
      "## AI怎么看你",
      "## 谁在和你竞争",
      "## 竞争差异",
      "## 来源",
    ];
  }
  return [
    "## Summary",
    "## How AI Sees You",
    "## Who Competes With You",
    "## Competitive Differences",
    "## Sources",
  ];
}

function forbiddenTerms(): string[] {
  return [
    "Mention Rate",
    "Citation Rate",
    "Recommendation Rate",
    "Share of Voice",
    "SOV",
    "Average Rank",
    "Prompt Wins",
    "Token Usage",
    "API Cost",
    "Cost:",
    "Latency",
    "Prompt ID",
    "Run ID",
    "Raw JSON",
    "Provider Annotation",
    "Citation Slice",
    "Prompt Matrix",
    "Metric Formulas",
    "Scorecard",
    "Technical Evidence",
    "技术证据",
    "原始 JSON",
    "原始证据",
    "指标总览",
    "声量占比",
    "提及率",
    "引用率",
    "推荐率",
    "谁比你做得好",
    "你比竞争对手做得好",
  ];
}

function cjkCount(value: string): number {
  let count = 0;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if ((code >= 0x3400 && code <= 0x9fff) || (code >= 0xf900 && code <= 0xfaff)) count += 1;
  }
  return count;
}

function firstParagraphAfter(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  if (start < 0) return "";
  const rest = markdown.slice(start + heading.length);
  const lines = rest.split("\n");
  for (const line of lines) {
    const text = line.trim();
    if (!text || text.startsWith("|") || text.startsWith("---")) continue;
    return text;
  }
  return "";
}

function removeDetailsBlocks(markdown: string): string {
  let output = "";
  let cursor = 0;
  while (cursor < markdown.length) {
    const open = markdown.indexOf("<details>", cursor);
    if (open < 0) {
      output += markdown.slice(cursor);
      break;
    }
    output += markdown.slice(cursor, open);
    const close = markdown.indexOf("</details>", open);
    if (close < 0) break;
    cursor = close + "</details>".length;
  }
  return output;
}

export function validateReport(markdown: string, audit: AuditRun, metrics: AuditMetrics, gaps?: GeoGapAnalysis): ReportQualityResult {
  void gaps;
  const errors: string[] = [];
  for (const section of requiredSections(audit)) {
    if (!markdown.includes(section)) errors.push(`Missing user-facing report section: ${section}`);
  }
  const lower = markdown.toLowerCase();
  if (lower.includes("mock")) {
    errors.push("Report contains forbidden mock wording.");
  }
  const answerMarker = isZhAudit(audit) ? "<summary>查看AI实际回答</summary>" : "<summary>View Actual AI Answers</summary>";
  const answerIndex = markdown.indexOf(answerMarker);
  const mainSurface = answerIndex >= 0 ? markdown.slice(0, answerIndex) : markdown;
  const visibleMainSurface = removeDetailsBlocks(mainSurface);
  for (const term of forbiddenTerms()) {
    if (visibleMainSurface.includes(term)) errors.push(`Report contains forbidden technical report term: ${term}`);
  }
  if (isZhAudit(audit)) {
    const headline = firstParagraphAfter(markdown, "## 总结");
    if (cjkCount(headline) > 80) errors.push("Chinese headline exceeds 80 CJK characters.");
    if (cjkCount(visibleMainSurface) > 800) errors.push("Chinese main report exceeds 800 CJK characters before the answer drawer.");
  }
  const hasAnswerEvidence = isZhAudit(audit) ? markdown.includes("AI实际回答") : markdown.includes("Actual AI answer");
  if (!hasAnswerEvidence) {
    errors.push("Report lacks actual AI answers.");
  }
  const hasSourceCaveat = isZhAudit(audit)
    ? markdown.includes("本报告来自你选择的 AI API 和模型")
    : markdown.includes("This report comes from the selected AI APIs and models");
  if (!hasSourceCaveat) {
    errors.push("Report lacks API-source caveat.");
  }
  if (metrics.validResponses === 0) {
    errors.push("Report has no completed provider responses.");
  }
  return { ok: errors.length === 0, errors };
}

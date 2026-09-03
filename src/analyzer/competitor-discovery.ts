import type { AnswerProvider, DiscoveredCompetitor, Entity, PromptRun } from "../core/types.js";
import { normalizeDomain } from "../utils/domain.js";

interface CompetitorDiscoveryInput {
  target: Entity;
  existingCompetitors: Entity[];
  runs: PromptRun[];
  language: string;
  provider: AnswerProvider;
  model: string;
  apiKey: string;
}

interface CompetitorRow {
  name: string;
  domain: string;
  reason: string;
  relationship: DiscoveredCompetitor["relationship"];
  confidence: number;
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

function parseJsonArray(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("Competitor discovery did not return a JSON array.");
}

function textFromRow(value: unknown, key: string): string {
  if (!value || typeof value !== "object") return "";
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "string" ? compactSpaces(raw) : "";
}

function numberFromRow(value: unknown, key: string): number {
  if (!value || typeof value !== "object") return 0;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function relationshipFromRow(value: unknown): DiscoveredCompetitor["relationship"] {
  const raw = textFromRow(value, "relationship");
  if (raw === "direct_competitor" || raw === "adjacent" || raw === "category" || raw === "infrastructure" || raw === "unknown") return raw;
  return "unknown";
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

function completedRuns(runs: PromptRun[]): PromptRun[] {
  return runs.filter((run) => run.status === "completed" && Boolean(run.result));
}

function evidenceBlock(runs: PromptRun[]): string {
  return completedRuns(runs)
    .slice(0, 30)
    .map((run, index) => {
      const citations = (run.analysis?.citations || run.result?.citations || [])
        .slice(0, 12)
        .map((citation) => `${citation.title || citation.domain || citation.url} | ${citationDomain(citation.url)} | ${citation.url}`)
        .join("\n");
      return [
        `Answer ${index + 1}`,
        `Question: ${run.prompt.text}`,
        `Answer text: ${compactSpaces(run.result?.text || "").slice(0, 1800)}`,
        citations ? `Citations:\n${citations}` : "Citations: none",
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function discoveryPrompt(input: CompetitorDiscoveryInput): string {
  const languageInstruction =
    input.language.toLowerCase().startsWith("zh")
      ? "请用简体中文填写 reason。"
      : "Write reason in English.";
  const existing = input.existingCompetitors.length
    ? input.existingCompetitors.map((competitor) => `${competitor.name} (${competitor.domain})`).join(", ")
    : "none";
  return [
    "Extract true competitors for the target brand using only the AI answers and citation URLs below.",
    "Return only a JSON array. No markdown, no prose.",
    "Each item must be: {\"name\":\"...\",\"domain\":\"...\",\"reason\":\"...\",\"relationship\":\"direct_competitor|adjacent|category|infrastructure|unknown\",\"confidence\":0.0}.",
    "Rules:",
    "- Include only brands, products, or services that compete for the same buyer or user need as the target.",
    "- Prefer competitors with a real domain shown in citations or clearly named in the answers.",
    "- Do not include the target brand or target domain.",
    "- Do not include generic categories, blogs, media sites, documentation sites, marketplaces, or infrastructure unless they sell the same product.",
    "- If evidence is weak, return an empty array.",
    "- Return at most 5 items.",
    languageInstruction,
    "",
    `Target: ${input.target.name} (${input.target.domain})`,
    `Existing competitors: ${existing}`,
    "",
    "Evidence:",
    evidenceBlock(input.runs),
  ].join("\n");
}

function parseRows(text: string, target: Entity): CompetitorRow[] {
  const parsed = parseJsonArray(text);
  if (!Array.isArray(parsed)) return [];
  const targetDomain = normalizeDomain(target.domain);
  const rows: CompetitorRow[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const name = textFromRow(item, "name");
    const domain = normalizeDomain(textFromRow(item, "domain"));
    const reason = textFromRow(item, "reason");
    const confidence = numberFromRow(item, "confidence");
    if (!name || !domain || !reason) continue;
    if (domain === targetDomain || name.toLowerCase() === target.name.toLowerCase()) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    rows.push({
      name,
      domain,
      reason,
      relationship: relationshipFromRow(item),
      confidence: Math.max(0, Math.min(1, confidence)),
    });
  }
  return rows;
}

export class CompetitorDiscovery {
  async discover(input: CompetitorDiscoveryInput): Promise<DiscoveredCompetitor[]> {
    if (completedRuns(input.runs).length === 0) return [];
    const result = await input.provider.run({
      prompt: discoveryPrompt(input),
      model: input.model,
      apiKey: input.apiKey,
      maxTokens: 900,
      temperature: 0,
      webSearchEnabled: false,
    });
    return parseRows(result.text, input.target).map((row) => ({
      name: row.name,
      domain: row.domain,
      reason: row.reason,
      relationship: row.relationship,
      confidence: row.confidence,
    }));
  }
}

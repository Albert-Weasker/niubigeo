import {
  BRAND_QUESTION_INTENTS,
  type BrandQuestionClassification,
  type BrandQuestionIntent,
  type BrandQuestionIntentCheck,
  type Entity,
} from "../core/types.js";
import { normalizeDomain } from "../utils/domain.js";
import { compactWhitespace } from "../utils/text.js";

export class BrandQuestionScopeError extends Error {
  readonly code = "brand_question_scope_rejected";

  constructor(message: string) {
    super(message);
    this.name = "BrandQuestionScopeError";
  }
}

function comparable(value: string): string {
  return compactWhitespace(value.normalize("NFKC")).toLocaleLowerCase();
}

function identityAnchors(target: Entity): string[] {
  const domain = normalizeDomain(target.domain);
  return [...new Set([target.name, domain, target.domain, ...target.aliases].map(comparable).filter(Boolean))];
}

export function questionContainsTargetIdentity(question: string, target: Entity): boolean {
  const normalizedQuestion = comparable(question);
  return identityAnchors(target).some((anchor) => normalizedQuestion.includes(anchor));
}

function scopeMessage(target: Entity, language: string): string {
  const chinese = language.trim().toLocaleLowerCase().split("-")[0] === "zh";
  return chinese
    ? `这个问题与 ${target.domain} 对应的品牌或产品没有明确关系。请修改问题后再运行。`
    : `This question is not clearly connected to the brand or product represented by ${target.domain}. Edit the question before running it.`;
}

export function assertQuestionsContainTargetIdentity(questions: string[], target: Entity, language: string): void {
  for (const question of questions) {
    if (!questionContainsTargetIdentity(question, target)) throw new BrandQuestionScopeError(scopeMessage(target, language));
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function intentList(value: unknown): BrandQuestionIntent[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(BRAND_QUESTION_INTENTS);
  return [...new Set(value.map((item) => String(item).trim()).filter((item): item is BrandQuestionIntent => allowed.has(item)))];
}

function intentChecks(value: unknown): BrandQuestionIntentCheck[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(BRAND_QUESTION_INTENTS);
  const seen = new Set<string>();
  const checks: BrandQuestionIntentCheck[] = [];
  for (const item of value) {
    const row = asObject(item);
    const intent = typeof row?.intent === "string" ? row.intent.trim() : "";
    if (!allowed.has(intent) || seen.has(intent) || typeof row?.requested !== "boolean") continue;
    seen.add(intent);
    const check: BrandQuestionIntentCheck = {
      intent: intent as BrandQuestionIntent,
      requested: row.requested,
    };
    if (typeof row.reason === "string" && compactWhitespace(row.reason)) check.reason = compactWhitespace(row.reason);
    checks.push(check);
  }
  return checks;
}

function mergedIntentChecks(row: Record<string, unknown> | null): BrandQuestionIntentCheck[] {
  const checks = new Map(intentChecks(row?.intentChecks).map((check) => [check.intent, check]));
  const decisions = asObject(row?.intentDecisions);
  for (const intent of BRAND_QUESTION_INTENTS) {
    const requested = decisions?.[intent];
    if (typeof requested !== "boolean") continue;
    const existing = checks.get(intent);
    checks.set(intent, existing ? { ...existing, requested } : { intent, requested });
  }
  return [...checks.values()];
}

export function parseStoredBrandQuestionClassification(value: unknown): BrandQuestionClassification | undefined {
  const row = asObject(value);
  const targetBrand = typeof row?.targetBrand === "string" ? compactWhitespace(row.targetBrand) : "";
  const checks = mergedIntentChecks(row);
  const checkedIntents = checks.filter((check) => check.requested).map((check) => check.intent);
  const intents = intentList([...(Array.isArray(row?.intents) ? row.intents : []), ...checkedIntents]);
  if (!row || row.domainMatched !== true || !targetBrand || intents.length === 0) return undefined;
  const reason = typeof row.reason === "string" ? compactWhitespace(row.reason) : "";
  const classification: BrandQuestionClassification = {
    domainMatched: true,
    targetBrand,
    intents,
    status: "complete",
  };
  if (checks.length > 0) classification.intentChecks = checks;
  if (reason) classification.reason = reason;
  return classification;
}

export function parseBrandQuestionClassifications(input: {
  value: unknown;
  questionCount: number;
  target: Entity;
  language: string;
}): BrandQuestionClassification[] {
  const root = asObject(input.value);
  const rows = Array.isArray(root?.questions) ? root.questions : Array.isArray(input.value) ? input.value : [];
  if (rows.length !== input.questionCount) {
    throw new Error(`Brand question classifier returned ${rows.length} result(s) for ${input.questionCount} question(s).`);
  }

  return rows.map((value) => {
    const row = asObject(value);
    const targetBrand = typeof row?.targetBrand === "string" ? compactWhitespace(row.targetBrand) : "";
    const checks = mergedIntentChecks(row);
    const checkedIntents = checks.filter((check) => check.requested).map((check) => check.intent);
    const intents = intentList([...(Array.isArray(row?.intents) ? row.intents : []), ...checkedIntents]);
    if (!row || typeof row.domainMatched !== "boolean" || !targetBrand || intents.length === 0) {
      throw new Error("Brand question classifier did not return domainMatched, targetBrand, and at least one supported intent.");
    }
    const reason = typeof row.reason === "string" ? compactWhitespace(row.reason) : "";
    if (!row.domainMatched) throw new BrandQuestionScopeError(reason || scopeMessage(input.target, input.language));
    return parseStoredBrandQuestionClassification({ domainMatched: true, targetBrand, intents, intentChecks: checks, reason }) as BrandQuestionClassification;
  });
}

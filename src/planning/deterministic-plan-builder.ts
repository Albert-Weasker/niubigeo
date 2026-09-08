import type {
  AuditPlan,
  BrandQuestionIntent,
  MonitoringPrompt,
  PromptAuditCategory,
  PromptType,
} from "../core/types.js";
import { ANALYSIS_RULES_VERSION, PROMPT_SET_VERSION } from "../core/version.js";
import { assertConfirmedQuestions } from "../admission/question-admission.js";
import { compactWhitespace } from "../utils/text.js";
import { sha256 } from "../utils/hash.js";
import type { ConfirmedAuditSpec, ConfirmedQuestion } from "./confirmed-audit-spec.js";

function uniqueIntents(values: BrandQuestionIntent[] | null | undefined): BrandQuestionIntent[] {
  return [...new Set(values || [])];
}

function monitoringPrompt(input: {
  question: ConfirmedQuestion;
  index: number;
  spec: ConfirmedAuditSpec;
}): MonitoringPrompt {
  const text = compactWhitespace(input.question.text);
  const declaredIntents = uniqueIntents(input.question.declaredIntents);
  const prompt: MonitoringPrompt = {
    id: input.question.id || `confirmed-${input.spec.target.id}-${input.index + 1}`,
    type: "brand" satisfies PromptType,
    topic: "confirmed-question",
    language: input.spec.language,
    text,
    enabled: input.question.enabled !== false,
    auditCategory: "other" satisfies PromptAuditCategory,
    targetIncluded: true,
  };
  if (declaredIntents.length > 0) {
    prompt.brandQuestion = {
      domainMatched: true,
      targetBrand: input.spec.target.name,
      intents: declaredIntents,
      status: "complete",
    };
  }
  return prompt;
}

function promptSetHash(input: {
  prompts: MonitoringPrompt[];
  spec: ConfirmedAuditSpec;
  runCountPerPrompt: number;
}): string {
  return sha256(JSON.stringify({
    target: {
      id: input.spec.target.id,
      name: input.spec.target.name,
      domain: input.spec.target.domain,
      aliases: [...input.spec.target.aliases].sort((left, right) => left.localeCompare(right)),
    },
    competitors: input.spec.competitors.map((entity) => ({ id: entity.id, name: entity.name, domain: entity.domain })),
    prompts: input.prompts.map((prompt) => ({
      id: prompt.id,
      text: prompt.text,
      language: prompt.language,
      enabled: prompt.enabled,
      declaredIntents: prompt.brandQuestion?.intents || [],
    })),
    providerTargets: input.spec.providerTargets.map((target) => ({
      providerId: target.providerId,
      model: target.model,
      webSearchEnabled: Boolean(target.webSearchEnabled),
      webSearchMode: target.webSearchEnabled ? "provider_native" : target.webSearchMode || "auto",
    })),
    runCountPerPrompt: input.runCountPerPrompt,
  })).slice(0, 12);
}

export class DeterministicPlanBuilder {
  build(spec: ConfirmedAuditSpec, options: { planId?: string | undefined; plannedAt?: string | undefined } = {}): AuditPlan {
    if (spec.providerTargets.length === 0) throw new Error("provider_target_required");
    if (spec.questions.length === 0) throw new Error("confirmed_question_required");
    assertConfirmedQuestions({
      questions: spec.questions.map((question) => question.text),
      target: spec.target,
      scopeConfirmed: spec.scopeConfirmed,
    });
    const prompts = spec.questions.map((question, index) => monitoringPrompt({ question, index, spec }));
    const runCountPerPrompt = spec.runCountPerQuestion || 1;
    if (!Number.isInteger(runCountPerPrompt) || runCountPerPrompt <= 0) throw new Error("invalid_run_count");
    const hash = promptSetHash({ prompts, spec, runCountPerPrompt });
    const plannedAt = options.plannedAt || new Date().toISOString();
    const enabledPromptCount = prompts.filter((prompt) => prompt.enabled).length;
    return {
      id: options.planId || `plan-${hash}`,
      submittedDomain: spec.target.domain,
      target: structuredClone(spec.target),
      competitors: structuredClone(spec.competitors),
      prompts,
      providerTargets: structuredClone(spec.providerTargets),
      language: spec.language,
      autoDiscover: false,
      promptSetId: `${PROMPT_SET_VERSION}-${hash}`,
      promptSetHash: hash,
      promptSetVersion: PROMPT_SET_VERSION,
      analysisRulesVersion: ANALYSIS_RULES_VERSION,
      runCountPerPrompt,
      plannedAt,
      estimate: {
        enabledPromptCount,
        disabledPromptCount: prompts.length - enabledPromptCount,
        providerTargetCount: spec.providerTargets.length,
        providerRunCount: enabledPromptCount * spec.providerTargets.length * runCountPerPrompt,
      },
    };
  }
}


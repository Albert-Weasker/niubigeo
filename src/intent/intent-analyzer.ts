import { INTENT_NAMES, TARGET_BRAND_ROLES, UNCERTAINTY_LEVELS } from "./intent-schema.js";

function list(values: readonly string[]): string {
  return values.join(" | ");
}

export function intentAnalyzerInstructions(): string {
  return [
    "Intent Analyzer",
    "Decide which supported brand-question outcomes the user is requesting.",
    "A question may have one primary intent and multiple secondary intents.",
    "Do not infer business relationships from name co-occurrence.",
    "Use only the user's question, target brand, validated brand-question classification, and language context.",
    "",
    "Return JSON fields:",
    `primaryIntent: ${list(INTENT_NAMES)}`,
    "secondaryIntents: array of intent names",
    "requestedOutputs: short user-facing requirements explicitly requested by the question",
    `targetBrandRole: ${list(TARGET_BRAND_ROLES)}`,
    "requiresSources: boolean",
    "requiresComparison: boolean",
    "requiresRecommendation: boolean",
    "candidateApplicable: boolean indicating whether the target can be included in a set of options in this question",
    "recommendationApplicable: boolean indicating whether the question asks for a recommendation or choice involving the target",
    `uncertainty: ${list(UNCERTAINTY_LEVELS)}`,
  ].join("\n");
}

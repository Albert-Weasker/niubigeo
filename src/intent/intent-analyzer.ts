import { INTENT_NAMES, TARGET_BRAND_ROLES, UNCERTAINTY_LEVELS } from "./intent-schema.js";

function list(values: readonly string[]): string {
  return values.join(" | ");
}

export function intentAnalyzerInstructions(): string {
  return [
    "Intent Analyzer",
    "Decide what the user is trying to get from the question.",
    "A question may have one primary intent and multiple secondary intents.",
    "Do not infer business relationships from name co-occurrence.",
    "Use only the user's question, target brand, and language context.",
    "",
    "Return JSON fields:",
    `primaryIntent: ${list(INTENT_NAMES)}`,
    "secondaryIntents: array of intent names",
    "requestedOutputs: short user-facing requirements explicitly requested by the question",
    `targetBrandRole: ${list(TARGET_BRAND_ROLES)}`,
    "requiresSources: boolean",
    "requiresComparison: boolean",
    "requiresRecommendation: boolean",
    `uncertainty: ${list(UNCERTAINTY_LEVELS)}`,
  ].join("\n");
}

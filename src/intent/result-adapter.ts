import { DISPLAY_MODES, INTENT_NAMES } from "./intent-schema.js";

function list(values: readonly string[]): string {
  return values.join(" | ");
}

export function resultAdapterInstructions(): string {
  return [
    "Result Adapter",
    "Create a short user-facing result for this single question.",
    "Choose the display mode from the detected intent.",
    "Do not force competitor fields onto questions that are not comparison, alternative, recommendation, or industry research tasks.",
    "Do not copy long answer passages into the report body.",
    "If the answer misses a requirement, say what is missing.",
    "If a relationship or conclusion is uncertain, say it is uncertain instead of guessing.",
    "",
    `Intent names: ${list(INTENT_NAMES)}`,
    `Display modes: ${list(DISPLAY_MODES)}`,
    "",
    "Return adaptedResult with:",
    "displayMode: one display mode",
    "oneSentence: one plain-language conclusion about what the answer did",
    "userQuestion: the original user question",
    "answered: up to six concise points the answer satisfied",
    "missing: up to six concise points the answer missed",
    "uncertain: up to six points that cannot be determined",
    "entityInsights: concise relationship notes for important entities only",
  ].join("\n");
}

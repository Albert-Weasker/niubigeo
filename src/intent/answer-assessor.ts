import { ANSWER_QUALITY, TASK_STATUSES } from "./intent-schema.js";

function list(values: readonly string[]): string {
  return values.join(" | ");
}

export function answerAssessorInstructions(): string {
  return [
    "Answer Assessor",
    "Assess whether the actual AI answer satisfies each task.",
    "Use only the actual AI answer and provider citations supplied in this prompt.",
    "For completed or partial tasks, evidenceQuote must be an exact substring copied from the actual AI answer.",
    "Do not use a source URL unless it appears in the supplied provider citations.",
    "If evidence is weak, mark the task missing or unknown.",
    "",
    "Return answerAssessment with:",
    `taskResults[].status: ${list(TASK_STATUSES)}`,
    "taskResults[].evidenceQuote: exact answer substring when status is completed or partial",
    "taskResults[].explanation: one plain-language sentence",
    "taskResults[].sourceUrls: URLs from provider citations only",
    `overallAnswerQuality: ${list(ANSWER_QUALITY)}`,
    "missingRequirements: requirements the answer did not satisfy",
  ].join("\n");
}

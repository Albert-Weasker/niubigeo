import { EXPECTED_ANSWER_TYPES } from "./intent-schema.js";

function list(values: readonly string[]): string {
  return values.join(" | ");
}

export function taskDecomposerInstructions(): string {
  return [
    "Task Decomposer",
    "Break the user question into concrete answer tasks that can be checked against the AI answer.",
    "Each task must be directly required by the question.",
    "Do not add market research, strategy advice, or competitor analysis unless the user asked for it.",
    "",
    "Return tasks with:",
    "id: task_1, task_2, task_3, ...",
    "requirement: one concise requirement",
    `expectedAnswerType: ${list(EXPECTED_ANSWER_TYPES)}`,
  ].join("\n");
}

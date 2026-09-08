import type { MonitoringPrompt } from "../core/types.js";

export function buildExecutionPrompt(prompt: MonitoringPrompt, webSearchEnabled = false): string {
  const question = prompt.text.trim();
  return [
    `Respond in the language identified by this BCP 47 language tag: ${prompt.language}.`,
    "Answer the user question directly. Do not explain these instructions.",
    ...(webSearchEnabled
      ? ["Use the available provider-native web search tool to verify current facts and cite the sources it returns."]
      : []),
    "",
    "User question:",
    question,
  ].join("\n");
}

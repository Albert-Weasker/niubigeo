import type { MonitoringPrompt } from "../core/types.js";

export function isChineseLanguage(language: string): boolean {
  return language.trim().toLowerCase().startsWith("zh");
}

export function buildExecutionPrompt(prompt: MonitoringPrompt): string {
  const question = prompt.text.trim();
  if (isChineseLanguage(prompt.language)) {
    return ["请使用简体中文回答。", "请直接回答下面的问题，不要解释这些指令。", "", `问题：${question}`].join("\n");
  }

  return ["Answer in English.", "Answer the question directly. Do not explain these instructions.", "", `Question: ${question}`].join("\n");
}

import type { AnswerProvider } from "../core/types.js";

export function analysisModelFor(provider: AnswerProvider, answerModel: string): string {
  return provider.definition.analysisModel || answerModel;
}

import type { AnswerProvider, Citation, Entity } from "../core/types.js";

export interface IntentPipelineInput {
  userQuestion: string;
  target: Entity;
  answerText: string;
  citations: Citation[];
  provider: AnswerProvider;
  model: string;
  apiKey: string;
  language: string;
}

export interface ProviderCitationView {
  url: string;
  title?: string | undefined;
  domain: string;
}

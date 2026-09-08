import type { AnswerProvider, BrandQuestionClassification, Citation, Entity, PromptIntentProfile } from "../core/types.js";
import type { ProviderCallContext, ProviderCallLedger } from "../telemetry/provider-call-ledger.js";

export interface IntentPipelineInput {
  userQuestion: string;
  target: Entity;
  answerText: string;
  citations: Citation[];
  provider: AnswerProvider;
  model: string;
  apiKey: string;
  language: string;
  questionClassification?: BrandQuestionClassification | undefined;
  questionIntent?: PromptIntentProfile | undefined;
  callLedger?: ProviderCallLedger | undefined;
  callContext?: Omit<ProviderCallContext, "purpose"> | undefined;
}

export interface ProviderCitationView {
  url: string;
  title?: string | undefined;
  domain: string;
}

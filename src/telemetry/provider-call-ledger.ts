import { randomUUID } from "node:crypto";
import type { AnswerResult } from "../core/types.js";
import type { ProviderFailureCode } from "../providers/provider-error.js";

export type ProviderCallPurpose =
  | "site_preparation"
  | "prompt_generation"
  | "question_classification"
  | "audit_answer"
  | "answer_analysis"
  | "report_analysis"
  | "structured_repair";

export interface ProviderCallContext {
  purpose: ProviderCallPurpose;
  projectId?: string | undefined;
  runId?: string | undefined;
  observationId?: string | undefined;
}

export interface ProviderCallRecord {
  id: string;
  callId: string;
  attempt: number;
  purpose: ProviderCallPurpose;
  projectId: string | null;
  runId: string | null;
  observationId: string | null;
  providerId: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  outcome: "completed" | "empty" | "failed";
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  failureCode: ProviderFailureCode | null;
}

export interface ProviderAttemptEvent {
  callId: string;
  attempt: number;
  context: ProviderCallContext;
  providerId: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  result?: AnswerResult | undefined;
  failureCode?: ProviderFailureCode | undefined;
}

export class ProviderCallLedger {
  private readonly records: ProviderCallRecord[] = [];

  createCallId(): string {
    return `provider-call-${randomUUID()}`;
  }

  record(event: ProviderAttemptEvent): void {
    const result = event.result;
    const failureCode = event.failureCode || null;
    this.records.push({
      id: `${event.callId}-attempt-${event.attempt}`,
      callId: event.callId,
      attempt: event.attempt,
      purpose: event.context.purpose,
      projectId: event.context.projectId || null,
      runId: event.context.runId || null,
      observationId: event.context.observationId || null,
      providerId: event.providerId,
      model: event.model,
      startedAt: event.startedAt,
      finishedAt: event.finishedAt,
      outcome: result ? "completed" : failureCode === "empty_answer" ? "empty" : "failed",
      inputTokens: result?.tokenUsage?.input ?? null,
      outputTokens: result?.tokenUsage?.output ?? null,
      costUsd: result?.costUsd ?? null,
      failureCode,
    });
  }

  snapshot(): ProviderCallRecord[] {
    return structuredClone(this.records);
  }
}


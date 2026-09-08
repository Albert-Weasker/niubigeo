import { randomUUID } from "node:crypto";
import type { AnswerProvider, AnswerResult, ProviderRunInput } from "../core/types.js";
import { providerFailureCode, type ProviderFailureCode } from "./provider-error.js";
import type { ProviderAttemptEvent, ProviderCallContext } from "../telemetry/provider-call-ledger.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attempts(): number {
  const configured = Number(process.env.PROVIDER_RUN_ATTEMPTS || 4);
  if (!Number.isFinite(configured) || configured <= 0) return 4;
  return Math.max(1, Math.min(Math.floor(configured), 8));
}

function baseDelayMs(): number {
  const configured = Number(process.env.PROVIDER_RETRY_BASE_MS || 1200);
  if (!Number.isFinite(configured) || configured <= 0) return 1200;
  return Math.max(250, Math.min(Math.floor(configured), 10000));
}

function emptyAnswerMaxTokens(): number {
  const configured = Number(process.env.PROVIDER_EMPTY_ANSWER_MAX_TOKENS || 4000);
  if (!Number.isFinite(configured) || configured <= 0) return 4000;
  return Math.max(1200, Math.min(Math.floor(configured), 16000));
}

export function isRetryableProviderError(error: unknown): boolean {
  const code = providerFailureCode(error);
  return code === "empty_answer" || code === "rate_limited" || code === "timeout" || code === "upstream_unavailable";
}

export interface ProviderRetryOptions {
  callId?: string | undefined;
  context?: ProviderCallContext | undefined;
  onAttempt?: ((event: ProviderAttemptEvent) => void | Promise<void>) | undefined;
}

export async function runProviderWithRetry(
  provider: AnswerProvider,
  input: ProviderRunInput,
  options: ProviderRetryOptions = {},
): Promise<AnswerResult> {
  let lastError: unknown;
  const totalAttempts = attempts();
  let maxTokens = input.maxTokens;
  const callId = options.callId || `provider-call-${randomUUID()}`;
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const startedAt = new Date().toISOString();
    try {
      const result = await provider.run({ ...input, maxTokens });
      if (options.context && options.onAttempt) {
        await options.onAttempt({
          callId,
          attempt,
          context: options.context,
          providerId: provider.definition.id,
          model: input.model,
          startedAt,
          finishedAt: new Date().toISOString(),
          result,
        });
      }
      return result;
    } catch (error) {
      lastError = error;
      const failureCode: ProviderFailureCode = providerFailureCode(error);
      if (options.context && options.onAttempt) {
        await options.onAttempt({
          callId,
          attempt,
          context: options.context,
          providerId: provider.definition.id,
          model: input.model,
          startedAt,
          finishedAt: new Date().toISOString(),
          failureCode,
        });
      }
      if (attempt === totalAttempts || !isRetryableProviderError(error)) break;
      if (failureCode === "empty_answer") maxTokens = Math.min(maxTokens * 2, emptyAnswerMaxTokens());
      await sleep(baseDelayMs() * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

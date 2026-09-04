import type { AnswerProvider, AnswerResult, ProviderRunInput } from "../core/types.js";

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

export function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const text = message.toLowerCase();
  if (text.includes("unauthorized")) return false;
  if (text.includes("forbidden")) return false;
  if (text.includes("invalid api key")) return false;
  if (text.includes("billing")) return false;
  if (text.includes("in-flight")) return true;
  if (text.includes("in flight")) return true;
  if (text.includes("rate limit")) return true;
  if (text.includes("try again")) return true;
  if (text.includes("retry after")) return true;
  if (text.includes("temporarily")) return true;
  if (text.includes("timeout")) return true;
  if (text.includes("overloaded")) return true;
  if (text.includes("http 429")) return true;
  if (text.includes("http 500")) return true;
  if (text.includes("http 502")) return true;
  if (text.includes("http 503")) return true;
  if (text.includes("http 504")) return true;
  return false;
}

export async function runProviderWithRetry(provider: AnswerProvider, input: ProviderRunInput): Promise<AnswerResult> {
  let lastError: unknown;
  const totalAttempts = attempts();
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      return await provider.run(input);
    } catch (error) {
      lastError = error;
      if (attempt === totalAttempts || !isRetryableProviderError(error)) break;
      await sleep(baseDelayMs() * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

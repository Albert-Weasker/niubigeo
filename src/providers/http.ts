import { ProviderRequestError } from "./provider-error.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { isRequestProviderScope, redactRequestSecrets } from "../config/env.js";

import { customConnection, customProviderFetch } from "./custom-connection.js";

const scopedAttempts = new AsyncLocalStorage<number>();

/** Bound retries for one paid operation without changing other concurrent callers. */
export function withProviderHttpAttempts<T>(attempts: number, operation: () => T): T {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 8) throw new Error("Invalid HTTP attempt limit");
  return scopedAttempts.run(attempts, operation);
}

export interface JsonResponse {
  status: number;
  ok: boolean;
  data: unknown;
  latencyMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestTimeoutMs(): number {
  const configured = Number(process.env.PROVIDER_TIMEOUT_MS || 45000);
  return Number.isFinite(configured) && configured > 0 ? configured : 45000;
}

function requestAttempts(): number {
  const scoped = scopedAttempts.getStore();
  if (scoped !== undefined) return scoped;
  const configured = Number(process.env.PROVIDER_HTTP_ATTEMPTS || 3);
  if (!Number.isInteger(configured) || configured < 1) return 3;
  return Math.min(configured, 8);
}

function isTransient(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export async function postJsonWithRetry(url: string, init: RequestInit, attempts = requestAttempts()): Promise<JsonResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs());
    try {
      const response = await (customConnection() && url.startsWith(customConnection()!.baseUrl + "/") ? customProviderFetch : fetch)(url, { ...init, ...(isRequestProviderScope() ? { redirect: "error" as const } : {}), signal: controller.signal });
      const data = redactRequestSecrets(await response.json().catch(() => {
        if (response.ok) throw new ProviderRequestError({ code: "invalid_response", message: "Provider returned a successful response that was not valid JSON.", status: response.status });
        return {};
      }));
      const latencyMs = Date.now() - started;
      if (response.ok || !isTransient(response.status) || attempt === attempts) {
        return { status: response.status, ok: response.ok, data, latencyMs };
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (error instanceof ProviderRequestError && error.code === "invalid_response") throw error;
      lastError = isRequestProviderScope() ? new Error(redactRequestSecrets(error instanceof Error ? error.message : String(error))) : error;
      if (attempt === attempts) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(500 * attempt);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

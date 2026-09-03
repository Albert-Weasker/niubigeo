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

function isTransient(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export async function postJsonWithRetry(url: string, init: RequestInit, attempts = 3): Promise<JsonResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs());
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      const latencyMs = Date.now() - started;
      if (response.ok || !isTransient(response.status) || attempt === attempts) {
        return { status: response.status, ok: response.ok, data, latencyMs };
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(500 * attempt);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

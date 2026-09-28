import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { splitLines, stripMatchingQuotes } from "../utils/text.js";

const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  openrouter: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  gemini: ["GEMINI_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  "openai-compatible": ["OPENAI_COMPATIBLE_API_KEY"],
};

const SECRET_FIELD_NAMES = new Set([
  "authorization", "apikey", "api_key", "api-key", "accesstoken", "access_token", "access-token",
  "secret", "openrouterkey", "openrouter_key", "openrouter-key",
]);

function isSecretFieldName(name: string): boolean {
  // Header/credential field names are ASCII; only their casing is insignificant.
  return [...name].every(character => character.charCodeAt(0) < 128) && SECRET_FIELD_NAMES.has(name.toLowerCase());
}

const requestProviderKeys = new AsyncLocalStorage<Readonly<Record<string, string | undefined>>>();

/** A web request may use only its own keys, including after an async job is queued. */
export function withRequestProviderKeys<T>(keys: Readonly<Record<string, string | undefined>>, work: () => T): T {
  return requestProviderKeys.run(Object.freeze({ ...keys }), work);
}

export function isRequestProviderScope(): boolean { return requestProviderKeys.getStore() !== undefined; }

/** Remove credentials before upstream payloads or errors can reach evidence storage. */
export function redactRequestSecrets<T>(value: T): T {
  const keys = Object.values(requestProviderKeys.getStore() || {}).filter((key): key is string => Boolean(key));
  if (!isRequestProviderScope()) return value;
  const visit = (input: unknown): unknown => {
    if (typeof input === "string") return keys.reduce((text, key) => text.split(key).join("[REDACTED]"), input);
    if (Array.isArray(input)) return input.map(visit);
    if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).map(([name, item]) => [name, isSecretFieldName(name) ? "[REDACTED]" : visit(item)]));
    return input;
  };
  return visit(value) as T;
}

export function loadDotEnv(cwd = process.cwd()): void {
  const envPath = join(cwd, ".env");
  if (!existsSync(envPath)) return;
  const lines = splitLines(readFileSync(envPath, "utf8"));
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = stripMatchingQuotes(rawValue);
    if (!process.env[key]) process.env[key] = value;
  }
}

export function providerEnvKeys(providerId: string): string[] {
  return PROVIDER_ENV_KEYS[providerId] || [];
}

export function openAICompatibleBaseUrl(): string | undefined {
  const value = process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_COMPATIBLE_BASEURL;
  return value?.trim() || undefined;
}

function envSecretValue(key: string): string | undefined {
  const direct = process.env[key];
  if (direct?.trim()) return direct.trim();
  const filePath = process.env[`${key}_FILE`];
  if (!filePath?.trim()) return undefined;
  try {
    const fromFile = readFileSync(filePath.trim(), "utf8").trim();
    return fromFile || undefined;
  } catch {
    return undefined;
  }
}

export function resolveProviderKey(providerId: string, explicitKey?: string): string {
  const scoped = requestProviderKeys.getStore();
  if (scoped) {
    const key = scoped[providerId]?.trim();
    if (key) return key;
    throw new Error("A user-supplied API key is required for this web request.");
  }
  if (explicitKey?.trim()) return explicitKey.trim();
  const keys = providerEnvKeys(providerId);
  for (const key of keys) {
    const value = envSecretValue(key);
    if (value) return value;
  }
  throw new Error(`Missing API key for provider "${providerId}". Expected one of: ${keys.join(", ") || "none"}`);
}

export function hasProviderKey(providerId: string): boolean {
  const scoped = requestProviderKeys.getStore();
  if (scoped) return Boolean(scoped[providerId]?.trim());
  if (providerId === "openai-compatible") {
    return Boolean(openAICompatibleBaseUrl()) && providerEnvKeys(providerId).some((key) => Boolean(envSecretValue(key)));
  }
  return providerEnvKeys(providerId).some((key) => Boolean(envSecretValue(key)));
}

export function runsDir(): string {
  return process.env.RUNS_DIR || "runs";
}

export function monitoringDataDir(): string {
  return process.env.MONITORING_DATA_DIR || "data";
}

/**
 * Product-v2 has a separate persistence boundary while the legacy monitoring
 * data remains available only for a later, explicit migration.
 */
export function productDataDir(): string {
  return process.env.PRODUCT_DATA_DIR || join(monitoringDataDir(), "product-v2");
}

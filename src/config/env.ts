import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  openrouter: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  gemini: ["GEMINI_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
};

export function loadDotEnv(cwd = process.cwd()): void {
  const envPath = join(cwd, ".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

export function providerEnvKeys(providerId: string): string[] {
  return PROVIDER_ENV_KEYS[providerId] || [];
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
  if (explicitKey?.trim()) return explicitKey.trim();
  const keys = providerEnvKeys(providerId);
  for (const key of keys) {
    const value = envSecretValue(key);
    if (value) return value;
  }
  throw new Error(`Missing API key for provider "${providerId}". Expected one of: ${keys.join(", ") || "none"}`);
}

export function hasProviderKey(providerId: string): boolean {
  return providerEnvKeys(providerId).some((key) => Boolean(envSecretValue(key)));
}

export function runsDir(): string {
  return process.env.RUNS_DIR || "runs";
}

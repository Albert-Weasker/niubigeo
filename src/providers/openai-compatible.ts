import type { AnswerProvider, AnswerResult, Citation, ProviderDefinition, ProviderRunInput, TokenUsage } from "../core/types.js";
import {
  dedupeCitations,
  extractAnnotationCitations,
  extractPerplexityCitations,
  extractTextUrlCitations,
} from "./citation-extractors.js";
import { postJsonWithRetry } from "./http.js";

interface OpenAICompatibleOptions {
  definition: ProviderDefinition;
  endpoint: string;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
  citationExtractor?: (raw: unknown) => Citation[];
  costExtractor?: (raw: unknown) => number | undefined;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractText(raw: unknown): string {
  const root = asObject(raw);
  const choices = Array.isArray(root?.choices) ? root.choices : [];
  const first = asObject(choices[0]);
  const message = asObject(first?.message);
  return typeof message?.content === "string" ? message.content.trim() : "";
}

function extractModelVersion(raw: unknown, fallback: string): string {
  const root = asObject(raw);
  return typeof root?.model === "string" ? root.model : fallback;
}

function normalizeUsage(raw: unknown): TokenUsage | undefined {
  const usage = asObject(asObject(raw)?.usage);
  if (!usage) return undefined;
  const input = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0;
  const output = typeof usage.completion_tokens === "number" ? usage.completion_tokens : 0;
  const total = typeof usage.total_tokens === "number" ? usage.total_tokens : input + output;
  return { input, output, total };
}

function defaultCostExtractor(raw: unknown): number | undefined {
  const usage = asObject(asObject(raw)?.usage);
  return typeof usage?.cost === "number" ? usage.cost : undefined;
}

export class OpenAICompatibleProvider implements AnswerProvider {
  readonly definition: ProviderDefinition;
  private readonly endpoint: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly extraBody: Record<string, unknown>;
  private readonly citationExtractor: (raw: unknown) => Citation[];
  private readonly costExtractor: (raw: unknown) => number | undefined;

  constructor(options: OpenAICompatibleOptions) {
    this.definition = options.definition;
    this.endpoint = options.endpoint;
    this.extraHeaders = options.extraHeaders || {};
    this.extraBody = options.extraBody || {};
    this.citationExtractor = options.citationExtractor || extractAnnotationCitations;
    this.costExtractor = options.costExtractor || defaultCostExtractor;
  }

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const response = await postJsonWithRetry(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        ...this.extraHeaders,
      },
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: "user", content: input.prompt }],
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        ...this.extraBody,
      }),
    });

    const raw = response.data;
    const error = asObject(asObject(raw)?.error);
    if (!response.ok || error) {
      const message = typeof error?.message === "string" ? error.message : `Provider ${this.definition.id} failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    const text = extractText(raw);
    if (!text) throw new Error(`Provider ${this.definition.id} returned an empty answer.`);
    const nativeCitations = this.citationExtractor(raw);
    const citations = dedupeCitations([...nativeCitations, ...extractTextUrlCitations(text, nativeCitations.length)]);

    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: this.definition.sourceType,
      sourceLabel: `Source: ${this.definition.label} API`,
      resultCaveat: this.definition.resultCaveat,
      model: input.model,
      modelVersion: extractModelVersion(raw, input.model),
      text,
      rawJson: raw,
      citations,
      webQueries: [],
      tokenUsage: normalizeUsage(raw),
      costUsd: this.costExtractor(raw),
      latencyMs: response.latencyMs,
      createdAt: new Date().toISOString(),
    };
  }
}

export function perplexityCitationExtractor(raw: unknown): Citation[] {
  return extractPerplexityCitations(raw);
}

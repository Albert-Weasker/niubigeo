import type { AnswerProvider, AnswerResult, Citation, ProviderDefinition, ProviderRunInput, TokenUsage } from "../core/types.js";
import { dedupeCitations, extractTextUrlCitations } from "./citation-extractors.js";
import { postJsonWithRetry } from "./http.js";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractText(raw: unknown): string {
  const content = Array.isArray(asObject(raw)?.content) ? asObject(raw)?.content as unknown[] : [];
  return content
    .map((part) => {
      const obj = asObject(part);
      return typeof obj?.text === "string" ? obj.text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeUsage(raw: unknown): TokenUsage | undefined {
  const usage = asObject(asObject(raw)?.usage);
  if (!usage) return undefined;
  const input = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
  const output = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
  return { input, output, total: input + output };
}

export class AnthropicProvider implements AnswerProvider {
  constructor(readonly definition: ProviderDefinition) {}

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const response = await postJsonWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        messages: [{ role: "user", content: input.prompt }],
      }),
    });

    const raw = response.data;
    const error = asObject(asObject(raw)?.error);
    if (!response.ok || error) {
      const message = typeof error?.message === "string" ? error.message : `Anthropic failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    const text = extractText(raw);
    if (!text) throw new Error("Anthropic returned an empty answer.");
    const citations: Citation[] = dedupeCitations(extractTextUrlCitations(text));
    const modelVersion = typeof asObject(raw)?.model === "string" ? String(asObject(raw)?.model) : input.model;

    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: this.definition.sourceType,
      sourceLabel: `Source: ${this.definition.label} API`,
      resultCaveat: this.definition.resultCaveat,
      model: input.model,
      modelVersion,
      text,
      rawJson: raw,
      citations,
      webQueries: [],
      tokenUsage: normalizeUsage(raw),
      latencyMs: response.latencyMs,
      createdAt: new Date().toISOString(),
    };
  }
}

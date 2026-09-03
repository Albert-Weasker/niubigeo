import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput, TokenUsage } from "../core/types.js";
import { dedupeCitations, extractGeminiGroundingCitations, extractTextUrlCitations } from "./citation-extractors.js";
import { postJsonWithRetry } from "./http.js";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractText(raw: unknown): string {
  const candidates = Array.isArray(asObject(raw)?.candidates) ? asObject(raw)?.candidates as unknown[] : [];
  const first = asObject(candidates[0]);
  const content = asObject(first?.content);
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  return parts
    .map((part) => {
      const obj = asObject(part);
      return typeof obj?.text === "string" ? obj.text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeUsage(raw: unknown): TokenUsage | undefined {
  const usage = asObject(asObject(raw)?.usageMetadata);
  if (!usage) return undefined;
  const input = typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : 0;
  const output = typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : 0;
  const total = typeof usage.totalTokenCount === "number" ? usage.totalTokenCount : input + output;
  return { input, output, total };
}

export class GeminiProvider implements AnswerProvider {
  constructor(readonly definition: ProviderDefinition) {}

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;
    const response = await postJsonWithRetry(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: {
          temperature: input.temperature,
          maxOutputTokens: input.maxTokens,
        },
      }),
    });

    const raw = response.data;
    const error = asObject(asObject(raw)?.error);
    if (!response.ok || error) {
      const message = typeof error?.message === "string" ? error.message : `Gemini failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    const text = extractText(raw);
    if (!text) throw new Error("Gemini returned an empty answer.");
    const nativeCitations = extractGeminiGroundingCitations(raw);
    const citations = dedupeCitations([...nativeCitations, ...extractTextUrlCitations(text, nativeCitations.length)]);

    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: this.definition.sourceType,
      sourceLabel: `Source: ${this.definition.label} API`,
      resultCaveat: this.definition.resultCaveat,
      model: input.model,
      modelVersion: input.model,
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

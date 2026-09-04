import type {
  AnswerProvider,
  AnswerResult,
  Citation,
  ProviderDefinition,
  ProviderEndpointKind,
  ProviderRunInput,
  TokenUsage,
} from "../core/types.js";
import { dedupeCitations, extractResponseCitations, extractTextUrlCitations } from "./citation-extractors.js";
import { postJsonWithRetry } from "./http.js";
import { makeSearchExecution } from "./search-execution.js";
import { extractResponseWebQueries } from "./web-query-extractors.js";

interface ResponsesCompatibleOptions {
  definition: ProviderDefinition;
  endpoint: string;
  endpointKind?: ProviderEndpointKind | undefined;
  extraHeaders?: Record<string, string> | undefined;
  webSearchToolName?: string | undefined;
  citationExtractor?: (raw: unknown) => Citation[];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractTextFromContent(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  return content
    .map((part) => {
      const obj = asObject(part);
      if (typeof obj?.text === "string") return obj.text;
      if (typeof obj?.output_text === "string") return obj.output_text;
      return "";
    })
    .filter(Boolean);
}

function extractText(raw: unknown): string {
  const root = asObject(raw);
  if (typeof root?.output_text === "string" && root.output_text.trim()) return root.output_text.trim();
  const output = Array.isArray(root?.output) ? root.output : [];
  const parts: string[] = [];
  for (const item of output) {
    const obj = asObject(item);
    if (typeof obj?.text === "string") parts.push(obj.text);
    parts.push(...extractTextFromContent(obj?.content));
  }
  return parts.filter(Boolean).join("\n").trim();
}

function extractModelVersion(raw: unknown, fallback: string): string {
  const root = asObject(raw);
  return typeof root?.model === "string" ? root.model : fallback;
}

function normalizeUsage(raw: unknown): TokenUsage | undefined {
  const usage = asObject(asObject(raw)?.usage);
  if (!usage) return undefined;
  const input = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
  const output = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
  const total = typeof usage.total_tokens === "number" ? usage.total_tokens : input + output;
  return { input, output, total };
}

export class ResponsesCompatibleProvider implements AnswerProvider {
  readonly definition: ProviderDefinition;
  private readonly endpoint: string;
  private readonly endpointKind: ProviderEndpointKind;
  private readonly extraHeaders: Record<string, string>;
  private readonly webSearchToolName: string;
  private readonly citationExtractor: (raw: unknown) => Citation[];

  constructor(options: ResponsesCompatibleOptions) {
    this.definition = options.definition;
    this.endpoint = options.endpoint;
    this.endpointKind = options.endpointKind || "official_api";
    this.extraHeaders = options.extraHeaders || {};
    this.webSearchToolName = options.webSearchToolName || "web_search";
    this.citationExtractor = options.citationExtractor || extractResponseCitations;
  }

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const body: Record<string, unknown> = {
      model: input.model,
      input: input.prompt,
      temperature: input.temperature,
      max_output_tokens: input.maxTokens,
    };
    if (input.webSearchEnabled) {
      body.tools = [{ type: this.webSearchToolName }];
    }

    const response = await postJsonWithRetry(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        ...this.extraHeaders,
      },
      body: JSON.stringify(body),
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
    const webQueries = extractResponseWebQueries(raw);
    const search = makeSearchExecution({
      definition: this.definition,
      runInput: input,
      endpointKind: this.endpointKind,
      endpointProtocol: "responses",
      endpointUrl: this.endpoint,
      toolName: this.webSearchToolName,
      webQueries,
      citationCount: nativeCitations.length,
      note: input.webSearchEnabled ? "Provider-native web search tool was supplied on the Responses API request." : undefined,
    });

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
      webQueries,
      search,
      tokenUsage: normalizeUsage(raw),
      latencyMs: response.latencyMs,
      createdAt: new Date().toISOString(),
    };
  }
}

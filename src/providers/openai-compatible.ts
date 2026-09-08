import type {
  AnswerProvider,
  AnswerResult,
  Citation,
  ProviderDefinition,
  ProviderEndpointKind,
  ProviderEndpointProtocol,
  ProviderRunInput,
  TokenUsage,
  WebSearchExecutionMode,
} from "../core/types.js";
import {
  dedupeCitations,
  extractAnnotationCitations,
  extractPerplexityCitations,
  extractTextUrlCitations,
} from "./citation-extractors.js";
import { postJsonWithRetry } from "./http.js";
import { makeSearchExecution } from "./search-execution.js";
import { extractPerplexityWebQueries } from "./web-query-extractors.js";
import { failureCodeForStatus, ProviderRequestError } from "./provider-error.js";

export interface OpenAICompatibleNativeWebSearchVerification {
  providerExecutionConfirmed: boolean;
  executionMode: WebSearchExecutionMode;
  note?: string | undefined;
}

export interface OpenAICompatibleNativeWebSearchPlan {
  toolName: string;
  bodyPatch?: Record<string, unknown> | undefined;
  alwaysOn?: boolean | undefined;
  note?: string | undefined;
  verify?: ((raw: unknown) => OpenAICompatibleNativeWebSearchVerification) | undefined;
}

export interface OpenAICompatibleNativeWebSearchResolver {
  resolve(input: ProviderRunInput): OpenAICompatibleNativeWebSearchPlan | Promise<OpenAICompatibleNativeWebSearchPlan>;
}

interface OpenAICompatibleOptions {
  definition: ProviderDefinition;
  endpoint: string;
  endpointKind?: ProviderEndpointKind | undefined;
  endpointProtocol?: ProviderEndpointProtocol | undefined;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
  citationExtractor?: (raw: unknown) => Citation[];
  costExtractor?: (raw: unknown) => number | undefined;
  nativeWebSearch?: OpenAICompatibleNativeWebSearchPlan | OpenAICompatibleNativeWebSearchResolver | undefined;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function contentPartText(value: unknown): string {
  if (typeof value === "string") return value;
  const row = asObject(value);
  if (typeof row?.text === "string") return row.text;
  if (typeof row?.content === "string") return row.content;
  return "";
}

export function extractOpenAICompatibleText(raw: unknown): string {
  const root = asObject(raw);
  const choices = Array.isArray(root?.choices) ? root.choices : [];
  const first = asObject(choices[0]);
  const message = asObject(first?.message);
  if (typeof message?.content === "string") return message.content.trim();
  if (!Array.isArray(message?.content)) return "";
  return message.content.map(contentPartText).filter(Boolean).join("\n").trim();
}

function extractStructuredToolArguments(raw: unknown, toolName: string): string {
  const root = asObject(raw);
  const choices = Array.isArray(root?.choices) ? root.choices : [];
  const first = asObject(choices[0]);
  const message = asObject(first?.message);
  const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  for (const value of toolCalls) {
    const call = asObject(value);
    const functionCall = asObject(call?.function);
    if (functionCall?.name !== toolName) continue;
    if (typeof functionCall.arguments === "string") return functionCall.arguments.trim();
  }
  return "";
}

function outputToolDefinition(input: ProviderRunInput): Record<string, unknown> | undefined {
  if (!input.structuredOutputTool) return undefined;
  return {
    type: "function",
    function: {
      name: input.structuredOutputTool.name,
      description: input.structuredOutputTool.description,
      parameters: input.structuredOutputTool.schema,
      strict: true,
    },
  };
}

function mergeOutputTool(bodyPatch: Record<string, unknown> | undefined, outputTool: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!outputTool) return bodyPatch || {};
  const patch = bodyPatch || {};
  const nativeTools = Array.isArray(patch.tools) ? patch.tools : [];
  const { tools: _tools, ...rest } = patch;
  return { ...rest, tools: [...nativeTools, outputTool] };
}

async function nativeWebSearchPlan(
  config: OpenAICompatibleOptions["nativeWebSearch"],
  input: ProviderRunInput,
): Promise<OpenAICompatibleNativeWebSearchPlan | undefined> {
  if (!config) return undefined;
  if ("resolve" in config) return config.resolve(input);
  return config;
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
  private readonly endpointKind: ProviderEndpointKind;
  private readonly endpointProtocol: ProviderEndpointProtocol;
  private readonly extraHeaders: Record<string, string>;
  private readonly extraBody: Record<string, unknown>;
  private readonly citationExtractor: (raw: unknown) => Citation[];
  private readonly costExtractor: (raw: unknown) => number | undefined;
  private readonly nativeWebSearch: OpenAICompatibleOptions["nativeWebSearch"];

  constructor(options: OpenAICompatibleOptions) {
    this.definition = options.definition;
    this.endpoint = options.endpoint;
    this.endpointKind = options.endpointKind || "official_api";
    this.endpointProtocol = options.endpointProtocol || "chat_completions";
    this.extraHeaders = options.extraHeaders || {};
    this.extraBody = options.extraBody || {};
    this.citationExtractor = options.citationExtractor || extractAnnotationCitations;
    this.costExtractor = options.costExtractor || defaultCostExtractor;
    this.nativeWebSearch = options.nativeWebSearch;
  }

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const nativeSearchPlan = await nativeWebSearchPlan(this.nativeWebSearch, input);
    const nativeSearchActive = Boolean(input.webSearchEnabled || nativeSearchPlan?.alwaysOn);
    const outputTool = outputToolDefinition(input);
    const bodyPatch = mergeOutputTool(
      nativeSearchActive && nativeSearchPlan?.bodyPatch ? nativeSearchPlan.bodyPatch : undefined,
      outputTool,
    );
    const body = {
      model: input.model,
      messages: [{ role: "user", content: input.prompt }],
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      ...(input.responseJsonSchema && !outputTool
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: input.responseJsonSchema.name,
                strict: true,
                schema: input.responseJsonSchema.schema,
              },
            },
          }
        : input.responseFormat === "json_object"
          ? { response_format: { type: "json_object" } }
          : {}),
      ...(input.requireProviderParameters ? { provider: { require_parameters: true } } : {}),
      ...this.extraBody,
      ...bodyPatch,
    };
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
      throw new ProviderRequestError({
        code: failureCodeForStatus(response.status),
        message: `${message} (HTTP ${response.status})`,
        status: response.status,
      });
    }

    const toolArguments = input.structuredOutputTool
      ? extractStructuredToolArguments(raw, input.structuredOutputTool.name)
      : undefined;
    const text = toolArguments || extractOpenAICompatibleText(raw);
    // 仅在调用方负责截断恢复时保留空响应；其他调用方继续通过 empty_answer 重试。
    const choices = asObject(raw)?.choices;
    const firstChoice = asObject(Array.isArray(choices) ? choices[0] : undefined);
    const emptyStructuredTruncation = input.preserveEmptyStructuredTruncation === true
      && input.responseJsonSchema && !outputTool && firstChoice?.finish_reason === "length";
    if (!text && !emptyStructuredTruncation) throw new ProviderRequestError({ code: "empty_answer", message: `Provider ${this.definition.id} returned an empty answer.` });
    const structuredOutput = toolArguments
      ? { transport: "function_tool" as const, value: toolArguments }
      : input.responseJsonSchema
        ? { transport: "response_json_schema" as const, value: text }
        : undefined;
    const nativeCitations = this.citationExtractor(raw);
    const citations = dedupeCitations([...nativeCitations, ...extractTextUrlCitations(text, nativeCitations.length)]);
    const alwaysOn = Boolean(nativeSearchPlan?.alwaysOn);
    const webQueries = input.webSearchEnabled || alwaysOn ? extractPerplexityWebQueries(raw) : [];
    const verification = nativeSearchActive ? nativeSearchPlan?.verify?.(raw) : undefined;
    const search = makeSearchExecution({
      definition: this.definition,
      runInput: input,
      endpointKind: this.endpointKind,
      endpointProtocol: this.endpointProtocol,
      endpointUrl: this.endpoint,
      toolName: nativeSearchPlan?.toolName,
      webQueries,
      citationCount: nativeCitations.length,
      alwaysOn,
      providerExecutionConfirmed: verification?.providerExecutionConfirmed,
      executionMode: verification?.executionMode,
      note: verification?.note || (nativeSearchActive ? nativeSearchPlan?.note : undefined),
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
      structuredOutput,
      rawProviderResponse: raw,
      citations,
      webQueries,
      search,
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

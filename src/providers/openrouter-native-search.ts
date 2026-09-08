import type { ProviderRunInput } from "../core/types.js";
import type {
  OpenAICompatibleNativeWebSearchPlan,
  OpenAICompatibleNativeWebSearchResolver,
  OpenAICompatibleNativeWebSearchVerification,
} from "./openai-compatible.js";
import {
  OpenRouterModelCatalog,
  type OpenRouterModelCapabilitySource,
} from "./openrouter-model-capabilities.js";
import { ProviderRequestError } from "./provider-error.js";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function serverToolMode(raw: unknown): "native" | "sdk" | undefined {
  const metadata = asObject(asObject(raw)?.openrouter_metadata);
  const pipeline = Array.isArray(metadata?.pipeline) ? metadata.pipeline : [];
  for (const value of pipeline) {
    const stage = asObject(value);
    if (stage?.type !== "server_tools") continue;
    const mode = asObject(stage.data)?.mode;
    if (mode === "native" || mode === "sdk") return mode;
  }
  return undefined;
}

function hasGroundingEvidence(raw: unknown): boolean {
  const root = asObject(raw);
  const choices = Array.isArray(root?.choices) ? root.choices : [];
  const first = asObject(choices[0]);
  const message = asObject(first?.message);
  const annotations = Array.isArray(message?.annotations) ? message.annotations : [];
  const searchResults = Array.isArray(root?.search_results) ? root.search_results : [];
  const citations = Array.isArray(root?.citations) ? root.citations : [];
  return annotations.length > 0 || searchResults.length > 0 || citations.length > 0;
}

function verifyServerTool(raw: unknown): OpenAICompatibleNativeWebSearchVerification {
  const mode = serverToolMode(raw);
  if (mode === "native") {
    return {
      providerExecutionConfirmed: true,
      executionMode: "native",
      note: "OpenRouter metadata confirmed provider-native web search.",
    };
  }
  if (mode === "sdk") {
    return {
      providerExecutionConfirmed: true,
      executionMode: "sdk",
      note: "OpenRouter metadata confirmed its provider web-search server tool through the SDK path; this does not claim model-built-in search.",
    };
  }
  return {
    providerExecutionConfirmed: false,
    executionMode: "unverified",
    note: "OpenRouter metadata did not confirm how web search was executed.",
  };
}

function verifyBuiltInGrounding(raw: unknown): OpenAICompatibleNativeWebSearchVerification {
  const confirmed = hasGroundingEvidence(raw);
  return {
    providerExecutionConfirmed: confirmed,
    executionMode: confirmed ? "provider_always_on" : "unverified",
    note: confirmed
      ? "The response contains evidence from the model's built-in grounding protocol."
      : "The response did not contain evidence confirming built-in grounding.",
  };
}

export class OpenRouterNativeWebSearchResolver implements OpenAICompatibleNativeWebSearchResolver {
  constructor(private readonly capabilities: OpenRouterModelCapabilitySource = new OpenRouterModelCatalog()) {}

  async resolve(input: ProviderRunInput): Promise<OpenAICompatibleNativeWebSearchPlan> {
    if (!input.webSearchEnabled) {
      return {
        toolName: "openrouter:web_search",
        bodyPatch: {},
        note: "Web search is disabled for this request.",
        verify: verifyServerTool,
      };
    }
    const capability = await this.capabilities.capability(input.model);
    if (capability.searchProtocol === "built_in_grounding") {
      return {
        toolName: "model_web_grounding",
        bodyPatch: { web_search_options: { search_context_size: "medium" } },
        alwaysOn: true,
        note: "The model catalog requires its built-in grounding protocol.",
        verify: verifyBuiltInGrounding,
      };
    }
    if (capability.searchProtocol === "server_tool") {
      return {
        toolName: "openrouter:web_search",
        bodyPatch: {
          tools: [{ type: "openrouter:web_search", parameters: { engine: "native" } }],
          tool_choice: "required",
        },
        note: "OpenRouter provider-native web search was requested.",
        verify: verifyServerTool,
      };
    }
    throw new ProviderRequestError({
      code: "unsupported_capability",
      message: `Model ${input.model} does not expose a native web-search protocol through OpenRouter.`,
    });
  }
}

export const openRouterNativeWebSearch = new OpenRouterNativeWebSearchResolver();

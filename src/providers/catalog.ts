import type { AnswerProvider, ProviderDefinition } from "../core/types.js";
import { openAICompatibleBaseUrl } from "../config/env.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { dedupeCitations, extractAnnotationCitations, extractPerplexityCitations } from "./citation-extractors.js";
import { OpenAICompatibleGatewayProvider } from "./openai-compatible-gateway.js";
import { OpenAICompatibleProvider, perplexityCitationExtractor } from "./openai-compatible.js";
import { ResponsesCompatibleProvider } from "./responses-compatible.js";

const API_CAVEAT = "API results are provider API results. They are not claimed to match browser UI or human verified regional results.";

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    sourceType: "api",
    envKeys: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
    defaultModels: ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku", "google/gemini-flash-1.5"],
    supportsAnyModel: true,
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "chat_completions",
      toolName: "openrouter:web",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "openai",
    label: "OpenAI",
    sourceType: "api",
    envKeys: ["OPENAI_API_KEY"],
    defaultModels: ["gpt-4o-mini", "gpt-4o"],
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "responses",
      toolName: "web_search",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    sourceType: "api",
    envKeys: ["ANTHROPIC_API_KEY"],
    defaultModels: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "messages",
      toolName: "web_search_20250305",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    sourceType: "api",
    envKeys: ["GEMINI_API_KEY"],
    defaultModels: ["gemini-1.5-flash", "gemini-1.5-pro"],
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "gemini_generate_content",
      toolName: "google_search",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    sourceType: "api",
    envKeys: ["PERPLEXITY_API_KEY"],
    defaultModels: ["sonar", "sonar-pro"],
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "perplexity_sonar",
      toolName: "sonar_web_grounding",
      alwaysOn: true,
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    sourceType: "api",
    envKeys: ["DEEPSEEK_API_KEY"],
    defaultModels: ["deepseek-chat"],
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "responses",
      toolName: "web_search",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    sourceType: "api",
    envKeys: ["OPENAI_COMPATIBLE_API_KEY", "OPENAI_COMPATIBLE_BASE_URL"],
    defaultModels: ["model-id"],
    supportsAnyModel: true,
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "responses",
      toolName: "web_search",
    },
    resultCaveat: API_CAVEAT,
  },
];

function definition(id: string): ProviderDefinition {
  const found = PROVIDER_DEFINITIONS.find((item) => item.id === id);
  if (!found) throw new Error(`Unsupported provider: ${id}`);
  return found;
}

export class ProviderCatalog {
  private readonly providers = new Map<string, AnswerProvider>();

  constructor() {
    const openrouterDefinition = definition("openrouter");
    this.providers.set(
      "openrouter",
      new OpenAICompatibleProvider({
        definition: openrouterDefinition,
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        extraHeaders: {
          "HTTP-Referer": "http://localhost",
          "X-Title": "niubigeo OSS",
        },
        citationExtractor: (raw) => dedupeCitations([...extractAnnotationCitations(raw), ...extractPerplexityCitations(raw)]),
        nativeWebSearch: {
          toolName: "openrouter:web",
          bodyPatch: { plugins: [{ id: "web" }] },
          note: "OpenRouter web plugin was enabled on the Chat Completions request.",
        },
      }),
    );

    this.providers.set(
      "openai",
      new ResponsesCompatibleProvider({
        definition: definition("openai"),
        endpoint: "https://api.openai.com/v1/responses",
      }),
    );

    this.providers.set("anthropic", new AnthropicProvider(definition("anthropic")));
    this.providers.set("gemini", new GeminiProvider(definition("gemini")));

    this.providers.set(
      "perplexity",
      new OpenAICompatibleProvider({
        definition: definition("perplexity"),
        endpoint: "https://api.perplexity.ai/chat/completions",
        endpointProtocol: "perplexity_sonar",
        extraBody: { return_citations: true },
        citationExtractor: perplexityCitationExtractor,
        nativeWebSearch: {
          toolName: "sonar_web_grounding",
          alwaysOn: true,
          note: "Perplexity Sonar responses are web-grounded by the provider API.",
        },
      }),
    );

    this.providers.set(
      "deepseek",
      new ResponsesCompatibleProvider({
        definition: definition("deepseek"),
        endpoint: "https://api.deepseek.com/responses",
      }),
    );

    const compatibleBaseUrl = openAICompatibleBaseUrl();
    this.providers.set(
      "openai-compatible",
      new OpenAICompatibleGatewayProvider(definition("openai-compatible"), compatibleBaseUrl || "http://localhost"),
    );
  }

  list(): ProviderDefinition[] {
    return PROVIDER_DEFINITIONS;
  }

  get(providerId: string): AnswerProvider {
    if (providerId === "openai-compatible" && !openAICompatibleBaseUrl()) {
      throw new Error("Missing OPENAI_COMPATIBLE_BASE_URL for provider \"openai-compatible\".");
    }
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider "${providerId}" is not registered.`);
    return provider;
  }

  validate(providerId: string, model: string): void {
    const provider = this.get(providerId);
    if (provider.definition.supportsAnyModel) return;
    if (!provider.definition.defaultModels.includes(model)) {
      throw new Error(
        `Model "${model}" is not in the catalog for provider "${providerId}". Supported: ${provider.definition.defaultModels.join(", ")}`,
      );
    }
  }
}

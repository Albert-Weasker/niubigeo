import test from "node:test";
import assert from "node:assert/strict";
import type { ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { GeminiProvider } from "../src/providers/gemini.js";
import { OpenAICompatibleGatewayProvider } from "../src/providers/openai-compatible-gateway.js";
import { OpenAICompatibleProvider, perplexityCitationExtractor } from "../src/providers/openai-compatible.js";
import { OpenRouterNativeWebSearchResolver } from "../src/providers/openrouter-native-search.js";
import type { OpenRouterSearchProtocol } from "../src/providers/openrouter-model-capabilities.js";
import { ResponsesCompatibleProvider } from "../src/providers/responses-compatible.js";
import { PROVIDER_DEFINITIONS } from "../src/providers/catalog.js";

const originalFetch = globalThis.fetch;

interface CapturedRequest {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

function definition(id: string, label = id): ProviderDefinition {
  return {
    id,
    label,
    sourceType: "api",
    envKeys: [`${id.toUpperCase()}_API_KEY`],
    defaultModels: ["model"],
    supportsNativeCitations: true,
    supportsWebSearch: true,
    resultCaveat: "API result",
  };
}

function input(overrides: Partial<ProviderRunInput> = {}): ProviderRunInput {
  return {
    prompt: "What is NiubiGEO?",
    model: "model",
    apiKey: "test-key",
    maxTokens: 200,
    temperature: 0,
    webSearchEnabled: false,
    ...overrides,
  };
}

function openRouterSearch(protocol: OpenRouterSearchProtocol): OpenRouterNativeWebSearchResolver {
  return new OpenRouterNativeWebSearchResolver({
    capability: async (model) => ({
      model,
      name: model,
      supportedParameters: [],
      nativeWebSearchSupported: protocol !== "unsupported",
      searchProtocol: protocol,
    }),
  });
}

function mockFetch(raw: unknown, captured: CapturedRequest[]): void {
  globalThis.fetch = async (url, init) => {
    captured.push({
      url: String(url),
      body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown>,
      headers: init?.headers as Record<string, string>,
    });
    return new Response(JSON.stringify(raw), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("provider catalog declares only verified native web search capabilities", () => {
  const supportedIds = ["openrouter", "openai", "anthropic", "gemini", "perplexity"];
  for (const id of supportedIds) {
    const provider = PROVIDER_DEFINITIONS.find((item) => item.id === id);
    assert.equal(provider?.supportsWebSearch, true);
    assert.equal(Boolean(provider?.nativeWebSearch?.toolName), true);
  }
  const deepseek = PROVIDER_DEFINITIONS.find((item) => item.id === "deepseek");
  assert.equal(deepseek?.supportsWebSearch, false);
  assert.equal(deepseek?.nativeWebSearch, undefined);
});

test("OpenRouter sends its provider-native web_search server tool only when manually enabled", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "openai/gpt-4o-mini",
      choices: [{ message: { content: "NiubiGEO is mentioned.", annotations: [{ url: "https://niubigeo.ai/", title: "NiubiGEO" }] } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      openrouter_metadata: {
        pipeline: [{ type: "server_tools", data: { mode: "native", tools: ["openrouter:web_search"] } }],
      },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    extraHeaders: { "X-OpenRouter-Metadata": "enabled" },
    nativeWebSearch: openRouterSearch("server_tool"),
  });

  await provider.run(input());
  assert.equal(captured[0]?.body.tools, undefined);

  const result = await provider.run(input({ model: "openai/gpt-5", webSearchEnabled: true, webSearchMode: "provider_native" }));
  assert.deepEqual(captured[1]?.body.tools, [{ type: "openrouter:web_search", parameters: { engine: "native" } }]);
  assert.equal(captured[1]?.body.tool_choice, "required");
  assert.equal(captured[1]?.body.provider, undefined);
  assert.equal(captured[1]?.headers["X-OpenRouter-Metadata"], "enabled");
  assert.equal(result.search?.usedMode, "provider_native");
  assert.equal(result.search?.executionMode, "native");
  assert.equal(result.search?.requestMode, "provider_native");
  assert.equal(result.search?.toolName, "openrouter:web_search");
});

test("records a confirmed OpenRouter server-search SDK execution without calling it model-built-in", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "openai/gpt-4o-mini",
      choices: [{ message: { content: "NiubiGEO is mentioned.", annotations: [{ url: "https://niubigeo.ai/" }] } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      openrouter_metadata: {
        pipeline: [{ type: "server_tools", data: { mode: "sdk", tools: ["openrouter:web_search"] } }],
      },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    nativeWebSearch: openRouterSearch("server_tool"),
  });

  const result = await provider.run(input({ model: "anthropic/claude-haiku-4.5", webSearchEnabled: true, webSearchMode: "provider_native" }));

  assert.deepEqual(captured[0]?.body.tools, [{ type: "openrouter:web_search", parameters: { engine: "native" } }]);
  assert.equal(result.search?.requested, true);
  assert.equal(result.search?.used, true);
  assert.equal(result.search?.usedMode, "provider_native");
  assert.equal(result.search?.executionMode, "sdk");
});

test("OpenRouter sends one generic search request and trusts returned execution evidence", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch({
    model: "vendor/model",
    choices: [{ message: { content: "Grounded answer." } }],
    openrouter_metadata: {
      pipeline: [{ type: "server_tools", data: { mode: "native", tools: ["openrouter:web_search"] } }],
    },
  }, captured);
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    nativeWebSearch: openRouterSearch("server_tool"),
  });

  const result = await provider.run(input({ model: "vendor/model", webSearchEnabled: true, webSearchMode: "provider_native" }));
  assert.deepEqual(captured[0]?.body.tools, [{ type: "openrouter:web_search", parameters: { engine: "native" } }]);
  assert.equal(captured[0]?.body.provider, undefined);
  assert.equal(result.search?.executionMode, "native");
});

test("OpenRouter does not inject provider routing preferences for native search", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "google/gemini-3.1-flash-lite",
      choices: [{ message: { content: "Grounded answer.", annotations: [{ url: "https://example.com/" }] } }],
      openrouter_metadata: {
        pipeline: [{ type: "server_tools", data: { mode: "native", tools: ["openrouter:web_search"] } }],
      },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    nativeWebSearch: openRouterSearch("server_tool"),
  });

  const result = await provider.run(
    input({ model: "google/gemini-3.1-flash-lite", webSearchEnabled: true, webSearchMode: "provider_native" }),
  );

  assert.equal(captured[0]?.body.provider, undefined);
  assert.equal(captured[0]?.body.tool_choice, "required");
  assert.equal(result.search?.executionMode, "native");
});

test("OpenRouter verifies model-native grounding without model-specific branches", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "perplexity/sonar",
      choices: [{ message: { content: "Grounded answer.", annotations: [{ url: "https://example.com/" }] } }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
      openrouter_metadata: {
        pipeline: [{ type: "server_tools", data: { mode: "native", tools: ["openrouter:web_search"] } }],
      },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    nativeWebSearch: openRouterSearch("built_in_grounding"),
  });

  const result = await provider.run(input({ model: "perplexity/sonar", webSearchEnabled: true, webSearchMode: "provider_native" }));

  assert.equal(captured[0]?.body.tools, undefined);
  assert.equal(captured[0]?.body.tool_choice, undefined);
  assert.deepEqual(captured[0]?.body.web_search_options, { search_context_size: "medium" });
  assert.equal(captured[0]?.body.provider, undefined);
  assert.equal(result.search?.usedMode, "provider_native");
  assert.equal(result.search?.executionMode, "provider_always_on");
  assert.equal(result.search?.toolName, "model_web_grounding");
});

test("OpenAI-compatible provider can request JSON object output for analyzer calls", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "openai/gpt-4o-mini",
      choices: [{ message: { content: "{\"ok\":true}", annotations: [] } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
  });

  await provider.run(input({ responseFormat: "json_object" }));

  assert.deepEqual(captured[0]?.body.response_format, { type: "json_object" });
  assert.equal(captured[0]?.body.plugins, undefined);
});

test("OpenAI-compatible provider can enforce a JSON schema for structured analysis", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "openai/gpt-4o-mini",
      choices: [{ message: { content: "{\"ok\":true}", annotations: [] } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
  });
  const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };

  await provider.run(input({ responseJsonSchema: { name: "analysis_result", schema } }));

  assert.deepEqual(captured[0]?.body.response_format, {
    type: "json_schema",
    json_schema: { name: "analysis_result", strict: true, schema },
  });
});

test("OpenAI-compatible provider can require routing support for structured parameters", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "openai/gpt-4o-mini",
      choices: [{ message: { content: "{\"ok\":true}", annotations: [] } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
  });
  const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };

  await provider.run(input({ responseJsonSchema: { name: "analysis_result", schema }, requireProviderParameters: true }));

  assert.deepEqual(captured[0]?.body.provider, { require_parameters: true });
});

test("OpenAI-compatible provider can combine Provider-native search with a strict structured output tool", async () => {
  const captured: CapturedRequest[] = [];
  const argumentsText = "{\"ok\":true}";
  mockFetch(
    {
      model: "vendor/model",
      choices: [{
        message: {
          content: null,
          tool_calls: [{ type: "function", function: { name: "record_observation", arguments: argumentsText } }],
          annotations: [{ url: "https://source.example/" }],
        },
      }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      openrouter_metadata: {
        pipeline: [{ type: "server_tools", data: { mode: "native", tools: ["openrouter:web_search"] } }],
      },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    nativeWebSearch: openRouterSearch("server_tool"),
  });
  const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };

  const result = await provider.run(input({
    model: "vendor/model",
    webSearchEnabled: true,
    webSearchMode: "provider_native",
    requireProviderParameters: true,
    structuredOutputTool: { name: "record_observation", description: "Record an observation.", schema },
  }));

  assert.equal(captured[0]?.body.response_format, undefined);
  assert.deepEqual(captured[0]?.body.tools, [
    { type: "openrouter:web_search", parameters: { engine: "native" } },
    { type: "function", function: { name: "record_observation", description: "Record an observation.", parameters: schema, strict: true } },
  ]);
  assert.deepEqual(captured[0]?.body.provider, { require_parameters: true });
  assert.equal(result.text, argumentsText);
  assert.equal(result.citations[0]?.url, "https://source.example/");
});

test("Responses-compatible provider sends web_search and reads returned citations", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "gpt-4o-mini",
      output: [
        { type: "web_search_call", action: { query: "NiubiGEO AI visibility" } },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "NiubiGEO is an AI visibility monitor.",
              annotations: [{ url: "https://niubigeo.ai/", title: "NiubiGEO" }],
            },
          ],
        },
      ],
      usage: { input_tokens: 5, output_tokens: 7, total_tokens: 12 },
    },
    captured,
  );
  const provider = new ResponsesCompatibleProvider({
    definition: definition("openai", "OpenAI"),
    endpoint: "https://api.openai.com/v1/responses",
  });
  const result = await provider.run(input({ webSearchEnabled: true }));

  assert.deepEqual(captured[0]?.body.tools, [{ type: "web_search" }]);
  assert.equal(captured[0]?.body.input, "What is NiubiGEO?");
  assert.deepEqual(result.webQueries, ["NiubiGEO AI visibility"]);
  assert.equal(result.citations[0]?.url, "https://niubigeo.ai/");
  assert.equal(result.search?.endpointProtocol, "responses");
});

test("Anthropic provider sends Claude native web search tool", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "claude-3-5-haiku-latest",
      content: [
        { type: "server_tool_use", name: "web_search", input: { query: "NiubiGEO" } },
        {
          type: "text",
          text: "NiubiGEO is cited.",
          citations: [{ url: "https://niubigeo.ai/", title: "NiubiGEO" }],
        },
      ],
      usage: { input_tokens: 4, output_tokens: 6 },
    },
    captured,
  );
  const provider = new AnthropicProvider(definition("anthropic", "Anthropic"));
  const result = await provider.run(input({ webSearchEnabled: true, model: "claude-3-5-haiku-latest" }));

  assert.deepEqual(captured[0]?.body.tools, [{ type: "web_search_20250305", name: "web_search" }]);
  assert.deepEqual(result.webQueries, ["NiubiGEO"]);
  assert.equal(result.citations[0]?.domain, "niubigeo.ai");
  assert.equal(result.search?.endpointProtocol, "messages");
});

test("Gemini provider sends Google Search grounding when enabled", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      candidates: [
        {
          content: { parts: [{ text: "NiubiGEO is grounded." }] },
          groundingMetadata: {
            webSearchQueries: ["NiubiGEO"],
            groundingChunks: [{ web: { uri: "https://niubigeo.ai/", title: "NiubiGEO" } }],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 5, totalTokenCount: 9 },
    },
    captured,
  );
  const provider = new GeminiProvider(definition("gemini", "Google Gemini"));
  const result = await provider.run(input({ webSearchEnabled: true, model: "gemini-1.5-flash" }));

  assert.deepEqual(captured[0]?.body.tools, [{ google_search: {} }]);
  assert.deepEqual(result.webQueries, ["NiubiGEO"]);
  assert.equal(result.citations[0]?.domain, "niubigeo.ai");
  assert.equal(result.search?.endpointProtocol, "gemini_generate_content");
});

test("Perplexity Sonar is recorded as provider web-grounded even without an extra toggle", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "sonar",
      choices: [{ message: { content: "NiubiGEO is mentioned." } }],
      citations: ["https://niubigeo.ai/"],
      search_results: [{ title: "NiubiGEO", url: "https://niubigeo.ai/" }],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("perplexity", "Perplexity"),
    endpoint: "https://api.perplexity.ai/chat/completions",
    endpointProtocol: "perplexity_sonar",
    citationExtractor: perplexityCitationExtractor,
    nativeWebSearch: {
      toolName: "sonar_web_grounding",
      alwaysOn: true,
    },
  });
  const result = await provider.run(input({ model: "sonar" }));

  assert.equal(captured[0]?.body.model, "sonar");
  assert.equal(result.search?.usedMode, "provider_always_on");
  assert.equal(result.search?.endpointProtocol, "perplexity_sonar");
  assert.equal(result.citations[0]?.domain, "niubigeo.ai");
});

test("custom OpenAI-compatible gateway uses chat completions offline and Responses for native search", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "model",
      choices: [{ message: { content: "Offline answer." } }],
      output_text: "Online answer.",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Online answer.", annotations: [{ url: "https://niubigeo.ai/" }] }],
        },
      ],
    },
    captured,
  );
  const provider = new OpenAICompatibleGatewayProvider(definition("openai-compatible", "OpenAI-compatible"), "https://gateway.example/v1");

  await provider.run(input());
  await provider.run(input({ webSearchEnabled: true }));

  assert.equal(captured[0]?.url, "https://gateway.example/v1/chat/completions");
  assert.equal(captured[1]?.url, "https://gateway.example/v1/responses");
  assert.equal(captured[0]?.body.messages !== undefined, true);
  assert.deepEqual(captured[1]?.body.tools, [{ type: "web_search" }]);
});

test("empty unstructured answers remain errors even when token-limited", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch({ choices: [{ finish_reason: "length", message: { content: null } }] }, captured);
  const provider = new OpenAICompatibleProvider({ definition: definition("openrouter"), endpoint: "https://provider.example/chat/completions" });
  await assert.rejects(provider.run(input()), { code: "empty_answer" });
  assert.equal(captured.length, 1);
});

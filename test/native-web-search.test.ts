import test from "node:test";
import assert from "node:assert/strict";
import type { ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { GeminiProvider } from "../src/providers/gemini.js";
import { OpenAICompatibleGatewayProvider } from "../src/providers/openai-compatible-gateway.js";
import { OpenAICompatibleProvider, perplexityCitationExtractor } from "../src/providers/openai-compatible.js";
import { ResponsesCompatibleProvider } from "../src/providers/responses-compatible.js";
import { PROVIDER_DEFINITIONS } from "../src/providers/catalog.js";

const originalFetch = globalThis.fetch;

interface CapturedRequest {
  url: string;
  body: Record<string, unknown>;
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

function mockFetch(raw: unknown, captured: CapturedRequest[]): void {
  globalThis.fetch = async (url, init) => {
    captured.push({
      url: String(url),
      body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown>,
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

test("provider catalog declares native web search for every first-party provider", () => {
  const ids = ["openrouter", "openai", "anthropic", "gemini", "perplexity", "deepseek"];
  for (const id of ids) {
    const provider = PROVIDER_DEFINITIONS.find((item) => item.id === id);
    assert.equal(provider?.supportsWebSearch, true);
    assert.equal(Boolean(provider?.nativeWebSearch?.toolName), true);
  }
});

test("OpenRouter sends its web plugin only when web search is enabled", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "openai/gpt-4o-mini",
      choices: [{ message: { content: "NiubiGEO is mentioned.", annotations: [{ url: "https://niubigeo.ai/", title: "NiubiGEO" }] } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    nativeWebSearch: {
      toolName: "openrouter:web",
      bodyPatch: { plugins: [{ id: "web" }] },
    },
  });

  await provider.run(input());
  const offPlugins = captured[0]?.body.plugins;
  assert.equal(offPlugins, undefined);

  const result = await provider.run(input({ webSearchEnabled: true }));
  const onPlugins = captured[1]?.body.plugins;
  assert.deepEqual(onPlugins, [{ id: "web" }]);
  assert.equal(result.search?.usedMode, "provider_native");
  assert.equal(result.search?.toolName, "openrouter:web");
});

test("does not report optional web search as used without response evidence", async () => {
  const captured: CapturedRequest[] = [];
  mockFetch(
    {
      model: "openai/gpt-4o-mini",
      choices: [{ message: { content: "NiubiGEO is mentioned.", annotations: [] } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    },
    captured,
  );
  const provider = new OpenAICompatibleProvider({
    definition: definition("openrouter", "OpenRouter"),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    nativeWebSearch: {
      toolName: "openrouter:web",
      bodyPatch: { plugins: [{ id: "web" }] },
    },
  });

  const result = await provider.run(input({ webSearchEnabled: true }));

  assert.deepEqual(captured[0]?.body.plugins, [{ id: "web" }]);
  assert.equal(result.search?.requested, true);
  assert.equal(result.search?.used, false);
  assert.equal(result.search?.usedMode, "requested_not_confirmed");
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

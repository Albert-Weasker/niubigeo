import test from "node:test";
import assert from "node:assert/strict";
import type { ProviderDefinition } from "../src/core/types.js";
import { ProviderModelCapabilityCatalog } from "../src/providers/model-capability-catalog.js";
import { OpenRouterModelCatalog } from "../src/providers/openrouter-model-capabilities.js";

const originalFetch = globalThis.fetch;

function provider(id: string, models: string[]): ProviderDefinition {
  return {
    id,
    label: id,
    sourceType: "api",
    envKeys: [],
    defaultModels: models,
    defaultModelCapabilities: models.map((model, index) => ({ model, nativeWebSearchSupported: index === 0 })),
    supportsNativeCitations: false,
    supportsWebSearch: true,
    resultCaveat: "API result",
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("declared providers list every model with an explicit native-search boolean", async () => {
  const catalog = new ProviderModelCapabilityCatalog([provider("direct", ["model-a", "model-b"])], []);
  const groups = await catalog.list();

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.models.map((model) => ({ model: model.model, supported: model.nativeWebSearchSupported })), [
    { model: "model-a", supported: true },
    { model: "model-b", supported: false },
  ]);
});

test("remote capability sources replace declared subsets without model-specific branches", async () => {
  const catalog = new ProviderModelCapabilityCatalog([provider("gateway", ["default-model"])], [{
    providerId: "gateway",
    list: async () => [
      { providerId: "gateway", model: "remote-a", name: "Remote A", vendor: "Remote Labs", releasedAt: "2026-01-01T00:00:00.000Z", nativeWebSearchSupported: true, source: "provider_catalog" },
      { providerId: "gateway", model: "remote-b", name: "Remote B", nativeWebSearchSupported: false, source: "provider_catalog" },
    ],
  }]);

  const group = (await catalog.list())[0];
  assert.equal(group?.catalogStatus, "available");
  assert.deepEqual(group?.models.map((model) => model.model), ["remote-a", "remote-b"]);
  assert.equal(group?.models.every((model) => typeof model.nativeWebSearchSupported === "boolean"), true);
  assert.equal(group?.models[0]?.vendor, "Remote Labs");
  assert.equal(group?.models[0]?.releasedAt, "2026-01-01T00:00:00.000Z");
});

test("OpenRouter treats catalog-confirmed native search separately from managed fallback", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: [
      {
        id: "vendor/native-model",
        name: "Native Model",
        created: 1700000000,
        pricing: { prompt: "0.1", web_search: "0.01" },
        supported_parameters: ["tools"],
      },
      {
        id: "vendor/fallback-model",
        name: "Fallback Model",
        pricing: { prompt: "0.1" },
        supported_parameters: ["tools", "web_search_options"],
      },
    ],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const models = await new OpenRouterModelCatalog().list();
  const native = models.find((model) => model.model === "vendor/native-model");
  const fallback = models.find((model) => model.model === "vendor/fallback-model");

  assert.equal(native?.nativeWebSearchSupported, true);
  assert.equal(native?.searchProtocol, "server_tool");
  assert.equal(native?.vendor, "vendor");
  assert.equal(native?.releasedAt, "2023-11-14T22:13:20.000Z");
  assert.equal(fallback?.nativeWebSearchSupported, false);
  assert.equal(fallback?.searchProtocol, "unsupported");
});

test("OpenRouter retries after a failed catalog request and caches the successful result", async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    if (requests === 1) return new Response("Service unavailable", { status: 503 });
    return new Response(JSON.stringify({
      data: [{ id: "vendor/model-a", name: "Model A", supported_parameters: [], pricing: {} }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const catalog = new OpenRouterModelCatalog();
  await assert.rejects(catalog.list(), { name: "ProviderRequestError", code: "upstream_unavailable", status: 503 });
  assert.equal(requests, 1);

  const recovered = await catalog.list();
  assert.equal(requests, 2);
  assert.deepEqual(recovered.map((model) => model.model), ["vendor/model-a"]);
  assert.deepEqual(await catalog.list(), recovered);
  assert.strictEqual(await catalog.capability("vendor/model-a"), recovered[0]);
  assert.equal(requests, 2);
});

test("OpenRouter shares an in-flight catalog request between list and capability callers", async () => {
  let requests = 0;
  let resolveResponse!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => { resolveResponse = resolve; });
  globalThis.fetch = async () => {
    requests += 1;
    return response;
  };

  const catalog = new OpenRouterModelCatalog();
  const first = catalog.list();
  const second = catalog.list();
  const capability = catalog.capability("vendor/model-a");
  assert.equal(requests, 1);

  resolveResponse(new Response(JSON.stringify({
    data: [{ id: "vendor/model-a", name: "Model A", supported_parameters: [], pricing: {} }],
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const [firstModels, secondModels, model] = await Promise.all([first, second, capability]);
  assert.deepEqual(firstModels.map((item) => item.model), ["vendor/model-a"]);
  assert.deepEqual(secondModels, firstModels);
  assert.strictEqual(model, firstModels[0]);
  assert.strictEqual(model, secondModels[0]);
  assert.equal(requests, 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProductServer } from "../src/product/product-server.js";
import { ProviderCatalog } from "../src/providers/catalog.js";
import { analysisModelFor } from "../src/providers/provider-role.js";
import { customModelId } from "../src/product/connections/provider-connections.js";

test("OpenRouter auxiliary analysis follows the selected model; other provider overrides stay intact", () => {
  const providers = new ProviderCatalog();
  for (const model of ["openai/gpt-4o-mini", "anthropic/selected-model", "custom/selected-model"]) {
    assert.equal(analysisModelFor(providers.get("openrouter"), model), model);
  }
  assert.equal(analysisModelFor(providers.get("openai"), "selected"), "gpt-4o-mini");
});

test("Compose server and worker use the release version", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const compose = await readFile("docker-compose.yml", "utf8");
  const images = compose.split("\n").map(line => line.trim()).filter(line => line.startsWith("image:"));
  assert.deepEqual(images, Array(2).fill(`image: ghcr.io/albert-weasker/niubigeo:v${pkg.version}`));
});

test("default keyword executor runs through provider transport and invalid batches never write", async () => {
  const root = await mkdtemp(join(tmpdir(), "keyword-default-"));
  const old = process.env.PRODUCT_DATA_DIR;
  process.env.PRODUCT_DATA_DIR = root;
  const endpoint = "https://keyword-fixture.example/v1";
  const key = "fixture-keyword-secret";
  let calls = 0;
  // No recognitionExecutor or measurementExecutor: exercise production wiring.
  const server = createProductServer({modelCatalog: {async list() {return [];}}, customProviderFetch: async (url, init) => {
    assert.equal(url, endpoint + "/chat/completions");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer " + key);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "fixture-model");
    calls++;
    return new Response(JSON.stringify({choices: [{message: {content: JSON.stringify({mentions: []})}, finish_reason: "stop"}]}));
  }});
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const headers = {"Content-Type": "application/json", "X-Niubigeo-Connections": JSON.stringify([{baseUrl: endpoint, apiKey: key, models: ["fixture-model"]}])};
  const request = (path: string, method: string, body: unknown) => fetch(base + path, {method, headers, body: JSON.stringify(body)});
  try {
    const created = await request("/api/projects", "POST", {primaryDomain: "example.com"});
    const {project} = await created.json() as any;
    const path = "/api/projects/" + project.id;
    for (const body of [{keywords: []}, {keywords: ["   "]}, {keyword: "  "}, {keywords: ["valid keyword", " "]}, {keywords: [42]}, {keywords: "wrong", keyword: "valid fallback"}]) {
      const response = await request(path + "/keyword-monitors", "POST", body);
      assert.equal(response.status, 422, JSON.stringify(body));
    }
    const empty = await (await fetch(base + path + "/keyword-monitors")).json() as any;
    assert.deepEqual(empty.monitors, []);
    assert.equal(calls, 0);
    assert.equal((await request(path + "/models", "PUT", {selections: [{modelId: customModelId(endpoint, "fixture-model"), webSearchMode: "off"}]})).status, 200);
    assert.equal((await request(path + "/baselines", "POST", {})).status, 201);
    const added = await request(path + "/keyword-monitors", "POST", {keywords: ["best tools", "best tools"]});
    assert.equal(added.status, 201);
    const {monitors} = await added.json() as any;
    assert.equal(monitors.length, 1);
    const response = await request(path + "/keyword-monitors/" + monitors[0].id + "/run", "POST", {});
    assert.equal(response.status, 202);
    const {run} = await response.json() as any;
    assert.equal(run.status, "completed");
    assert.equal(calls, 1);
    const history = await (await fetch(base + path + "/keyword-monitors/" + monitors[0].id)).json() as any;
    assert.equal(history.runs[0].id, run.id);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (old === undefined) delete process.env.PRODUCT_DATA_DIR; else process.env.PRODUCT_DATA_DIR = old;
    await rm(root, {recursive: true, force: true});
  }
});

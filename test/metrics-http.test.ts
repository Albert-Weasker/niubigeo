import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { KeywordMonitorService } from "../src/product/keyword-monitor-service.js";
import { KeywordMonitorStore } from "../src/product/keyword-monitor-store.js";
import { createProductServer } from "../src/product/product-server.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";

async function metricsServer(t: TestContext, env: Record<string, string> = {}) {
  const root = await mkdtemp(join(tmpdir(), "metrics-http-"));
  const settings = {
    PRODUCT_DATA_DIR: root,
    METRICS_ENABLED: undefined,
    METRICS_TOKEN: undefined,
    METRICS_INCLUDE_NAMES: undefined,
    METRICS_CACHE_SECONDS: undefined,
    ...env,
  };
  const previous = Object.keys(settings).map(key => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const unexpected = async () => assert.fail("A metrics scrape must not call a provider");
  const server = createProductServer({
    modelCatalog: { list: unexpected },
    recognitionExecutor: { execute: unexpected },
    measurementExecutor: { execute: unexpected },
    keyValidationFetch: unexpected,
    customProviderFetch: unexpected,
  });
  t.after(async () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const store = new ProductProjectFileStore(root);
  const projects = new ProductProjectService(store);
  const monitors = new KeywordMonitorService(projects, new KeywordMonitorStore(store));
  const request = (path = "/metrics", init?: RequestInit) => fetch(`http://127.0.0.1:${address.port}${path}`, init);
  return { root, projects, monitors, request };
}

async function snapshot(dir: string): Promise<unknown[]> {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
  return Promise.all(entries.map(async entry => {
    const path = join(dir, entry.name);
    const { mtimeMs } = await stat(path);
    return [entry.name, mtimeMs, await (entry.isDirectory() ? snapshot(path) : readFile(path, "utf8"))];
  }));
}

test("/metrics is an unknown route by default", async t => {
  const { request } = await metricsServer(t);
  const [metrics, unknown] = await Promise.all([request(), request("/unknown-metrics-path")]);
  assert.equal(metrics.status, 404);
  assert.equal(metrics.headers.get("content-type"), unknown.headers.get("content-type"));
  assert.equal(await metrics.text(), await unknown.text());
});

test("/metrics requires the configured bearer credential, including on a cached scrape", async t => {
  const token = "metrics-test-credential";
  const { request } = await metricsServer(t, { METRICS_ENABLED: "true", METRICS_TOKEN: token });
  const authorized = await request("/metrics", { headers: { authorization: "Bearer " + token } });
  assert.equal(authorized.status, 200);
  assert.ok(!(await authorized.text()).includes(token));
  for (const init of [undefined, { headers: { authorization: "Bearer wrong" } }, { headers: { authorization: "Basic " + token } }]) {
    const response = await request("/metrics", init);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("www-authenticate"), "Bearer");
    await response.text();
  }
});

test("/metrics serves deterministic Prometheus text without names, credentials, or file writes", async t => {
  const dummyKeys = {
    OPENROUTER_API_KEY: "test-only-openrouter",
    OPENAI_API_KEY: "test-only-openai",
    ANTHROPIC_API_KEY: "test-only-anthropic",
    GEMINI_API_KEY: "test-only-gemini",
    PERPLEXITY_API_KEY: "test-only-perplexity",
    DEEPSEEK_API_KEY: "test-only-deepseek",
  };
  const { root, request, projects, monitors } = await metricsServer(t, { METRICS_ENABLED: "true", ...dummyKeys });
  const project = await projects.createDraft({ primaryDomain: "hidden.example" });
  const monitor = await monitors.create(project.id, { keyword: "Hidden keyword" });
  const before = await snapshot(root);
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; version=0.0.4; charset=utf-8");
  const body = await response.text();
  assert.ok(body.includes("# HELP niubigeo_projects Number of non-deleted projects.\n# TYPE niubigeo_projects gauge\nniubigeo_projects 1\n"));
  for (const text of [project.primaryDomain, monitor.keyword, "_project_info", "_keyword_monitor_info", "_model_info", ...Object.values(dummyKeys)]) {
    assert.ok(!body.includes(text));
  }
  assert.equal(await (await request()).text(), body);
  assert.deepEqual(await snapshot(root), before);
  await projects.createDraft({ primaryDomain: "second.example" });
  assert.equal(await (await request()).text(), body);
});

test("/metrics escapes opted-in names and refreshes between scrapes with a zero TTL", async t => {
  const { request, projects, monitors } = await metricsServer(t, {
    METRICS_ENABLED: "true", METRICS_INCLUDE_NAMES: "true", METRICS_CACHE_SECONDS: "0",
  });
  const empty = await (await request()).text();
  assert.ok(empty.includes("niubigeo_projects 0\n"));
  const project = await projects.createDraft({ primaryDomain: "visible.example" });
  await monitors.create(project.id, { keyword: 'A "quoted" keyword\\with a\nnewline' });
  const body = await (await request()).text();
  assert.ok(body.includes('niubigeo_project_info{domain="visible.example",'));
  assert.ok(body.includes(String.raw`keyword="A \"quoted\" keyword\\with a\nnewline"`));
  assert.ok(body.includes("niubigeo_projects 1\n"));
});

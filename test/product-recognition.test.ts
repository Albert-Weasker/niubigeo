import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { AnswerResult } from "../src/core/types.js";
import { sha256 } from "../src/utils/hash.js";
import { ProductBaselineService } from "../src/product/configuration/baseline-service.js";
import { ProductConfigurationFileStore } from "../src/product/configuration/configuration-store.js";
import { ProductModelSelectionService } from "../src/product/configuration/model-selection-service.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../src/product/configuration/model-selection-schema.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { RecognitionRunNotFoundError } from "../src/product/recognition/recognition-errors.js";
import { handleProductRecognitionApi, handleProductRecognitionRetryApi } from "../src/product/recognition/recognition-http.js";
import type { RecognitionAnswerExecutor } from "../src/product/recognition/recognition-service.js";
import { OpenRouterRecognitionAnswerExecutor, ProductRecognitionRunService } from "../src/product/recognition/recognition-service.js";
import { ProductRecognitionFileStore } from "../src/product/recognition/recognition-store.js";
import { ProviderRequestError } from "../src/providers/provider-error.js";

const fixtureModels: ProviderModelCatalogItem[] = [
  { providerId: "openrouter", modelId: "test/off", displayName: "Offline Model", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "openrouter_catalog" },
  { providerId: "openrouter", modelId: "test/native", displayName: "Native Search Model", available: true, unavailableReason: null, nativeWebSearchSupported: true, checkedAt: "2026-09-06T00:00:00.000Z", source: "openrouter_catalog" },
  { providerId: "openrouter", modelId: "test/failure", displayName: "Failure Model", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "openrouter_catalog" },
  { providerId: "openrouter", modelId: "test/unsupported", displayName: "Unsupported Model", available: true, unavailableReason: null, nativeWebSearchSupported: true, checkedAt: "2026-09-06T00:00:00.000Z", source: "openrouter_catalog" },
  { providerId: "openrouter", modelId: "test/partial", displayName: "Partial Model", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "openrouter_catalog" },
  { providerId: "openrouter", modelId: "test/unknown", displayName: "Unknown Model", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "openrouter_catalog" },
  { providerId: "openrouter", modelId: "test/ambiguous", displayName: "Ambiguous Model", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "openrouter_catalog" },
  { providerId: "openrouter", modelId: "test/truncated", displayName: "Truncated Model", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "openrouter_catalog" },
];

class FixtureCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    return fixtureModels.map((item) => ({ ...item }));
  }
}

function structuredAnswer(withCitation: boolean, analysisStatus: "recognized" | "partially_recognized" | "unknown" | "ambiguous" = "recognized"): string {
  return JSON.stringify({
    analysisStatus,
    domainRecognition: "recognized",
    recognizedBrand: { value: "Alpha", citationUrls: withCitation ? ["https://source.example/proof"] : [] },
    businessDescription: { value: "Workflow platform", citationUrls: withCitation ? ["https://source.example/proof"] : [] },
    productCategory: { value: "Collaboration software", citationUrls: [] },
    competitors: [{ name: "Beta", domain: "beta.example", businessDescription: "Alternative workflow platform", productCategory: "Collaboration software", keywords: [{ keyword: "team workflow", citationUrls: withCitation ? ["https://source.example/proof"] : [] }], citationUrls: withCitation ? ["https://source.example/proof"] : [] }],
    brandKeywords: [{ keyword: "project workflow", citationUrls: withCitation ? ["https://source.example/proof"] : [] }],
    unknowns: ["Ordinary URL: https://ordinary.example/mention"],
  });
}

function answer(model: string, withCitation: boolean): AnswerResult {
  const text = structuredAnswer(withCitation);
  return {
    providerId: "openrouter",
    providerName: "OpenRouter",
    sourceType: "api",
    sourceLabel: "Source: OpenRouter API",
    resultCaveat: "API result",
    model,
    modelVersion: model,
    text,
    structuredOutput: { transport: "response_json_schema", value: text },
    rawProviderResponse: { model, choices: [{ message: { content: text } }] },
    citations: withCitation
      ? [
          { id: "provider", url: "https://source.example/proof", domain: "source.example", title: "Proof", citationIndex: 0, source: "provider_annotation", citationType: "unknown", providerPayloadPath: "choices[0].message.annotations[0].url" },
          { id: "ordinary", url: "https://ordinary.example/mention", domain: "ordinary.example", citationIndex: 1, source: "answer_text_url", citationType: "unknown" },
        ]
      : [{ id: "ordinary", url: "https://ordinary.example/mention", domain: "ordinary.example", citationIndex: 0, source: "answer_text_url", citationType: "unknown" }],
    webQueries: withCitation ? ["alpha.example"] : [],
    search: {
      requested: withCitation,
      requestMode: "provider_native",
      used: withCitation,
      usedMode: withCitation ? "provider_native" : "none",
      endpointKind: "official_api",
      endpointProtocol: "chat_completions",
      endpointUrl: "https://provider.example",
      webQueries: withCitation ? ["alpha.example"] : [],
      citationCount: withCitation ? 1 : 0,
    },
    tokenUsage: { input: 11, output: 22, total: 33 },
    costUsd: 0.0001,
    latencyMs: 12,
    createdAt: "2026-09-06T00:00:00.000Z",
  };
}

class FixtureExecutor implements RecognitionAnswerExecutor {
  constructor(private readonly behavior: Map<string, "success" | "failure" | "unsupported" | "analysis_failed">) {}

  async execute(input: Parameters<RecognitionAnswerExecutor["execute"]>[0]): Promise<AnswerResult> {
    const kind = this.behavior.get(input.modelSnapshot.modelId) || "success";
    if (kind === "failure") throw new ProviderRequestError({ code: "upstream_unavailable", message: "fixture provider failure" });
    if (kind === "unsupported") throw new ProviderRequestError({ code: "unsupported_capability", message: "fixture model unsupported" });
    if (kind === "analysis_failed") return { ...answer(input.modelSnapshot.modelId, input.modelSnapshot.webSearchMode === "provider_native"), text: "not structured output", structuredOutput: undefined };
    return answer(input.modelSnapshot.modelId, input.modelSnapshot.webSearchMode === "provider_native");
  }
}

type Fixture = {
  root: string;
  projects: ProductProjectService;
  selections: ProductModelSelectionService;
  baselines: ProductBaselineService;
  recognitionStore: ProductRecognitionFileStore;
};

async function withFixture(callback: (fixture: Fixture) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-phase3-product-"));
  const projectStore = new ProductProjectFileStore(root);
  const projects = new ProductProjectService(projectStore);
  const configurationStore = new ProductConfigurationFileStore(projectStore);
  const selections = new ProductModelSelectionService(projects, configurationStore, new FixtureCatalog());
  const baselines = new ProductBaselineService(projects, selections, configurationStore);
  const recognitionStore = new ProductRecognitionFileStore(projectStore);
  try {
    await callback({ root, projects, selections, baselines, recognitionStore });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function readyProject(fixture: Fixture, domain: string, selections: Array<{ modelId: string; webSearchMode: "off" | "provider_native" }>): Promise<{ id: string }> {
  const project = await fixture.projects.createDraft({ primaryDomain: domain, defaultLanguage: "en" });
  await fixture.selections.replace(project.id, selections);
  await fixture.baselines.create(project.id);
  return project;
}

async function settled(service: ProductRecognitionRunService, projectId: string, runId: string) {
  for (let index = 0; index < 80; index += 1) {
    const detail = await service.get(projectId, runId);
    if (detail.run.status !== "queued" && detail.run.status !== "running") return detail;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Recognition run did not settle during the test.");
}

test("Phase 3 archives separate model recognition evidence and preserves it across a service restart", async () => {
  await withFixture(async (fixture) => {
    const first = await readyProject(fixture, "alpha.example", [
      { modelId: "test/off", webSearchMode: "off" },
      { modelId: "test/native", webSearchMode: "provider_native" },
    ]);
    const second = await readyProject(fixture, "beta.example", [{ modelId: "test/off", webSearchMode: "off" }]);
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, new FixtureExecutor(new Map()));
    const created = await service.start(first.id);
    const complete = await settled(service, first.id, created.run.id);

    assert.equal(complete.run.status, "completed");
    assert.equal(complete.run.successfulModelRunCount, 2);
    assert.equal(complete.modelRuns.length, 2);
    const offline = complete.modelRuns.find((item) => item.modelSnapshot.modelId === "test/off");
    const native = complete.modelRuns.find((item) => item.modelSnapshot.modelId === "test/native");
    assert.ok(offline);
    assert.ok(native);

    const offlineDetail = await service.getModelRun(first.id, created.run.id, offline.id);
    const nativeDetail = await service.getModelRun(first.id, created.run.id, native.id);
    assert.equal(offlineDetail.attempts.length, 1);
    assert.equal(offlineDetail.attempts[0]?.rawAnswer !== undefined, true);
    assert.equal(offlineDetail.attempts[0]?.rawProviderResponse !== undefined, true);
    assert.equal(offlineDetail.archive?.result.domainRecognition, "recognized");
    assert.equal(offlineDetail.archive?.providerCitations.length, 0);
    assert.equal(offlineDetail.archive?.answerMentionedUrls.length, 1);
    assert.equal(nativeDetail.archive?.providerCitations.length, 1);
    assert.equal(nativeDetail.archive?.answerMentionedUrls.length, 1);
    assert.equal(nativeDetail.archive?.claimCitationLinks.length > 0, true);
    assert.equal(nativeDetail.archive?.competitors[0]?.name, "Beta");
    assert.equal(nativeDetail.archive?.competitorKeywords[0]?.keyword, "team workflow");
    assert.equal(nativeDetail.archive?.brandKeywords[0]?.keyword, "project workflow");
    assert.notEqual(offlineDetail.archive?.competitors[0]?.id, nativeDetail.archive?.competitors[0]?.id);
    assert.equal(nativeDetail.archive?.result.businessDescription.evidence?.start !== undefined, true);
    assert.equal(nativeDetail.archive?.providerCitations.every((item) => item.projectId === first.id && item.runId === created.run.id && item.modelRunId === native.id), true);

    const restarted = new ProductRecognitionRunService(
      new ProductProjectService(new ProductProjectFileStore(fixture.root)),
      new ProductBaselineService(
        new ProductProjectService(new ProductProjectFileStore(fixture.root)),
        new ProductModelSelectionService(
          new ProductProjectService(new ProductProjectFileStore(fixture.root)),
          new ProductConfigurationFileStore(new ProductProjectFileStore(fixture.root)),
          new FixtureCatalog(),
        ),
        new ProductConfigurationFileStore(new ProductProjectFileStore(fixture.root)),
      ),
      new ProductRecognitionFileStore(new ProductProjectFileStore(fixture.root)),
      new FixtureExecutor(new Map()),
    );
    assert.equal((await restarted.get(first.id, created.run.id)).run.id, created.run.id);
    await assert.rejects(() => service.get(second.id, created.run.id), RecognitionRunNotFoundError);
  });
});

test("A recognition run creates one model run for every model in its saved monitoring configuration", async () => {
  await withFixture(async (fixture) => {
    const selections = fixtureModels.map((model) => ({
      modelId: model.modelId,
      webSearchMode: model.nativeWebSearchSupported ? "provider_native" as const : "off" as const,
    }));
    const project = await readyProject(fixture, "all-models.example", selections);
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, new FixtureExecutor(new Map()));

    const started = await service.start(project.id);
    const completed = await settled(service, project.id, started.run.id);

    assert.equal(started.modelRuns.length, selections.length);
    assert.equal(completed.run.plannedModelRunCount, selections.length);
    assert.equal(completed.modelRuns.length, selections.length);
    assert.equal(completed.run.status, "completed");
  });
});

test("Phase 3 records successful, unsupported, provider-failed, and analysis-failed model runs independently", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "mixed.example", [
      { modelId: "test/off", webSearchMode: "off" },
      { modelId: "test/failure", webSearchMode: "off" },
      { modelId: "test/unsupported", webSearchMode: "provider_native" },
      { modelId: "test/native", webSearchMode: "provider_native" },
    ]);
    const executor = new FixtureExecutor(new Map([
      ["test/failure", "failure"],
      ["test/unsupported", "unsupported"],
      ["test/native", "analysis_failed"],
    ]));
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, executor);
    const created = await service.start(project.id);
    const result = await settled(service, project.id, created.run.id);
    assert.equal(result.run.status, "partial");
    assert.equal(result.run.successfulModelRunCount, 2);
    assert.equal(result.modelRuns.find((item) => item.modelSnapshot.modelId === "test/off")?.status, "completed");
    assert.equal(result.modelRuns.find((item) => item.modelSnapshot.modelId === "test/failure")?.status, "failed");
    assert.equal(result.modelRuns.find((item) => item.modelSnapshot.modelId === "test/unsupported")?.status, "unsupported");
    const analysisFailure = result.modelRuns.find((item) => item.modelSnapshot.modelId === "test/native");
    assert.equal(analysisFailure?.status, "completed");
    const analysisDetail = await service.getModelRun(project.id, created.run.id, analysisFailure?.id || "");
    assert.equal(analysisDetail.attempts[0]?.rawAnswer, "not structured output");
    assert.equal(analysisDetail.archive?.result.analysisStatus, "analysis_failed");
  });
});

test("Phase 3 retry creates a new immutable attempt without overwriting the original provider error", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "retry.example", [{ modelId: "test/failure", webSearchMode: "off" }]);
    let calls = 0;
    const executor: RecognitionAnswerExecutor = {
      async execute(input) {
        calls += 1;
        if (calls === 1) throw new ProviderRequestError({ code: "upstream_unavailable", message: "first call failed" });
        return answer(input.modelSnapshot.modelId, false);
      },
    };
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, executor);
    const created = await service.start(project.id);
    const failed = await settled(service, project.id, created.run.id);
    const modelRun = failed.modelRuns[0];
    assert.ok(modelRun);
    assert.equal(modelRun.status, "failed");
    const retried = await service.retry(project.id, created.run.id, modelRun.id);
    assert.equal(retried.modelRun.status, "completed");
    assert.equal(retried.attempts.length, 2);
    assert.equal(retried.attempts[0]?.status, "provider_failed");
    assert.equal(retried.attempts[0]?.errorMessage, "first call failed");
    assert.equal(retried.attempts[1]?.status, "completed");
    assert.equal(retried.attempts[1]?.rawAnswer !== undefined, true);
    assert.equal((await service.get(project.id, created.run.id)).run.status, "completed");
  });
});

test("Phase 3 HTTP routes scope every run, model run, attempt archive, and retry to the owning project", async () => {
  await withFixture(async (fixture) => {
    const first = await readyProject(fixture, "http-alpha.example", [{ modelId: "test/off", webSearchMode: "off" }]);
    const second = await readyProject(fixture, "http-beta.example", [{ modelId: "test/off", webSearchMode: "off" }]);
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, new FixtureExecutor(new Map()));
    const created = await service.start(first.id);
    const complete = await settled(service, first.id, created.run.id);
    const modelRun = complete.modelRuns[0];
    assert.ok(modelRun);
    let sentStatus = 0;
    let sentBody: Record<string, unknown> = {};
    const send = (status: number, body: unknown) => {
      sentStatus = status;
      sentBody = body as Record<string, unknown>;
    };
    const firstRun = await handleProductRecognitionApi({ method: "GET", route: ["api", "projects", first.id, "recognition-runs", created.run.id], service, send });
    assert.equal(firstRun, true);
    assert.equal(sentStatus, 200);
    assert.equal((sentBody.run as { id: string }).id, created.run.id);
    const foreignRun = await handleProductRecognitionApi({ method: "GET", route: ["api", "projects", second.id, "recognition-runs", created.run.id], service, send });
    assert.equal(foreignRun, true);
    assert.equal(sentStatus, 404);
    const foreignModel = await handleProductRecognitionApi({ method: "GET", route: ["api", "projects", second.id, "recognition-runs", created.run.id, "model-runs", modelRun.id], service, send });
    assert.equal(foreignModel, true);
    assert.equal(sentStatus, 404);
    const attempt = (await service.getModelRun(first.id, created.run.id, modelRun.id)).attempts[0];
    assert.ok(attempt);
    const foreignAttempt = await handleProductRecognitionApi({ method: "GET", route: ["api", "projects", second.id, "recognition-runs", created.run.id, "model-runs", modelRun.id, "attempts", attempt.id], service, send });
    assert.equal(foreignAttempt, true);
    assert.equal(sentStatus, 404);
    const completedRetry = await handleProductRecognitionRetryApi({ method: "POST", route: ["api", "projects", first.id, "recognition-runs", created.run.id, "model-runs", modelRun.id, "retry"], service, send });
    assert.equal(completedRetry, true);
    assert.equal(sentStatus, 422);
  });
});

function contractOutput(status: "recognized" | "partially_recognized" | "unknown" | "ambiguous" = "recognized"): string {
  if (status === "unknown" || status === "ambiguous") {
    return JSON.stringify({
      analysisStatus: status,
      domainRecognition: "unknown",
      recognizedBrand: { value: null, citationUrls: [] },
      businessDescription: { value: null, citationUrls: [] },
      productCategory: { value: null, citationUrls: [] },
      competitors: [],
      brandKeywords: [],
      unknowns: status === "unknown" ? ["Identity is unknown."] : ["Two identities are plausible."],
    });
  }
  return JSON.stringify({
    analysisStatus: status,
    domainRecognition: "recognized",
    recognizedBrand: { value: "Contract Brand", citationUrls: ["https://provider.example/citation"] },
    businessDescription: { value: "中文业务描述 😀", citationUrls: ["https://provider.example/citation"] },
    productCategory: { value: status === "partially_recognized" ? null : "Contract category", citationUrls: [] },
    competitors: [
      { name: "Contract Rival One", domain: "rival-one.example", businessDescription: "First alternative", productCategory: "Alternative category", keywords: [{ keyword: "rival one keyword", citationUrls: ["https://provider.example/citation"] }], citationUrls: ["https://provider.example/citation"] },
      { name: "Contract Rival Two", domain: null, businessDescription: "Second alternative", productCategory: null, keywords: [{ keyword: "rival two keyword", citationUrls: [] }], citationUrls: [] },
    ],
    brandKeywords: [{ keyword: "contract keyword", citationUrls: ["https://provider.example/citation"] }, { keyword: "中文关键词", citationUrls: [] }],
    unknowns: ["Ordinary answer URL: https://ordinary.example/mention"],
  });
}

function contractAnswer(input: { model: string; native: boolean; status?: "recognized" | "partially_recognized" | "unknown" | "ambiguous"; malformed?: boolean; includeProviderCitation?: boolean; costUsd?: number | undefined }): AnswerResult {
  const text = contractOutput(input.status);
  const providerCitation = input.includeProviderCitation ?? input.native;
  return {
    providerId: "openrouter",
    providerName: "OpenRouter",
    sourceType: "api",
    sourceLabel: "Source: contract adapter",
    resultCaveat: "Test adapter response",
    model: input.model,
    modelVersion: input.model,
    text,
    structuredOutput: {
      transport: input.native ? "function_tool" : "response_json_schema",
      value: input.malformed ? `Explanation before JSON.\n${text}` : text,
    },
    rawProviderResponse: {
      choices: [{
        message: {
          annotations: providerCitation ? [{ url: "https://provider.example/citation", title: "Provider evidence" }] : [],
          content: text,
        },
      }],
    },
    citations: [
      ...(providerCitation ? [{ id: "provider", url: "https://provider.example/citation", domain: "provider.example", title: "Provider evidence", citationIndex: 0, source: "provider_annotation" as const, citationType: "unknown" as const, providerPayloadPath: "choices[0].message.annotations[0].url" }] : []),
      { id: "same-url-in-answer", url: "https://provider.example/citation", domain: "provider.example", citationIndex: 1, source: "answer_text_url" as const, citationType: "unknown" as const },
      { id: "ordinary-answer-url", url: "https://ordinary.example/mention", domain: "ordinary.example", citationIndex: 2, source: "answer_text_url" as const, citationType: "unknown" as const },
    ],
    webQueries: input.native ? ["contract.example"] : [],
    search: {
      requested: input.native,
      requestMode: input.native ? "provider_native" : "auto",
      used: input.native,
      usedMode: input.native ? "provider_native" : "none",
      endpointKind: "official_api",
      endpointProtocol: "chat_completions",
      endpointUrl: "https://provider.example",
      webQueries: input.native ? ["contract.example"] : [],
      citationCount: providerCitation ? 1 : 0,
    },
    tokenUsage: { input: 21, output: 34, total: 55 },
    costUsd: input.costUsd,
    latencyMs: 8,
    createdAt: "2026-09-06T00:00:00.000Z",
  };
}

function valueAtProviderPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  let index = 0;
  while (index < path.length) {
    const dot = path.indexOf(".", index);
    const bracket = path.indexOf("[", index);
    const next = dot === -1 ? bracket : bracket === -1 ? dot : Math.min(dot, bracket);
    if (next === -1) {
      const key = path.slice(index);
      return current && typeof current === "object" && !Array.isArray(current) ? (current as Record<string, unknown>)[key] : undefined;
    }
    if (next > index) {
      const key = path.slice(index, next);
      if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    if (path[next] === ".") {
      index = next + 1;
      continue;
    }
    const close = path.indexOf("]", next + 1);
    if (close === -1) return undefined;
    const numeric = path.slice(next + 1, close);
    const offset = Number(numeric);
    if (!Number.isInteger(offset) || !Array.isArray(current)) return undefined;
    current = current[offset];
    index = close + 1;
    if (path[index] === ".") index += 1;
  }
  return current;
}

test("S3-02 through S3-10 create immutable project-scoped runs with configuration snapshots and idempotency", async () => {
  await withFixture(async (fixture) => {
    const noConfigurationService = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, new FixtureExecutor(new Map()));
    const blank = await fixture.projects.createDraft({ primaryDomain: "blank.example", defaultLanguage: "en" });
    await assert.rejects(() => noConfigurationService.start(blank.id));
    assert.equal((await fixture.recognitionStore.listRuns(blank.id)).length, 0);

    const project = await readyProject(fixture, "contract-run.example", [
      { modelId: "test/off", webSearchMode: "off" },
      { modelId: "test/native", webSearchMode: "provider_native" },
    ]);
    const captured: Parameters<RecognitionAnswerExecutor["execute"]>[0][] = [];
    const executor: RecognitionAnswerExecutor = {
      async execute(input) {
        captured.push(input);
        return contractAnswer({ model: input.modelSnapshot.modelId, native: input.modelSnapshot.webSearchMode === "provider_native" });
      },
    };
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, executor);
    const [first, duplicate] = await Promise.all([
      service.start(project.id, "contract-idempotency-key"),
      service.start(project.id, "contract-idempotency-key"),
    ]);
    assert.equal(first.run.id, duplicate.run.id);
    assert.equal(first.modelRuns.length, 2);
    assert.equal((await fixture.recognitionStore.listRuns(project.id)).length, 1);
    await fixture.selections.replace(project.id, [{ modelId: "test/off", webSearchMode: "off" }]);
    const completed = await settled(service, project.id, first.run.id);
    assert.equal(completed.run.status, "completed");
    assert.equal(completed.run.plannedModelRunCount, 2);
    assert.equal(captured.length, 2);
    assert.equal(captured[0]?.baseline.modelSnapshots.length, 2);
    assert.equal(completed.modelRuns.every((row) => row.projectId === project.id && row.runId === first.run.id && row.attemptIds.length === 1), true);
  });
});

test("S3-11 through S3-18 preserve bounded requests, raw responses, and malformed analysis failures", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "contract-prompt.example", [
      { modelId: "test/off", webSearchMode: "off" },
      { modelId: "test/native", webSearchMode: "provider_native" },
    ]);
    const requests: Parameters<RecognitionAnswerExecutor["execute"]>[0][] = [];
    const executor: RecognitionAnswerExecutor = {
      async execute(input) {
        requests.push(input);
        return contractAnswer({ model: input.modelSnapshot.modelId, native: input.modelSnapshot.webSearchMode === "provider_native", malformed: input.modelSnapshot.modelId === "test/native" });
      },
    };
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, executor);
    const started = await service.start(project.id);
    const completed = await settled(service, project.id, started.run.id);
    const offline = completed.modelRuns.find((row) => row.modelSnapshot.modelId === "test/off");
    const malformed = completed.modelRuns.find((row) => row.modelSnapshot.modelId === "test/native");
    assert.ok(offline);
    assert.ok(malformed);
    assert.equal(requests.length, 2);
    const offlineRequest = requests.find((request) => request.modelSnapshot.modelId === "test/off");
    const nativeRequest = requests.find((request) => request.modelSnapshot.modelId === "test/native");
    assert.equal(offlineRequest?.requestParameters.webSearchEnabled, false);
    assert.equal(offlineRequest?.requestParameters.webSearchMode, "off");
    assert.equal(offlineRequest?.requestParameters.structuredOutputTransport, "response_json_schema");
    assert.equal(nativeRequest?.requestParameters.webSearchEnabled, true);
    assert.equal(nativeRequest?.requestParameters.webSearchMode, "provider_native");
    assert.equal(nativeRequest?.requestParameters.structuredOutputTransport, "response_json_schema");
    assert.equal(requests.every((request) => !request.prompt.includes("website-body-marker") && !request.prompt.includes("preset-competitor-marker") && !request.prompt.includes("history-marker")), true);
    assert.equal(requests.every((request) => !request.prompt.includes("Authorization") && !request.prompt.includes("OPENROUTER_API_KEY")), true);
    const malformedDetail = await service.getModelRun(project.id, started.run.id, malformed.id);
    assert.equal(malformed.status, "completed");
    assert.equal(malformedDetail.attempts[0]?.status, "analysis_failed");
    assert.equal(malformedDetail.attempts[0]?.rawAnswer !== undefined, true);
    assert.equal(malformedDetail.attempts[0]?.rawProviderResponse !== undefined, true);
    assert.equal(malformedDetail.archive?.result.analysisStatus, "analysis_failed");
    assert.equal(malformedDetail.archive?.result.domainRecognition, null);
  });
});

test("S3-19 through S3-30 persist all observation states and exact UTF-16 evidence without inference", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "contract-evidence.example", [
      { modelId: "test/off", webSearchMode: "off" },
      { modelId: "test/native", webSearchMode: "provider_native" },
    ]);
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, {
      async execute(input) {
        return contractAnswer({ model: input.modelSnapshot.modelId, native: input.modelSnapshot.webSearchMode === "provider_native" });
      },
    });
    const started = await service.start(project.id);
    const completed = await settled(service, project.id, started.run.id);
    const native = completed.modelRuns.find((row) => row.modelSnapshot.modelId === "test/native");
    assert.ok(native);
    const detail = await service.getModelRun(project.id, started.run.id, native.id);
    const archive = detail.archive;
    assert.ok(archive);
    assert.equal(archive.result.analysisStatus, "recognized");
    assert.equal(archive.competitors.length, 2);
    assert.equal(archive.competitors[1]?.domain, null);
    assert.equal(archive.brandKeywords[0]?.keyword, "contract keyword");
    assert.equal(archive.brandKeywords[0]?.normalizedKeyword, "contract keyword");
    assert.equal(archive.competitorKeywords.every((keyword) => keyword.competitorName.length > 0), true);
    const parentMatches = (entry: { projectId: string; runId: string; modelRunId: string; attemptId: string }) =>
      entry.projectId === project.id
        && entry.runId === started.run.id
        && entry.modelRunId === native.id
        && entry.attemptId === archive.result.attemptId;
    assert.equal(parentMatches(archive.result), true);
    assert.equal(archive.competitors.every(parentMatches), true);
    assert.equal(archive.brandKeywords.every(parentMatches), true);
    assert.equal(archive.competitorKeywords.every(parentMatches), true);
    assert.equal(archive.providerCitations.every(parentMatches), true);
    assert.equal(archive.answerMentionedUrls.every(parentMatches), true);
    assert.equal(archive.claimCitationLinks.every(parentMatches), true);
    const answer = detail.attempts[0]?.rawAnswer || "";
    const businessEvidence = archive.result.businessDescription.evidence;
    assert.ok(businessEvidence);
    assert.equal(businessEvidence.encoding, "utf16_code_unit");
    assert.equal(answer.slice(businessEvidence.start, businessEvidence.end), businessEvidence.quote);
    assert.equal(businessEvidence.quote, "中文业务描述 😀");
    const competitorEvidence = archive.competitors[0]?.evidence;
    const keywordEvidence = archive.competitorKeywords[0]?.evidence;
    assert.ok(competitorEvidence);
    assert.ok(keywordEvidence);
    assert.equal(answer.slice(competitorEvidence.start, competitorEvidence.end), competitorEvidence.quote);
    assert.equal(answer.slice(keywordEvidence.start, keywordEvidence.end), keywordEvidence.quote);
    const partialText = contractOutput("partially_recognized");
    const unknownText = contractOutput("unknown");
    const ambiguousText = contractOutput("ambiguous");
    assert.equal(partialText.includes('"productCategory":{"value":null'), true);
    assert.equal(unknownText.includes('"competitors":[]'), true);
    assert.equal(ambiguousText.includes('"analysisStatus":"ambiguous"'), true);
  });
});

test("S3-31 through S3-36 keep Provider Citations and ordinary answer URLs as separate evidence types", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "contract-citations.example", [
      { modelId: "test/off", webSearchMode: "off" },
      { modelId: "test/native", webSearchMode: "provider_native" },
    ]);
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, {
      async execute(input) {
        return contractAnswer({ model: input.modelSnapshot.modelId, native: input.modelSnapshot.webSearchMode === "provider_native" });
      },
    });
    const started = await service.start(project.id);
    const completed = await settled(service, project.id, started.run.id);
    const offline = completed.modelRuns.find((row) => row.modelSnapshot.modelId === "test/off");
    const native = completed.modelRuns.find((row) => row.modelSnapshot.modelId === "test/native");
    assert.ok(offline);
    assert.ok(native);
    const offlineArchive = (await service.getModelRun(project.id, started.run.id, offline.id)).archive;
    const nativeDetail = await service.getModelRun(project.id, started.run.id, native.id);
    const nativeArchive = nativeDetail.archive;
    assert.ok(offlineArchive);
    assert.ok(nativeArchive);
    assert.equal(offlineArchive.providerCitations.length, 0);
    assert.equal(offlineArchive.answerMentionedUrls.some((row) => row.url === "https://provider.example/citation"), true);
    assert.equal(nativeArchive.providerCitations.length, 1);
    assert.equal(nativeArchive.providerCitations[0]?.title, "Provider evidence");
    assert.equal(nativeArchive.providerCitations[0]?.providerPayloadPath, "choices[0].message.annotations[0].url");
    assert.equal(valueAtProviderPath(nativeDetail.attempts[0]?.rawProviderResponse, nativeArchive.providerCitations[0]?.providerPayloadPath || ""), nativeArchive.providerCitations[0]?.url);
    assert.equal(nativeArchive.answerMentionedUrls.filter((row) => row.url === "https://provider.example/citation").length, 1);
    assert.equal(nativeArchive.answerMentionedUrls.some((row) => row.url === "https://ordinary.example/mention"), true);
    assert.equal(nativeArchive.claimCitationLinks.every((row) => row.providerCitationId === nativeArchive.providerCitations[0]?.id), true);
    assert.equal(nativeArchive.claimCitationLinks.some((row) => row.claimType === "product_category"), false);
  });
});

test("S3-37 through S3-42 isolate failures and preserve immutable attempts, archives, and unknown cost", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "contract-retry.example", [
      { modelId: "test/off", webSearchMode: "off" },
      { modelId: "test/failure", webSearchMode: "off" },
      { modelId: "test/native", webSearchMode: "provider_native" },
    ]);
    let malformedCalls = 0;
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, {
      async execute(input) {
        if (input.modelSnapshot.modelId === "test/failure") throw new ProviderRequestError({ code: "upstream_unavailable", message: "Fixture provider failure" });
        if (input.modelSnapshot.modelId === "test/native") {
          malformedCalls += 1;
          return contractAnswer({ model: input.modelSnapshot.modelId, native: true, malformed: malformedCalls === 1 });
        }
        return contractAnswer({ model: input.modelSnapshot.modelId, native: false });
      },
    });
    const started = await service.start(project.id);
    const partial = await settled(service, project.id, started.run.id);
    assert.equal(partial.run.status, "partial");
    const completedModel = partial.modelRuns.find((row) => row.modelSnapshot.modelId === "test/off");
    const failedModel = partial.modelRuns.find((row) => row.modelSnapshot.modelId === "test/failure");
    const malformedModel = partial.modelRuns.find((row) => row.modelSnapshot.modelId === "test/native");
    assert.ok(completedModel);
    assert.ok(failedModel);
    assert.ok(malformedModel);
    assert.equal(completedModel.status, "completed");
    assert.equal(failedModel.status, "failed");
    assert.equal((await service.getModelRun(project.id, started.run.id, failedModel.id)).archive, undefined);
    const original = await service.getModelRun(project.id, started.run.id, malformedModel.id);
    const originalAttempt = original.attempts[0];
    const originalArchive = original.archive;
    assert.ok(originalAttempt);
    assert.ok(originalArchive);
    assert.equal(originalAttempt.costUsd, null);
    const originalHash = sha256(JSON.stringify({ attempt: originalAttempt, archive: originalArchive }));
    const retried = await service.retry(project.id, started.run.id, malformedModel.id);
    assert.equal(retried.attempts.length, 2);
    assert.equal(retried.attempts[0]?.id, originalAttempt.id);
    assert.equal(retried.attempts[1]?.attemptNumber, 2);
    const preserved = await service.getAttempt(project.id, started.run.id, malformedModel.id, originalAttempt.id);
    assert.equal(sha256(JSON.stringify({ attempt: preserved.attempt, archive: preserved.archive })), originalHash);
    const failureAfterRetry = await service.getModelRun(project.id, started.run.id, failedModel.id);
    assert.equal(failureAfterRetry.attempts.length, 1);
    assert.equal(failureAfterRetry.archive, undefined);
  });
});

test("S3-15, S3-25, and S3-26 preserve unsupported, partial, unknown, and ambiguous observations without inference", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "contract-states.example", [
      { modelId: "test/partial", webSearchMode: "off" },
      { modelId: "test/unknown", webSearchMode: "off" },
      { modelId: "test/ambiguous", webSearchMode: "off" },
    ]);
    const stateByModel = new Map<string, "partially_recognized" | "unknown" | "ambiguous">([
      ["test/partial", "partially_recognized"],
      ["test/unknown", "unknown"],
      ["test/ambiguous", "ambiguous"],
    ]);
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, {
      async execute(input) {
        const status = stateByModel.get(input.modelSnapshot.modelId);
        if (!status) throw new Error("Missing contract fixture state.");
        return contractAnswer({ model: input.modelSnapshot.modelId, native: false, status });
      },
    });
    const started = await service.start(project.id);
    const completed = await settled(service, project.id, started.run.id);
    const results = await Promise.all(completed.modelRuns.map(async (modelRun) => (await service.getModelRun(project.id, started.run.id, modelRun.id)).archive?.result));
    assert.equal(results.some((result) => result?.analysisStatus === "partially_recognized"), true);
    assert.equal(results.some((result) => result?.analysisStatus === "unknown"), true);
    assert.equal(results.some((result) => result?.analysisStatus === "ambiguous"), true);
    const unknownModel = completed.modelRuns.find((row) => row.modelSnapshot.modelId === "test/unknown");
    assert.ok(unknownModel);
    const unknownArchive = (await service.getModelRun(project.id, started.run.id, unknownModel.id)).archive;
    assert.ok(unknownArchive);
    assert.equal(unknownArchive.competitors.length, 0);
    assert.equal(unknownArchive.brandKeywords.length, 0);
    assert.equal(unknownArchive.competitorKeywords.length, 0);

    const unsupportedProject = await readyProject(fixture, "contract-unsupported.example", [{ modelId: "test/unsupported", webSearchMode: "provider_native" }]);
    const activeBaselineId = (await fixture.projects.get(unsupportedProject.id)).activeBaselineId;
    assert.ok(activeBaselineId);
    const baseline = await fixture.baselines.get(unsupportedProject.id, activeBaselineId);
    const invalidSnapshot = {
      ...baseline,
      modelSnapshots: baseline.modelSnapshots.map((snapshot) => ({ ...snapshot, nativeWebSearchSupported: false })),
    };
    await new ProductConfigurationFileStore(new ProductProjectFileStore(fixture.root)).saveBaseline(invalidSnapshot);
    let unsupportedCalls = 0;
    const unsupportedService = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, {
      async execute() {
        unsupportedCalls += 1;
        throw new Error("Unsupported snapshot must not call its provider.");
      },
    });
    const unsupportedStarted = await unsupportedService.start(unsupportedProject.id);
    const unsupportedCompleted = await settled(unsupportedService, unsupportedProject.id, unsupportedStarted.run.id);
    assert.equal(unsupportedCalls, 0);
    assert.equal(unsupportedCompleted.run.status, "failed");
    assert.equal(unsupportedCompleted.modelRuns[0]?.status, "unsupported");
    assert.equal((await unsupportedService.getModelRun(unsupportedProject.id, unsupportedStarted.run.id, unsupportedCompleted.modelRuns[0]?.id || "")).archive, undefined);
  });
});

test("truncated structured output retries with more tokens and succeeds", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "trunc.example", [{ modelId: "test/truncated", webSearchMode: "off" }]);
    let callCount = 0;
    const executor: RecognitionAnswerExecutor = {
      async execute(input) {
        callCount += 1;
        if (callCount === 1) {
          return {
            providerId: "openrouter",
            providerName: "OpenRouter",
            sourceType: "api",
            sourceLabel: "Source: OpenRouter API",
            resultCaveat: "Truncated",
            model: input.modelSnapshot.modelId,
            modelVersion: input.modelSnapshot.modelId,
            text: '{"analysisStatus":"recognized","domainRecognition":"recognized","recognizedBrand":{"value":"Alpha","citationUrls":[]},"businessDescription":{"value":"Test brand","citationUrls":[]},"productCategory":{"value":"Test category","citationUrls":[]},"competitors":[],"brandKeywords":[],"unknowns":[],',
            structuredOutput: { transport: "response_json_schema", value: '{"analysisStatus":"recognized","domainRecognition":"recognized","recognizedBrand":{"value":"Alpha","citationUrls":[]},"businessDescription":{"value":"Test brand","citationUrls":[]},"productCategory":{"value":"Test category","citationUrls":[]},"competitors":[],"brandKeywords":[],"unknowns":[],' },
            rawProviderResponse: { choices: [{ finish_reason: "length", native_finish_reason: "max_tokens" }] },
            citations: [],
            webQueries: [],
            tokenUsage: { input: 214, output: 900, total: 1114 },
            costUsd: 0.02357,
            latencyMs: 14348,
            createdAt: "2026-09-07T00:00:00.000Z",
          };
        }
        const maxTokens = input.requestParameters.maxTokens;
        assert.ok(maxTokens > 900, `Retry should use more tokens, got ${maxTokens}`);
        const text = structuredAnswer(false);
        return {
          providerId: "openrouter",
          providerName: "OpenRouter",
          sourceType: "api",
          sourceLabel: "Source: OpenRouter API",
          resultCaveat: "Retried",
          model: input.modelSnapshot.modelId,
          modelVersion: input.modelSnapshot.modelId,
          text,
          structuredOutput: { transport: "response_json_schema", value: text },
          rawProviderResponse: { choices: [{ finish_reason: "stop" }] },
          citations: [],
          webQueries: [],
          tokenUsage: { input: 214, output: 1500, total: 1714 },
          costUsd: 0.03,
          latencyMs: 8000,
          createdAt: "2026-09-07T00:00:01.000Z",
        };
      },
    };
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, executor);
    const created = await service.start(project.id);
    const result = await settled(service, project.id, created.run.id);
    assert.equal(callCount, 2, "Should have made exactly two calls (initial + retry)");
    assert.equal(result.run.status, "completed");
    assert.equal(result.modelRuns[0]?.status, "completed");
    assert.equal(result.modelRuns[0]?.attemptIds.length, 2, "Should have two attempts (truncated + retry)");
    const retryAttempt = await service.getAttempt(project.id, created.run.id, result.modelRuns[0]!.id, result.modelRuns[0]!.attemptIds[1]!);
    assert.equal(retryAttempt.attempt.status, "completed");
    assert.ok(retryAttempt.attempt.requestParameters.maxTokens > 900, "Retry attempt should have higher maxTokens");
  });
});

test("truncated Responses-style output retries when the provider uses uppercase token-limit metadata", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "trunc-response.example", [{ modelId: "test/truncated", webSearchMode: "off" }]);
    let callCount = 0;
    const executor: RecognitionAnswerExecutor = {
      async execute(input) {
        callCount += 1;
        if (callCount === 1) {
          return {
            providerId: "openrouter",
            providerName: "OpenRouter",
            sourceType: "api",
            sourceLabel: "Source: OpenRouter API",
            resultCaveat: "Truncated",
            model: input.modelSnapshot.modelId,
            modelVersion: input.modelSnapshot.modelId,
            text: "{\"analysisStatus\":\"recognized\",",
            structuredOutput: { transport: "response_json_schema", value: "{\"analysisStatus\":\"recognized\"," },
            rawProviderResponse: { status: "INCOMPLETE", incomplete_details: { reason: "MAX_OUTPUT_TOKENS" } },
            citations: [],
            webQueries: [],
            tokenUsage: { input: 100, output: 900, total: 1000 },
            costUsd: 0.01,
            latencyMs: 100,
            createdAt: "2026-09-07T00:00:00.000Z",
          };
        }
        assert.ok(input.requestParameters.maxTokens > 900);
        const text = structuredAnswer(false);
        return {
          providerId: "openrouter",
          providerName: "OpenRouter",
          sourceType: "api",
          sourceLabel: "Source: OpenRouter API",
          resultCaveat: "Retried",
          model: input.modelSnapshot.modelId,
          modelVersion: input.modelSnapshot.modelId,
          text,
          structuredOutput: { transport: "response_json_schema", value: text },
          rawProviderResponse: { status: "completed" },
          citations: [],
          webQueries: [],
          tokenUsage: { input: 100, output: 1000, total: 1100 },
          costUsd: 0.02,
          latencyMs: 100,
          createdAt: "2026-09-07T00:00:01.000Z",
        };
      },
    };
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, executor);
    const created = await service.start(project.id);
    const result = await settled(service, project.id, created.run.id);
    assert.equal(callCount, 2);
    assert.equal(result.modelRuns[0]?.status, "completed");
    assert.equal(result.modelRuns[0]?.attemptIds.length, 2);
  });
});

test("re-analysis of truncated attempt preserves truncation evidence", async () => {
  await withFixture(async (fixture) => {
    const project = await readyProject(fixture, "trunc2.example", [{ modelId: "test/truncated", webSearchMode: "off" }]);
    let callCount = 0;
    const executor: RecognitionAnswerExecutor = {
      async execute(input) {
        callCount += 1;
        if (callCount === 1) {
          return {
            providerId: "openrouter",
            providerName: "OpenRouter",
            sourceType: "api",
            sourceLabel: "Source: OpenRouter API",
            resultCaveat: "Truncated",
            model: input.modelSnapshot.modelId,
            modelVersion: input.modelSnapshot.modelId,
            text: '{"analysisStatus":"recognized","domainRecognition":"recognized","recognizedBrand":{"value":"Alpha","citationUrls":[]},"businessDescription":{"value":"Test","citationUrls":[]},"productCategory":{"value":"Cat","citationUrls":[]},"competitors":[],"brandKeywords":[],"unknowns":[],',
            structuredOutput: { transport: "response_json_schema", value: '{"analysisStatus":"recognized","domainRecognition":"recognized","recognizedBrand":{"value":"Alpha","citationUrls":[]},"businessDescription":{"value":"Test","citationUrls":[]},"productCategory":{"value":"Cat","citationUrls":[]},"competitors":[],"brandKeywords":[],"unknowns":[],' },
            rawProviderResponse: { choices: [{ finish_reason: "length", native_finish_reason: "max_tokens" }] },
            citations: [],
            webQueries: [],
            tokenUsage: { input: 214, output: 900, total: 1114 },
            costUsd: 0.02357,
            latencyMs: 14348,
            createdAt: "2026-09-07T00:00:00.000Z",
          };
        }
        return {
          providerId: "openrouter",
          providerName: "OpenRouter",
          sourceType: "api",
          sourceLabel: "Source: OpenRouter API",
          resultCaveat: "Retried",
          model: input.modelSnapshot.modelId,
          modelVersion: input.modelSnapshot.modelId,
          text: structuredAnswer(false),
          structuredOutput: { transport: "response_json_schema", value: structuredAnswer(false) },
          rawProviderResponse: { choices: [{ finish_reason: "stop" }] },
          citations: [],
          webQueries: [],
          tokenUsage: { input: 214, output: 1500, total: 1714 },
          costUsd: 0.03,
          latencyMs: 8000,
          createdAt: "2026-09-07T00:00:01.000Z",
        };
      },
    };
    const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, executor);
    const created = await service.start(project.id);
    const result = await settled(service, project.id, created.run.id);
    assert.equal(result.run.status, "completed");
    const modelRun = result.modelRuns[0];
    assert.ok(modelRun);
    const detail = await service.getModelRun(project.id, created.run.id, modelRun.id);
    assert.equal(detail.attempts.length, 2);
    const firstAttempt = detail.attempts[0];
    const retryAttempt = detail.attempts[1];
    assert.ok(firstAttempt);
    assert.ok(retryAttempt);
    assert.equal(firstAttempt.status, "response_saved");
    assert.equal(firstAttempt.errorCode, undefined);
    assert.ok(firstAttempt.rawAnswer?.includes('"analysisStatus"'));
    assert.ok(firstAttempt.rawProviderResponse !== null);
    assert.equal(firstAttempt.requestParameters.maxTokens, 900);
    assert.equal(retryAttempt.status, "completed");
    assert.ok(retryAttempt.requestParameters.maxTokens > 900, "Retry attempt should have higher maxTokens");
  });
});


test("empty structured responses reach bounded truncation recovery through the provider adapter", async (t) => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "fixture-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });
  for (const scenario of ["recovers", "still-truncated", "not-truncated"] as const) {
    await t.test(scenario, async (t) => {
      const budgets: number[] = [];
      t.mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
        assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-key");
        assert.equal(body.response_format.type, "json_schema");
        assert.deepEqual(body.provider, { require_parameters: true });
        assert.equal(body.preserveEmptyStructuredTruncation, undefined);
        budgets.push(body.max_tokens);
        const recovered = scenario === "recovers" && budgets.length === 2;
        return new Response(JSON.stringify({
          choices: [{
            finish_reason: recovered || scenario === "not-truncated" ? "stop" : "length",
            message: { content: recovered ? structuredAnswer(false) : null },
          }],
          usage: { prompt_tokens: 100, completion_tokens: body.max_tokens, total_tokens: 100 + body.max_tokens, cost: 0.001 },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      });
      const executor = new OpenRouterRecognitionAnswerExecutor();
      await withFixture(async (fixture) => {
        const project = await readyProject(fixture, "truncated.example", [{ modelId: "test/truncated", webSearchMode: "off" }]);
        const service = new ProductRecognitionRunService(fixture.projects, fixture.baselines, fixture.recognitionStore, executor);
        const started = await service.start(project.id);
        const result = await settled(service, project.id, started.run.id);
        const modelRun = result.modelRuns[0];
        assert.ok(modelRun);
        const detail = await service.getModelRun(project.id, started.run.id, modelRun.id);
        if (scenario === "not-truncated") {
          assert.deepEqual(budgets, [900]);
          assert.equal(modelRun.status, "failed");
          assert.equal(detail.attempts[0]?.errorCode, "empty_answer");
        } else {
          assert.deepEqual(budgets, [900, 2000]);
          assert.equal(modelRun.status, "completed");
          assert.equal(detail.attempts.find((attempt) => attempt.attemptNumber === 2)?.status, scenario === "recovers" ? "completed" : "analysis_failed");
          assert.equal(detail.attempts.length, 2);
          const initial = detail.attempts.find((attempt) => attempt.attemptNumber === 1);
          assert.ok(initial);
          assert.equal(initial.rawAnswer, "");
          assert.equal(initial.tokenUsage?.output, 900);
          assert.equal(initial.costUsd, 0.001);
          assert.equal(initial.providerId, "openrouter");
          assert.ok(initial.providerSearch && typeof initial.providerSearch === "object" && "requested" in initial.providerSearch);
          assert.equal(initial.providerSearch.requested, false);
          assert.equal(detail.archive?.result.analysisStatus, scenario === "recovers" ? "recognized" : "analysis_failed");
          assert.deepEqual(initial.rawProviderResponse, {
            choices: [{ finish_reason: "length", message: { content: null } }],
            usage: { prompt_tokens: 100, completion_tokens: 900, total_tokens: 1000, cost: 0.001 },
          });
        }
      });
    });
  }
});

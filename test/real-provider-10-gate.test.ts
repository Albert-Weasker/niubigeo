import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnswerResult } from "../src/core/types.js";
import type { ProductBaseline, ProductModelSnapshot } from "../src/product/configuration/baseline-schema.js";
import type { RecognitionAnswerExecutor } from "../src/product/recognition/recognition-service.js";
import { LedgeredRecognitionExecutor, assertNativeSearchSmoke, createLedger, type CatalogModel, type ProviderLedger } from "../scripts/real-provider-10-support.js";

test("real Provider native-search gate accepts only completed, cited native execution", () => {
  assert.doesNotThrow(() => assertNativeSearchSmoke({
    modelId: "vendor/model",
    modelRunStatus: "completed",
    rawAnswer: "{\"domainRecognition\":\"recognized\"}",
    search: { requested: true, used: true, executionMode: "native", citationCount: 1 },
  }));
});

test("real Provider native-search gate blocks failed, unsearched, unverified, and uncited results", () => {
  const records = [
    { modelRunStatus: "failed", rawAnswer: undefined, search: undefined },
    { modelRunStatus: "completed", rawAnswer: "answer", search: { requested: true, used: false, executionMode: "unverified", citationCount: 0 } },
    { modelRunStatus: "completed", rawAnswer: "answer", search: { requested: true, used: true, executionMode: "sdk", citationCount: 1 } },
    { modelRunStatus: "completed", rawAnswer: "answer", search: { requested: true, used: true, executionMode: "native", citationCount: 0 } },
  ];
  for (const record of records) {
    assert.throws(() => assertNativeSearchSmoke({ modelId: "vendor/model", ...record }));
  }
});

test("real Provider ledger associates a request with its immutable execution records and raw archive", async () => {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-ledger-"));
  const ledgerPath = join(root, "provider-ledger.json");
  const model: CatalogModel = {
    modelId: "vendor/model",
    displayName: "Vendor Model",
    supportedParameters: ["response_format"],
    pricing: { promptPerToken: 0.000001, completionPerToken: 0.000002, webSearchPerRequest: 0 },
  };
  const snapshot: ProductModelSnapshot = {
    selectionId: "selection-1",
    providerId: "openrouter",
    modelId: model.modelId,
    displayName: model.displayName,
    webSearchMode: "off",
    nativeWebSearchSupported: false,
    capabilityCheckedAt: "2026-09-07T00:00:00.000Z",
  };
  const baseline = {
    id: "baseline-1",
    projectId: "project-1",
    version: 1,
    normalizedDomain: "target.example",
    recognitionProtocol: { protocolId: "domain-recognition", protocolVersion: "v1", inputType: "domain_only", requestedFields: ["domainRecognition", "brandIdentity", "businessDescription", "productCategory", "competitors", "brandKeywords", "competitorKeywords", "citations", "unknowns"], promptTemplateHash: "protocol-hash" },
    modelSnapshots: [snapshot],
    language: "en",
    analysisVersion: "recognition-analysis/v1",
    configHash: "config-hash",
    createdAt: "2026-09-07T00:00:00.000Z",
  } satisfies ProductBaseline;
  const delegate: RecognitionAnswerExecutor = {
    async execute(): Promise<AnswerResult> {
      return {
        providerId: "openrouter",
        providerName: "OpenRouter",
        sourceType: "api",
        sourceLabel: "OpenRouter API",
        resultCaveat: "test fixture",
        model: model.modelId,
        modelVersion: model.modelId,
        text: "A provider response.",
        rawProviderResponse: { id: "provider-request-1", answer: "A provider response." },
        citations: [],
        webQueries: [],
        latencyMs: 1,
        createdAt: "2026-09-07T00:00:00.000Z",
      };
    },
  };
  await (await import("../scripts/real-provider-10-support.js")).writeJson(ledgerPath, createLedger());
  const executor = new LedgeredRecognitionExecutor(
    ledgerPath,
    new Map([[model.modelId, model]]),
    new Map([[baseline.projectId, { caseId: "CASE-1", projectId: baseline.projectId }]]),
    new Map([[baseline.projectId, "manual_measurement"]]),
    undefined,
    delegate,
  );
  await executor.execute({
    baseline,
    modelSnapshot: snapshot,
    prompt: "Measure target.example.",
    requestParameters: { model: model.modelId, temperature: 0, maxTokens: 10, responseSchemaName: "schema", responseSchemaHash: "schema-hash", structuredOutputTransport: "response_json_schema", requireProviderParameters: true, webSearchEnabled: false, webSearchMode: "off" },
    executionContext: { projectId: baseline.projectId, runId: "run-1", modelRunId: "model-run-1", probeRunId: "probe-1", attemptId: "attempt-1" },
  });
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8")) as ProviderLedger;
  assert.equal(ledger.entries.length, 1);
  const entry = ledger.entries[0];
  assert.equal(entry?.runId, "run-1");
  assert.equal(entry?.modelRunId, "model-run-1");
  assert.equal(entry?.probeRunId, "probe-1");
  assert.equal(entry?.attemptId, "attempt-1");
  assert.ok(entry?.promptHash);
  assert.ok(entry?.rawEvidencePath);
  const archive = JSON.parse(await readFile(join(process.cwd(), entry?.rawEvidencePath || ""), "utf8")) as { rawAnswer: string; attemptId: string };
  assert.equal(archive.rawAnswer, "A provider response.");
  assert.equal(archive.attemptId, "attempt-1");
  await rm(root, { recursive: true, force: true });
});

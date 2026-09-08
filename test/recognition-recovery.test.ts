import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { AnswerResult } from "../src/core/types.js";
import { ProductBaselineService } from "../src/product/configuration/baseline-service.js";
import { ProductConfigurationFileStore } from "../src/product/configuration/configuration-store.js";
import { ProductModelSelectionService } from "../src/product/configuration/model-selection-service.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../src/product/configuration/model-selection-schema.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { RecognitionAnalysisError } from "../src/product/recognition/recognition-errors.js";
import type { RecognitionAnswerExecutor } from "../src/product/recognition/recognition-service.js";
import { ProductRecognitionRunService } from "../src/product/recognition/recognition-service.js";
import { ProductRecognitionFileStore } from "../src/product/recognition/recognition-store.js";
import { parseStructuredRecognitionOutput } from "../src/product/recognition/structured-recognition-output.js";
import { sha256 } from "../src/utils/hash.js";

const recoveryModel: ProviderModelCatalogItem = {
  providerId: "openrouter",
  modelId: "fixture/recovery",
  displayName: "Recovery fixture",
  available: true,
  unavailableReason: null,
  nativeWebSearchSupported: true,
  checkedAt: "2026-09-07T00:00:00.000Z",
  source: "openrouter_catalog",
};

class RecoveryCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    return [{ ...recoveryModel }];
  }
}

function archivedCompatibilityAnswer(): string {
  return JSON.stringify({
    domain: "recovery.example",
    brand: "Recovered Brand",
    business: "A provider supplied business description",
    category: "A provider supplied category",
    description: "A detailed provider supplied description",
    keywords: ["keyword one", "keyword two", "keyword three", "keyword four", "keyword five", "keyword six", "keyword seven", "keyword eight"],
    competitors: [],
    citations: ["https://provider.example/one"],
  });
}

function currentOutput(input: { domainRecognition?: "recognized" | "not_recognized" | "unknown"; invalidKeyword?: boolean; conflicts?: boolean } = {}): Record<string, unknown> {
  const structured: Record<string, unknown> = {
    domainRecognition: input.domainRecognition || "recognized",
    analysisStatus: "recognized",
    recognizedBrand: { value: "Current Brand", citationUrls: [] },
    businessDescription: { value: "Current business", citationUrls: [] },
    productCategory: { value: "Current category", citationUrls: [] },
    competitors: [],
    brandKeywords: input.invalidKeyword ? [{ keyword: 7, citationUrls: [] }] : [{ keyword: "Current keyword", citationUrls: [] }],
    unknowns: [],
  };
  if (input.conflicts) structured.brand = "Conflicting compatibility brand";
  return structured;
}

function answer(text: string): AnswerResult {
  return {
    providerId: "openrouter",
    providerName: "OpenRouter",
    sourceType: "api",
    sourceLabel: "Source: recovery fixture",
    resultCaveat: "A local recovery fixture",
    model: recoveryModel.modelId,
    modelVersion: recoveryModel.modelId,
    text,
    rawProviderResponse: {
      choices: [{
        finish_reason: "stop",
        message: {
          content: text,
          annotations: [{ url: "https://provider.example/one", title: "Provider source" }],
        },
      }],
    },
    citations: [
      {
        id: "provider-source",
        url: "https://provider.example/one",
        domain: "provider.example",
        title: "Provider source",
        citationIndex: 0,
        source: "provider_annotation",
        citationType: "unknown",
        providerPayloadPath: "choices[0].message.annotations[0].url",
      },
    ],
    webQueries: [],
    search: {
      requested: true,
      requestMode: "provider_native",
      used: true,
      usedMode: "provider_native",
      endpointKind: "official_api",
      endpointProtocol: "chat_completions",
      endpointUrl: "https://provider.example",
      webQueries: [],
      citationCount: 1,
    },
    tokenUsage: { input: 10, output: 20, total: 30 },
    costUsd: 0.0002,
    latencyMs: 10,
    createdAt: "2026-09-07T00:00:00.000Z",
  };
}

async function settled(service: ProductRecognitionRunService, projectId: string, runId: string) {
  for (let index = 0; index < 80; index += 1) {
    const detail = await service.get(projectId, runId);
    if (detail.run.status !== "queued" && detail.run.status !== "running") return detail;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Recovery fixture run did not settle.");
}

test("Compatibility output keeps recoverable fields and never infers the missing domain-recognition claim", () => {
  const output = parseStructuredRecognitionOutput(`\`\`\`json\n${archivedCompatibilityAnswer()}\n\`\`\``);
  assert.equal(output.mappingVersion, "recognition-compatibility/v1");
  assert.equal(output.domainRecognition, null);
  assert.equal(output.recognizedBrand.value, "Recovered Brand");
  assert.equal(output.businessDescription.value, "A provider supplied business description");
  assert.equal(output.productCategory.value, "A provider supplied category");
  assert.equal(output.detailedDescription.value, "A detailed provider supplied description");
  assert.equal(output.brandKeywords.length, 8);
  assert.equal(output.competitors.length, 0);
  assert.equal(output.fieldIssues.some((issue) => issue.field === "domainRecognition" && issue.kind === "missing_field"), true);
  assert.equal(output.fieldIssues.some((issue) => issue.field === "competitors"), false);
});

test("Current output preserves explicit unknown, partial fields, conflicts, and malformed text without substitution", () => {
  const unknown = parseStructuredRecognitionOutput(currentOutput({ domainRecognition: "unknown" }));
  assert.equal(unknown.domainRecognition, "unknown");
  assert.equal(unknown.fieldIssues.length, 0);

  const partial = parseStructuredRecognitionOutput(currentOutput({ invalidKeyword: true }));
  assert.equal(partial.recognizedBrand.value, "Current Brand");
  assert.equal(partial.brandKeywords.length, 0);
  assert.equal(partial.fieldIssues.some((issue) => issue.field === "brandKeywords[0].keyword"), true);

  const conflict = parseStructuredRecognitionOutput(currentOutput({ conflicts: true }));
  assert.equal(conflict.recognizedBrand.value, "Current Brand");
  assert.equal(conflict.fieldIssues.some((issue) => issue.kind === "conflicting_field"), true);

  assert.throws(() => parseStructuredRecognitionOutput("{\"domainRecognition\":"), RecognitionAnalysisError);
});

test("Reanalysis appends an immutable local revision and does not create another Provider call", async () => {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-recognition-recovery-"));
  const projectStore = new ProductProjectFileStore(root);
  const projects = new ProductProjectService(projectStore);
  const configurationStore = new ProductConfigurationFileStore(projectStore);
  const selections = new ProductModelSelectionService(projects, configurationStore, new RecoveryCatalog());
  const baselines = new ProductBaselineService(projects, selections, configurationStore);
  const store = new ProductRecognitionFileStore(projectStore);
  let calls = 0;
  const executor: RecognitionAnswerExecutor = {
    async execute() {
      calls += 1;
      return { ...answer(archivedCompatibilityAnswer()), structuredOutput: undefined };
    },
  };
  try {
    const project = await projects.createDraft({ primaryDomain: "recovery.example", defaultLanguage: "en" });
    await selections.replace(project.id, [{ modelId: recoveryModel.modelId, webSearchMode: "provider_native" }]);
    await baselines.create(project.id);
    const service = new ProductRecognitionRunService(projects, baselines, store, executor);
    const started = await service.start(project.id);
    const completed = await settled(service, project.id, started.run.id);
    const modelRun = completed.modelRuns[0];
    assert.ok(modelRun);
    const before = await service.getModelRun(project.id, started.run.id, modelRun.id);
    const sourceAttempt = before.attempts[0];
    assert.ok(sourceAttempt);
    assert.equal(calls, 1);
    assert.equal(before.presentation.localAnalysis, "failed");
    assert.equal(before.presentation.primaryAction, "reanalyze_saved_answer");
    const sourceArchive = await store.readArchive(project.id, started.run.id, modelRun.id, sourceAttempt.id);
    assert.ok(sourceArchive);
    const sourceHash = sha256(JSON.stringify(sourceArchive));

    const firstRevision = await service.reanalyze(project.id, started.run.id, modelRun.id, sourceAttempt.id);
    const repeatedRevision = await service.reanalyze(project.id, started.run.id, modelRun.id, sourceAttempt.id);
    assert.equal(calls, 1);
    assert.equal(firstRevision.id, repeatedRevision.id);
    assert.equal(firstRevision.status, "partial");
    assert.equal(firstRevision.archive.result.domainRecognition, null);
    assert.equal(firstRevision.archive.result.recognizedBrand.value, "Recovered Brand");
    assert.equal(firstRevision.archive.result.detailedDescription?.value, "A detailed provider supplied description");
    assert.equal(firstRevision.archive.brandKeywords.length, 8);
    assert.equal(firstRevision.archive.competitors.length, 0);
    assert.equal(firstRevision.archive.providerCitations.length, 1);
    assert.equal(firstRevision.archive.answerMentionedUrls.length, 0);
    assert.equal(sha256(JSON.stringify(await store.readArchive(project.id, started.run.id, modelRun.id, sourceAttempt.id))), sourceHash);

    const recovered = await service.getModelRun(project.id, started.run.id, modelRun.id);
    assert.equal(recovered.analysisRevisions.length, 1);
    assert.equal(recovered.presentation.localAnalysis, "partial");
    assert.equal(recovered.presentation.domainRecognition, null);
    assert.equal(recovered.presentation.primaryAction, "none");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProductBaselineService } from "../src/product/configuration/baseline-service.js";
import { ProductBaselineConflictError, ProductBaselineNotFoundError, ProductConfigurationInputError, ProductModelCatalogUnavailableError } from "../src/product/configuration/configuration-errors.js";
import { handleProductConfigurationApi } from "../src/product/configuration/configuration-http.js";
import { ProductConfigurationFileStore } from "../src/product/configuration/configuration-store.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../src/product/configuration/model-selection-schema.js";
import { ProductModelSelectionService } from "../src/product/configuration/model-selection-service.js";
import { monitoringConfigurationState } from "../src/product/configuration/monitoring-configuration-state.js";
import { recognitionProtocolSnapshot } from "../src/product/configuration/recognition-protocol.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { renderProductPhase2AppHtml } from "../src/ui/product-phase2-app.js";

const fixtureModels: ProviderModelCatalogItem[] = [
  {
    providerId: "openrouter",
    modelId: "test/native-alpha",
    displayName: "Native Alpha",
    available: true,
    unavailableReason: null,
    nativeWebSearchSupported: true,
    checkedAt: "2026-09-06T00:00:00.000Z",
    source: "openrouter_catalog",
  },
  {
    providerId: "openrouter",
    modelId: "test/native-beta",
    displayName: "Native Beta",
    available: true,
    unavailableReason: null,
    nativeWebSearchSupported: true,
    checkedAt: "2026-09-06T00:00:00.000Z",
    source: "openrouter_catalog",
  },
  {
    providerId: "openrouter",
    modelId: "test/off-only",
    displayName: "Offline Only",
    available: true,
    unavailableReason: null,
    nativeWebSearchSupported: false,
    checkedAt: "2026-09-06T00:00:00.000Z",
    source: "openrouter_catalog",
  },
];

class IsolatedCatalog implements ProductModelCatalog {
  constructor(private readonly models: ProviderModelCatalogItem[], private readonly failure?: string) {}

  async list(): Promise<ProviderModelCatalogItem[]> {
    if (this.failure) throw new ProductModelCatalogUnavailableError(this.failure);
    return this.models.map((model) => ({ ...model }));
  }
}

type ProductConfigurationFixture = {
  root: string;
  projects: ProductProjectService;
  selections: ProductModelSelectionService;
  baselines: ProductBaselineService;
  store: ProductConfigurationFileStore;
  catalog: ProductModelCatalog;
};

async function withFixture(callback: (fixture: ProductConfigurationFixture) => Promise<void>, catalog: ProductModelCatalog = new IsolatedCatalog(fixtureModels)): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-phase2-product-"));
  const projectStore = new ProductProjectFileStore(root);
  const projects = new ProductProjectService(projectStore);
  const store = new ProductConfigurationFileStore(projectStore);
  const selections = new ProductModelSelectionService(projects, store, catalog);
  const baselines = new ProductBaselineService(projects, selections, store);
  try {
    await callback({ root, projects, selections, baselines, store, catalog });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function selectedModels(): Array<{ modelId: string; webSearchMode: "off" | "provider_native" }> {
  return [
    { modelId: "test/native-alpha", webSearchMode: "provider_native" },
    { modelId: "test/native-beta", webSearchMode: "off" },
  ];
}

test("Phase 2 saves model selections atomically, independently, and across a fresh service instance", async () => {
  await withFixture(async ({ root, projects, selections, store, catalog }) => {
    const first = await projects.createDraft({ primaryDomain: "alpha.example", name: "Alpha" });
    const second = await projects.createDraft({ primaryDomain: "beta.example", name: "Beta" });

    const saved = await selections.replace(first.id, selectedModels());
    assert.equal(saved.length, 2);
    assert.equal(saved[0]?.webSearchMode, "provider_native");
    assert.equal(saved[1]?.webSearchMode, "off");
    assert.deepEqual(await selections.list(second.id), []);

    await assert.rejects(
      () => selections.replace(first.id, [{ modelId: "test/off-only", webSearchMode: "provider_native" }]),
      ProductConfigurationInputError,
    );
    assert.deepEqual(
      (await selections.list(first.id)).map((selection) => [selection.modelId, selection.webSearchMode]),
      [["test/native-alpha", "provider_native"], ["test/native-beta", "off"]],
    );

    const restartedProjects = new ProductProjectService(new ProductProjectFileStore(root));
    const restartedStore = new ProductConfigurationFileStore(new ProductProjectFileStore(root));
    const restartedSelections = new ProductModelSelectionService(restartedProjects, restartedStore, catalog);
    assert.deepEqual(
      (await restartedSelections.list(first.id)).map((selection) => [selection.modelId, selection.webSearchMode]),
      [["test/native-alpha", "provider_native"], ["test/native-beta", "off"]],
    );
    const persisted = JSON.parse(await readFile(join(root, "projects", first.id, "model-selections.json"), "utf8")) as Array<{ projectId: string }>;
    assert.equal(persisted.length, 2);
    assert.equal(persisted.every((selection) => selection.projectId === first.id), true);
    assert.deepEqual(await store.readModelSelections(second.id), []);
  });
});

test("Phase 2 preserves immutable baseline snapshots and increments only after a changed configuration", async () => {
  await withFixture(async ({ projects, selections, baselines }) => {
    const first = await projects.createDraft({ primaryDomain: "snapshot.example", defaultLanguage: "zh-CN" });
    const second = await projects.createDraft({ primaryDomain: "other.example", defaultLanguage: "en" });

    await assert.rejects(() => baselines.create(first.id), ProductConfigurationInputError);
    await selections.replace(first.id, selectedModels());
    const versionOne = await baselines.create(first.id);
    assert.equal(versionOne.version, 1);
    assert.equal(versionOne.normalizedDomain, "snapshot.example");
    assert.equal(versionOne.language, "zh");
    assert.deepEqual(versionOne.recognitionProtocol, recognitionProtocolSnapshot());
    assert.deepEqual(
      versionOne.modelSnapshots.map((model) => [model.modelId, model.webSearchMode]),
      [["test/native-alpha", "provider_native"], ["test/native-beta", "off"]],
    );
    assert.equal((await projects.get(first.id)).activeBaselineId, versionOne.id);

    await assert.rejects(() => baselines.create(first.id), ProductBaselineConflictError);
    await selections.replace(first.id, [
      { modelId: "test/native-alpha", webSearchMode: "off" },
      { modelId: "test/native-beta", webSearchMode: "off" },
    ]);
    const versionTwo = await baselines.create(first.id);
    assert.equal(versionTwo.version, 2);
    assert.equal((await projects.get(first.id)).activeBaselineId, versionTwo.id);
    const reloadedOne = await baselines.get(first.id, versionOne.id);
    assert.equal(reloadedOne.modelSnapshots[0]?.webSearchMode, "provider_native");
    assert.equal(versionTwo.modelSnapshots[0]?.webSearchMode, "off");

    await selections.replace(first.id, [
      { modelId: "test/native-alpha", webSearchMode: "off" },
      { modelId: "test/native-beta", webSearchMode: "off" },
    ]);
    await assert.rejects(() => baselines.create(first.id), ProductBaselineConflictError);

    await selections.replace(second.id, [
      { modelId: "test/native-alpha", webSearchMode: "off" },
      { modelId: "test/native-beta", webSearchMode: "off" },
    ]);
    const secondProjectBaseline = await baselines.create(second.id);
    assert.equal(secondProjectBaseline.version, 1);
    assert.notEqual(secondProjectBaseline.id, versionTwo.id);
    await assert.rejects(() => baselines.get(first.id, secondProjectBaseline.id), ProductBaselineNotFoundError);
  });
});

test("monitoring configuration state distinguishes saved, changed, and domain protocol differences", async () => {
  await withFixture(async ({ projects, selections, baselines }) => {
    const project = await projects.createDraft({ primaryDomain: "state.example", defaultLanguage: "zh-CN" });
    assert.equal((await baselines.currentConfiguration(project.id)).status, "no_version");

    await selections.replace(project.id, selectedModels());
    const versionOne = await baselines.create(project.id);
    const unchanged = await baselines.currentConfiguration(project.id);
    assert.equal(unchanged.status, "unchanged");
    assert.equal(unchanged.currentVersion, 1);
    assert.equal(unchanged.nextVersion, 2);

    await selections.replace(project.id, [
      { modelId: "test/native-alpha", webSearchMode: "off" },
      { modelId: "test/off-only", webSearchMode: "off" },
    ]);
    const changed = await baselines.currentConfiguration(project.id);
    assert.equal(changed.status, "changed");
    assert.deepEqual(changed.diff.addedModels.map((item) => item.modelId), ["test/off-only"]);
    assert.deepEqual(changed.diff.removedModels.map((item) => item.modelId), ["test/native-beta"]);
    assert.deepEqual(changed.diff.webSearchModeChanges.map((item) => [item.modelId, item.previousMode, item.currentMode]), [["test/native-alpha", "provider_native", "off"]]);

    const updatedProject = await projects.update(project.id, { primaryDomain: "state-next.example", defaultLanguage: "en" });
    const projectDifference = monitoringConfigurationState({
      project: updatedProject,
      baselines: [versionOne],
      selections: await selections.list(project.id),
    });
    assert.deepEqual(projectDifference.diff.domainChange, { previous: "state.example", current: "state-next.example" });
    assert.deepEqual(projectDifference.diff.languageChange, { previous: "zh", current: "en" });

    const protocolDifference = monitoringConfigurationState({
      project: await projects.get(project.id),
      baselines: [{ ...versionOne, recognitionProtocol: { ...versionOne.recognitionProtocol, protocolVersion: "v0" } }],
      selections: await selections.list(project.id),
    });
    assert.deepEqual(protocolDifference.diff.protocolVersionChange, { previous: "domain-recognition/v0", current: "domain-recognition/v1" });
  });
});

test("Phase 2 configuration HTTP routes expose only the allowed immutable operations", async () => {
  await withFixture(async ({ projects, selections, baselines, catalog }) => {
    const project = await projects.createDraft({ primaryDomain: "http.example" });
    let sentStatus = 0;
    let sentBody: Record<string, unknown> = {};
    const call = async (method: string, pathname: string, body: Record<string, unknown> = {}) => {
      const url = new URL(pathname, "http://localhost");
      const handled = await handleProductConfigurationApi({
        method,
        route: url.pathname.split("/").filter(Boolean),
        projects,
        selections,
        baselines,
        catalog,
        readJson: async () => body,
        send: (status, response) => {
          sentStatus = status;
          sentBody = response as Record<string, unknown>;
        },
      });
      return { handled, status: sentStatus, body: sentBody };
    };

    const catalogResponse = await call("GET", "/api/provider-models");
    assert.equal(catalogResponse.handled, true);
    assert.equal(catalogResponse.status, 200);
    assert.equal(Array.isArray(catalogResponse.body.models), true);

    const configurationBeforeSave = await call("GET", `/api/projects/${project.id}/monitoring-configuration`);
    assert.equal(configurationBeforeSave.status, 200);
    assert.equal((configurationBeforeSave.body.configuration as { status: string }).status, "no_version");

    const modelSave = await call("PUT", `/api/projects/${project.id}/models`, { selections: selectedModels() });
    assert.equal(modelSave.status, 200);
    const firstBaseline = await call("POST", `/api/projects/${project.id}/baselines`);
    assert.equal(firstBaseline.status, 201);
    const baseline = firstBaseline.body.baseline as { id: string };
    const repeatedBaseline = await call("POST", `/api/projects/${project.id}/baselines`);
    assert.equal(repeatedBaseline.status, 409);
    assert.equal(repeatedBaseline.body.code, "baseline_unchanged");
    const configurationAfterSave = await call("GET", `/api/projects/${project.id}/monitoring-configuration`);
    assert.equal((configurationAfterSave.body.configuration as { status: string }).status, "unchanged");
    assert.equal((await call("GET", `/api/projects/${project.id}/baselines/${baseline.id}`)).status, 200);
    assert.equal((await call("PATCH", `/api/projects/${project.id}/baselines/${baseline.id}`)).handled, false);
    assert.equal((await call("DELETE", `/api/projects/${project.id}/baselines/${baseline.id}`)).handled, false);
  });
});

test("Phase 2 reports an unavailable catalog without inventing a product directory", async () => {
  await withFixture(async ({ projects, selections }) => {
    const project = await projects.createDraft({ primaryDomain: "unavailable.example" });
    await assert.rejects(() => selections.replace(project.id, selectedModels()), ProductModelCatalogUnavailableError);
    assert.deepEqual(await selections.list(project.id), []);
  }, new IsolatedCatalog([], "catalog transport failed"));
});

test("Phase 2 UI exposes the domain-only configuration flow without prompt or execution controls", () => {
  const html = renderProductPhase2AppHtml();
  assert.equal(html.includes("/api/provider-models"), true);
  assert.equal(html.includes("/models"), true);
  assert.equal(html.includes("/baselines"), true);
  assert.equal(html.includes("/monitoring-configuration"), true);
  assert.equal(html.includes('type="search"'), true);
  assert.equal(html.includes('data-testid="model-provider-filter"'), true);
  assert.equal(html.includes('data-testid="model-native-search-filter"'), true);
  assert.equal(html.includes('data-testid="model-catalog-sort"'), true);
  assert.equal(html.includes('上架时间：新到旧'), true);
  assert.equal(html.includes('目录未提供上架时间'), true);
  assert.equal(html.includes("逗号"), false);
  assert.equal(html.includes("<textarea"), false);
  assert.equal(html.includes("AuditPlan"), false);
  assert.equal(html.includes("/api/audit"), false);
  assert.equal(html.includes("保存监测配置v1"), true);
  assert.equal(html.includes("创建新 Baseline"), false);
  assert.equal(html.includes("可以在阶段 3"), false);
  assert.equal(html.includes("阶段 2 · 配置与 Baseline"), false);
  assert.equal(html.includes("--motion-fast:120ms"), true);
  assert.equal(html.includes("prefers-reduced-motion"), true);
});

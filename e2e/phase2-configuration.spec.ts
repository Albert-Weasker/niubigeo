import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const screenshotDirectory = join(process.cwd(), "validation", "rebuild-phase-2-2026-09-05", "screenshots");
let temporaryRoot = "";
let server: ChildProcess | undefined;
let baseUrl = "";

type CatalogRow = {
  modelId: string;
  nativeSearch: boolean;
  vendor: string;
  releasedAt: number | null;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function unusedPort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    reservation.once("error", rejectListen);
    reservation.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local port.");
  await new Promise<void>((resolveClose, rejectClose) => reservation.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

async function startProductServer(): Promise<void> {
  const port = await unusedPort();
  temporaryRoot = await mkdtemp(join(tmpdir(), "niubigeo-phase2-browser-"));
  server = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      PRODUCT_DATA_DIR: temporaryRoot,
      RUNS_DIR: join(temporaryRoot, "runs"),
      MONITORING_DATA_DIR: join(temporaryRoot, "monitoring"),
    },
    stdio: "ignore",
  });
  baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/projects`);
      if (response.status === 200) return;
    } catch {
      // The product server is still starting.
    }
    await wait(50);
  }
  throw new Error("The product server did not start for Phase 2 browser acceptance.");
}

async function stopProductServer(): Promise<void> {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise<void>((resolveExit) => server?.once("exit", () => resolveExit()));
  }
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
}

async function screenshot(page: Page, name: string): Promise<void> {
  await mkdir(screenshotDirectory, { recursive: true });
  await page.waitForTimeout(260);
  await page.screenshot({ path: join(screenshotDirectory, name), fullPage: true });
}

async function createProject(page: Page, domain: string, name: string): Promise<string> {
  await page.getByTestId("new-project").click();
  await expect(page.getByTestId("project-drawer")).toHaveAttribute("aria-hidden", "false");
  await page.locator("#project-domain").fill(domain);
  await page.locator("#project-name").fill(name);
  await page.getByTestId("save-draft").click();
  await expect(page.getByTestId("selected-project-title")).toHaveText(name);
  const id = await page.getByTestId("selected-project-id").textContent();
  if (!id) throw new Error("The project UI did not display an opaque project id.");
  await page.getByLabel("关闭").click();
  return id;
}

async function openModels(page: Page): Promise<void> {
  await page.getByRole("button", { name: "AI 模型", exact: true }).click();
  await expect(page.getByTestId("model-search")).toBeVisible();
  await expect(page.getByTestId("catalog-model").first()).toBeVisible();
}

async function openConfiguration(page: Page): Promise<void> {
  await page.getByRole("button", { name: "监测配置", exact: true }).click();
  await expect(page.getByTestId("save-monitoring-configuration")).toBeVisible();
}

async function catalogRows(page: Page): Promise<CatalogRow[]> {
  return page.getByTestId("catalog-model").evaluateAll((nodes) => nodes.map((node) => ({
    modelId: node.getAttribute("data-model-id") || "",
    nativeSearch: node.getAttribute("data-native-search") === "true",
    vendor: node.getAttribute("data-model-vendor") || "",
    releasedAt: Number(node.getAttribute("data-model-released-at")) || null,
  }))).then((rows) => rows.filter((row) => row.modelId.length > 0));
}

async function chooseModel(page: Page, modelId: string, mode: "off" | "provider_native"): Promise<void> {
  await page.getByTestId("model-search").fill(modelId);
  const row = page.getByTestId("catalog-model");
  await expect(row).toHaveCount(1);
  const checkbox = row.locator('input[type="checkbox"]');
  await checkbox.check();
  if (mode === "provider_native") await row.locator("select").selectOption("provider_native");
}

async function selectedConfiguration(page: Page, projectId: string): Promise<Record<string, unknown>> {
  const response = await page.request.get(`${baseUrl}/api/projects/${projectId}/models`);
  expect(response.status()).toBe(200);
  return response.json() as Promise<Record<string, unknown>>;
}

test.beforeAll(async () => {
  await startProductServer();
});

test.afterAll(async () => {
  await stopProductServer();
});

test("Phase 2 configuration uses the real product UI, actual catalog, immutable baselines, and isolated projects", async ({ page }) => {
  let alphaProjectId = "";
  let betaProjectId = "";
  let firstNativeModel = "";
  let secondNativeModel = "";
  let offlineOnlyModel = "";
  let modelCatalogRequests = 0;

  page.on("request", (request) => {
    if (request.url().endsWith("/api/provider-models")) modelCatalogRequests += 1;
  });

  await test.step("A. real OpenRouter catalog search, multi-select, independent search mode, and reload", async () => {
    await page.goto(baseUrl);
    alphaProjectId = await createProject(page, "alpha-phase2.example", "Alpha Phase 2");
    await openModels(page);
    const search = page.getByTestId("model-search");
    await search.evaluate((input) => input.setAttribute("data-caret-probe", "persistent"));
    await search.pressSequentially("openai");
    const searchCaret = await search.evaluate((input) => ({ value: input.value, selectionStart: input.selectionStart, selectionEnd: input.selectionEnd, identity: input.getAttribute("data-caret-probe") }));
    expect(searchCaret).toEqual({ value: "openai", selectionStart: 6, selectionEnd: 6, identity: "persistent" });
    await page.getByTestId("model-search").fill("");
    const rows = await catalogRows(page);
    await expect(page.getByTestId("model-provider-filter")).toBeVisible();
    await expect(page.getByTestId("model-native-search-filter")).toBeVisible();
    await expect(page.getByTestId("model-catalog-sort")).toBeVisible();
    const vendors = await page.getByTestId("model-provider-filter").locator("option").evaluateAll((options) => options.map((option) => option.getAttribute("value") || "").filter((value) => value.length > 0));
    expect(vendors.length).toBeGreaterThan(0);
    const selectedVendor = vendors[0] || "";
    await page.getByTestId("model-provider-filter").selectOption(selectedVendor);
    expect((await catalogRows(page)).every((row) => row.vendor === selectedVendor)).toBe(true);
    await page.getByTestId("model-provider-filter").selectOption("");
    await page.getByTestId("model-native-search-filter").selectOption("supported");
    expect((await catalogRows(page)).every((row) => row.nativeSearch)).toBe(true);
    await page.getByTestId("model-native-search-filter").selectOption("all");
    await page.getByTestId("model-catalog-sort").selectOption("newest");
    const newestFirst = await catalogRows(page);
    const datedRows = newestFirst.filter((row) => row.releasedAt !== null);
    for (let index = 1; index < datedRows.length; index += 1) {
      expect((datedRows[index - 1]?.releasedAt || 0) >= (datedRows[index]?.releasedAt || 0)).toBe(true);
    }
    await page.getByTestId("model-catalog-sort").selectOption("name");
    const nativeRows = rows.filter((row) => row.nativeSearch);
    const offlineRows = rows.filter((row) => !row.nativeSearch);
    expect(nativeRows.length).toBeGreaterThanOrEqual(2);
    expect(offlineRows.length).toBeGreaterThanOrEqual(1);
    firstNativeModel = nativeRows[0]?.modelId || "";
    secondNativeModel = nativeRows[1]?.modelId || "";
    offlineOnlyModel = offlineRows[0]?.modelId || "";
    expect(firstNativeModel.length).toBeGreaterThan(0);
    expect(secondNativeModel.length).toBeGreaterThan(0);
    expect(offlineOnlyModel.length).toBeGreaterThan(0);

    await chooseModel(page, firstNativeModel, "provider_native");
    await chooseModel(page, secondNativeModel, "off");
    await page.getByTestId("save-models").click();
    await expect(page.locator("#models-status")).toContainText("模型配置已保存");
    await page.reload();
    await openModels(page);
    await expect(page.locator(".selection-row").filter({ hasText: firstNativeModel })).toBeVisible();
    await expect(page.locator(".selection-row").filter({ hasText: secondNativeModel })).toBeVisible();
    const selectedNativeMode = page.locator('select[data-selected-model-mode="' + firstNativeModel + '"]');
    const selectedOfflineMode = page.locator('select[data-selected-model-mode="' + secondNativeModel + '"]');
    await expect(selectedNativeMode).toBeEnabled();
    await expect(selectedNativeMode).toHaveValue("provider_native");
    await expect(selectedOfflineMode).toBeEnabled();
    await expect(selectedOfflineMode).toHaveValue("off");
    await selectedNativeMode.selectOption("off");
    await expect(selectedNativeMode).toHaveValue("off");
    await selectedNativeMode.selectOption("provider_native");
    await expect(selectedNativeMode).toHaveValue("provider_native");
    const persisted = await selectedConfiguration(page, alphaProjectId);
    const persistedSelections = persisted.selections as Array<{ modelId: string; webSearchMode: string }>;
    expect(persistedSelections.map((selection) => [selection.modelId, selection.webSearchMode])).toEqual([
      [firstNativeModel, "provider_native"],
      [secondNativeModel, "off"],
    ]);
    expect(modelCatalogRequests).toBeGreaterThan(0);
    await screenshot(page, "phase2-A-catalog-search-multi-select.png");
  });

  await test.step("B. a model without native web search is visibly blocked and cannot persist an illegal mode", async () => {
    await page.getByTestId("model-search").fill(offlineOnlyModel);
    const row = page.getByTestId("catalog-model");
    await expect(row).toHaveCount(1);
    await row.locator('input[type="checkbox"]').check();
    await expect(row.locator("select")).toBeDisabled();
    await expect(row).toContainText("该模型不支持原生联网");
    await page.getByTestId("save-models").click();
    await expect(page.locator("#models-status")).toContainText("模型配置已保存");
    const persisted = await selectedConfiguration(page, alphaProjectId);
    const offlineSelection = (persisted.selections as Array<{ modelId: string; webSearchMode: string }>).find((selection) => selection.modelId === offlineOnlyModel);
    expect(offlineSelection?.webSearchMode).toBe("off");
    await screenshot(page, "phase2-B-native-search-blocked.png");
  });

  await test.step("C. saved configurations become disabled and changed settings produce the next version", async () => {
    await openConfiguration(page);
    const firstSaveButton = page.getByTestId("save-monitoring-configuration");
    await expect(firstSaveButton).toHaveText("保存监测配置v1");
    let baselinePosts = 0;
    const countBaselinePosts = (request: { url(): string; method(): string }) => {
      if (request.method() === "POST" && request.url().endsWith(`/api/projects/${alphaProjectId}/baselines`)) baselinePosts += 1;
    };
    page.on("request", countBaselinePosts);
    const savingFeedbackMilliseconds = await firstSaveButton.evaluate((button) => new Promise<number>((resolve) => {
      const startedAt = performance.now();
      const observer = new MutationObserver(() => {
        const current = document.getElementById("save-monitoring-configuration");
        if (!current || current.getAttribute("data-action-state") !== "saving") return;
        observer.disconnect();
        resolve(performance.now() - startedAt);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      button.click();
      button.click();
    }));
    expect(savingFeedbackMilliseconds).toBeLessThanOrEqual(100);
    await expect(page.getByTestId("monitoring-configuration-status")).toContainText("已保存为监测配置v1");
    expect(baselinePosts).toBe(1);
    page.off("request", countBaselinePosts);
    await page.waitForTimeout(950);
    await expect(page.getByTestId("save-monitoring-configuration")).toBeDisabled();
    await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("✓ 当前配置已保存");
    await expect(page.locator("body")).not.toContainText("Baseline");
    await expect(page.locator("body")).not.toContainText("阶段 2");
    await expect(page.locator("body")).not.toContainText("阶段 3");
    await expect(page.locator("details.technical-details")).not.toHaveAttribute("open", "");
    await screenshot(page, "phase2-v1-unchanged-disabled.png");
    await page.reload();
    await openConfiguration(page);
    await expect(page.getByTestId("save-monitoring-configuration")).toBeDisabled();
    await expect(page.getByTestId("monitoring-configuration-summary")).toContainText("当前模型和联网方式已保存");
    await expect(page.getByTestId("configuration-version-row")).toHaveCount(1);
    const v1Text = await page.getByTestId("configuration-version-row").first().textContent();
    expect(v1Text || "").toContain("Provider 原生联网");

    await openModels(page);
    await page.getByTestId("model-search").fill(firstNativeModel);
    const nativeRow = page.getByTestId("catalog-model");
    await expect(nativeRow).toHaveCount(1);
    await nativeRow.locator("select").selectOption("off");
    await page.getByTestId("save-models").click();
    await expect(page.locator("#models-status")).toContainText("模型配置已保存");
    await openConfiguration(page);
    await expect(page.getByTestId("save-monitoring-configuration")).toBeEnabled();
    await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("保存为监测配置v2");
    await expect(page.getByTestId("configuration-diff")).toContainText("联网方式变化");
    await screenshot(page, "phase2-v2-changed-enabled.png");
    await page.getByTestId("save-monitoring-configuration").click();
    await expect(page.getByTestId("monitoring-configuration-status")).toContainText("已保存为监测配置v2");
    await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("✓ 已保存为v2");
    await screenshot(page, "phase2-v2-saved.png");
    await page.waitForTimeout(950);
    await expect(page.getByTestId("save-monitoring-configuration")).toBeDisabled();
    await expect(page.getByTestId("configuration-version-row")).toHaveCount(2);
    await expect(page.getByTestId("configuration-version-row").first()).toContainText("Provider 原生联网");
    await expect(page.getByTestId("configuration-version-row").nth(1)).toContainText("不联网");
  });

  await test.step("D. two projects retain separate model selections and baselines", async () => {
    betaProjectId = await createProject(page, "beta-phase2.example", "Beta Phase 2");
    await openModels(page);
    await chooseModel(page, secondNativeModel, "off");
    await page.getByTestId("save-models").click();
    await expect(page.locator("#models-status")).toContainText("模型配置已保存");
    await openConfiguration(page);
    await page.getByTestId("save-monitoring-configuration").click();
    await expect(page.getByTestId("configuration-version-row")).toHaveCount(1);
    const betaBaselineId = await page.getByTestId("configuration-version-row").first().getAttribute("data-configuration-id");
    if (!betaBaselineId) throw new Error("The UI did not expose a baseline identifier for the read-only snapshot.");

    await page.selectOption("[data-testid=project-select]", alphaProjectId);
    await openConfiguration(page);
    await expect(page.getByTestId("configuration-version-row")).toHaveCount(2);
    const crossProject = await page.request.get(`${baseUrl}/api/projects/${alphaProjectId}/baselines/${betaBaselineId}`);
    expect(crossProject.status()).toBe(404);
    await page.selectOption("[data-testid=project-select]", betaProjectId);
    await openConfiguration(page);
    await expect(page.getByTestId("configuration-version-row")).toHaveCount(1);
    await screenshot(page, "phase2-D-project-isolation.png");
  });

  await test.step("E. immediate feedback, a real save failure, and baseline_unchanged all return to a clear Chinese UI", async () => {
    await page.getByTestId("new-project").click();
    await expect(page.getByTestId("project-drawer")).toHaveAttribute("aria-hidden", "false");
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(page.getByTestId("project-drawer")).toHaveAttribute("aria-hidden", "true");

    let failCatalogOnce = true;
    await page.route("**/api/provider-models", async (route) => {
      if (failCatalogOnce) {
        failCatalogOnce = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "model_catalog_unavailable" }) });
        return;
      }
      await route.continue();
    });
    await page.reload();
    await page.getByRole("button", { name: "AI 模型", exact: true }).click();
    await expect(page.getByText("模型目录不可用", { exact: true })).toBeVisible();
    await expect(page.getByText("模型目录暂时不可用，请稍后重试。", { exact: true })).toBeVisible();
    await expect(page.getByTestId("catalog-model")).toHaveCount(0);
    await page.getByTestId("retry-catalog").click();
    await expect(page.getByTestId("catalog-model").first()).toBeVisible();
    await page.unroute("**/api/provider-models");

    await page.selectOption("[data-testid=project-select]", alphaProjectId);
    await openModels(page);
    await page.getByTestId("model-search").fill(secondNativeModel);
    const selectedRow = page.getByTestId("catalog-model");
    await expect(selectedRow).toHaveCount(1);
    const selectionFeedbackMilliseconds = await selectedRow.locator('input[type="checkbox"]').evaluate((input) => new Promise<number>((resolve) => {
      const startedAt = performance.now();
      const observer = new MutationObserver(() => {
        const status = document.getElementById("models-status");
        if (!status || !status.textContent?.includes("配置尚未保存")) return;
        observer.disconnect();
        resolve(performance.now() - startedAt);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      input.click();
    }));
    expect(selectionFeedbackMilliseconds).toBeLessThanOrEqual(100);
    await selectedRow.locator('input[type="checkbox"]').check();

    let writes = 0;
    const countWrites = (request: { url(): string; method(): string }) => {
      if (request.method() === "PUT" && request.url().endsWith(`/api/projects/${alphaProjectId}/models`)) writes += 1;
    };
    page.on("request", countWrites);
    const immediateState = await page.getByTestId("save-models").evaluate((button) => {
      button.click();
      button.click();
      return button.getAttribute("data-action-state");
    });
    expect(immediateState).toBe("loading");
    await expect(page.locator("#models-status")).toContainText("模型配置已保存");
    expect(writes).toBe(1);
    page.off("request", countWrites);

    await openConfiguration(page);
    await expect(page.getByTestId("save-monitoring-configuration")).toBeDisabled();
    await expect(page.getByTestId("monitoring-configuration-status")).not.toContainText("Current configuration already has a baseline.");

    await openModels(page);
    await page.getByTestId("model-search").fill(secondNativeModel);
    await page.getByTestId("catalog-model").locator("select").selectOption("provider_native");
    await page.getByTestId("save-models").click();
    await expect(page.locator("#models-status")).toContainText("模型配置已保存");
    await openConfiguration(page);
    await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("保存为监测配置v3");

    let failSaveOnce = true;
    await page.route(`**/api/projects/${alphaProjectId}/baselines`, async (route) => {
      if (failSaveOnce) {
        failSaveOnce = false;
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "configuration_operation_failed" }) });
        return;
      }
      await route.continue();
    });
    await page.getByTestId("save-monitoring-configuration").click();
    await expect(page.getByTestId("save-monitoring-configuration")).toHaveAttribute("data-action-state", "saving");
    await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("重新保存");
    await expect(page.getByTestId("monitoring-configuration-status")).toContainText("保存监测配置失败，请重试。");
    await page.unroute(`**/api/projects/${alphaProjectId}/baselines`);
    await page.getByTestId("save-monitoring-configuration").click();
    await expect(page.getByTestId("monitoring-configuration-status")).toContainText("已保存为监测配置v3");
    await page.waitForTimeout(950);
    await expect(page.getByTestId("save-monitoring-configuration")).toBeDisabled();

    await openModels(page);
    await page.getByTestId("model-search").fill(firstNativeModel);
    await page.getByTestId("catalog-model").locator("select").selectOption("provider_native");
    await page.getByTestId("save-models").click();
    await expect(page.locator("#models-status")).toContainText("模型配置已保存");
    await openConfiguration(page);
    await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("保存为监测配置v4");
    const concurrentSave = await page.request.post(`${baseUrl}/api/projects/${alphaProjectId}/baselines`, { data: {} });
    expect(concurrentSave.status()).toBe(201);
    await page.getByTestId("save-monitoring-configuration").click();
    await expect(page.getByTestId("monitoring-configuration-status")).toContainText("当前配置已经保存，无需重复保存");
    await expect(page.getByTestId("save-monitoring-configuration")).toBeDisabled();
    await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("✓ 当前配置已保存");
    await expect(page.getByTestId("monitoring-configuration-status")).not.toContainText("Current configuration already has a baseline.");
    await screenshot(page, "phase2-unchanged-response-normal.png");
  });
});

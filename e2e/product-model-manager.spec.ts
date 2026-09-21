import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { renderProductPhase5AppHtml } from "../src/ui/product-phase5-app.js";

let server: Server;
let baseUrl = "";
const models = [
  { modelId: "fixture/off", displayName: "管理模型", nativeWebSearchSupported: false },
  { modelId: "fixture/native", displayName: "品牌：项目", nativeWebSearchSupported: true },
  { modelId: "fixture/extra", displayName: "Sources", nativeWebSearchSupported: true },
];

test.beforeAll(async () => {
  server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(renderProductPhase5AppHtml());
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture server address.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function installFixture(page: Page, locale: string) {
  const errors: string[] = [];
  const unexpectedRequests: string[] = [];
  const saved: Array<Array<{ modelId: string; webSearchMode: string }>> = [];
  let selections = [{ ...models[0]!, webSearchMode: "off" }];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((value) => localStorage.setItem("niubigeo.product.locale", value), locale);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: object;
    if (path === "/api/projects") body = { projects: [{ id: "model-project", name: "品牌：项目", normalizedDomain: "fixture.example" }] };
    else if (path === "/api/provider-models") body = { models };
    else if (path.endsWith("/models")) {
      if (route.request().method() === "PUT") {
        const payload = route.request().postDataJSON();
        saved.push(payload.selections);
        selections = payload.selections.map((selection: { modelId: string; webSearchMode: string }) => ({ ...models.find((model) => model.modelId === selection.modelId)!, ...selection }));
      }
      body = { selections };
    } else if (path.endsWith("/baselines")) body = { baselines: [] };
    else if (path.endsWith("/monitoring-configuration")) body = { configuration: null };
    else if (path.endsWith("/watch-sets")) body = { watchSets: [] };
    else if (path.endsWith("/measurement-runs")) body = { runs: [] };
    else if (path.endsWith("/monitoring-tasks")) body = { tasks: [] };
    else { unexpectedRequests.push(path); body = {}; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(`${baseUrl}/?view=measurements`);
  await expect(page.getByTestId("phase5-ready")).toBeVisible();
  await page.locator('[data-action="models"]').click();
  return { errors, unexpectedRequests, saved };
}

const locales = [
  { locale: "zh", title: "管理模型", search: "搜索模型", placeholder: "模型名称或标识符", selectedOnly: "仅显示已选模型", mode: "联网方式", empty: "没有符合筛选条件的模型。" },
  { locale: "en", title: "Manage models", search: "Search models", placeholder: "Model name or identifier", selectedOnly: "Show selected models only", mode: "Web access mode", empty: "No models match the filters." },
  { locale: "pt-BR", title: "Gerenciar modelos", search: "Pesquisar modelos", placeholder: "Nome ou identificador do modelo", selectedOnly: "Exibir somente selecionados", mode: "Modo de acesso à web", empty: "Nenhum modelo corresponde aos filtros." },
];

for (const language of locales) {
  test(`${language.locale}: model manager localizes controls and saves selections across filters`, async ({ page }) => {
    const observed = await installFixture(page, language.locale);
    const manager = page.locator(".p5-model-manager");
    await expect(manager.getByRole("heading")).toHaveText(language.title);
    await expect(manager.locator(".p5-model-toolbar label:first-child > span")).toHaveText(language.search);
    const search = manager.locator('[data-role="model-query"]');
    await expect(search).toHaveAttribute("placeholder", language.placeholder);
    await expect(manager.locator(".p5-selected-filter > span")).toHaveText(language.selectedOnly);
    await expect(manager.locator('[data-mode="fixture/native"]')).toHaveAttribute("aria-label", language.mode);
    await expect(manager.locator(".p5-model-copy strong")).toHaveText(models.map((model) => model.displayName));
    await expect(page.locator(".p5-header > strong")).toHaveText("NiubiGEO / 品牌：项目");
    const count = manager.locator('[data-role="selected-model-count"]');
    const selectedOnly = manager.locator('[data-role="selected-models-only"]');
    const visibleRows = manager.locator("[data-model-row]:visible");
    await expect(count).toHaveText("1");
    await search.fill("native");
    await expect(visibleRows).toHaveCount(1);
    await manager.locator('[data-model="fixture/native"]').check();
    await manager.locator('[data-mode="fixture/native"]').selectOption("provider_native");
    await expect(count).toHaveText("2");
    await selectedOnly.check();
    await search.fill("");
    await expect(visibleRows).toHaveCount(2);
    await manager.locator('[data-model="fixture/off"]').uncheck();
    await expect(count).toHaveText("1");
    await expect(visibleRows).toHaveCount(1);
    await selectedOnly.uncheck();
    await expect(visibleRows).toHaveCount(3);
    await manager.locator('[data-model="fixture/off"]').check();
    await search.fill("no matching fixture");
    await expect(visibleRows).toHaveCount(0);
    await expect(manager.locator('[data-role="model-filter-empty"]')).toHaveText(language.empty);
    await expect(manager.locator('[data-role="model-filter-empty"]')).toBeVisible();
    await expect(count).toHaveText("2");

    // Saving while every row is filtered out must retain all checked models and each mode.
    await manager.locator('[data-action="save-models"]').click();
    await expect.poll(() => observed.saved).toEqual([[{ modelId: "fixture/off", webSearchMode: "off" }, { modelId: "fixture/native", webSearchMode: "provider_native" }]]);
    await expect(manager).toHaveCount(0);
    await page.locator('[data-action="models"]').click();
    await expect(count).toHaveText("2");
    await expect(search).toHaveValue("no matching fixture");
    await expect(visibleRows).toHaveCount(0);
    await search.fill("");
    await expect(manager.locator('[data-model="fixture/native"]')).toBeChecked();
    await expect(manager.locator('[data-mode="fixture/native"]')).toHaveValue("provider_native");
    expect(observed.errors).toEqual([]);
    expect(observed.unexpectedRequests).toEqual([]);
  });
}

for (const viewport of [{ width: 375, height: 667 }, { width: 700, height: 800 }, { width: 1280, height: 720 }]) {
  test(`${viewport.width}x${viewport.height}: model manager remains within the viewport and save is clickable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const observed = await installFixture(page, "pt-BR");
    const manager = page.locator(".p5-model-manager");
    const bounds = await manager.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await manager.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const save = manager.locator('[data-action="save-models"]');
    await expect(save).toBeVisible();
    const clickable = await save.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return [
        [bounds.left + 12, bounds.top + bounds.height / 2],
        [bounds.right - 12, bounds.top + bounds.height / 2],
        [bounds.left + bounds.width / 2, bounds.bottom - 5],
      ].every(([x, y]) => element.contains(document.elementFromPoint(x!, y!)));
    });
    expect(clickable).toBe(true);
    expect(observed.errors).toEqual([]);
    expect(observed.unexpectedRequests).toEqual([]);
  });
}

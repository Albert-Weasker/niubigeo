import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { renderProductPhase2AppHtml } from "../src/ui/product-phase2-app.js";

let server: Server;
let baseUrl = "";

test.beforeAll(async () => {
  server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(renderProductPhase2AppHtml());
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function fixtureProduct(page: Page, locale: string, collisions = false) {
  const errors: string[] = [];
  const unexpectedRequests: string[] = [];
  const names = collisions
    ? { project: "项目", model: "不联网", vendor: "来源", brand: "无法确认", business: "品牌：项目", description: "项目与模型", category: "模型", competitor: "竞争对象", keyword: "来源", citation: "报告版本 1", protocol: "项目", hash: "尚未保存" }
    : { project: "Acme", model: "Fixture Model", vendor: "Fixture Vendor", brand: "Acme", business: "Software", description: "Business software", category: "Technology", competitor: "Competitor", keyword: "Analytics", citation: "Source article", protocol: "domain-recognition", hash: "fixture-hash" };
  const timestamp = "2026-09-20T00:00:00.000Z";
  const project = { id: "project-fixture", name: names.project, primaryDomain: "fixture.example", normalizedDomain: "fixture.example", status: "active", defaultLanguage: "pt-BR", activeBaselineId: "baseline-fixture", createdAt: timestamp, updatedAt: timestamp };
  const model = { id: "selection-fixture", modelId: "fixture/model", displayName: names.model, vendor: names.vendor, nativeWebSearchSupported: true, available: true, enabled: true, webSearchMode: "off", capabilityCheckedAt: timestamp, updatedAt: timestamp };
  const baseline = { id: project.activeBaselineId, version: 1, normalizedDomain: project.normalizedDomain, createdAt: timestamp, modelSnapshots: [model] };
  const configuration = {
    status: "changed", currentVersion: 1, nextVersion: 2, currentBaseline: baseline,
    currentProtocol: { protocolId: names.protocol, protocolVersion: "v1", inputType: "domain_only", promptTemplateHash: names.hash },
    currentDomain: project.normalizedDomain, currentLanguage: "pt-BR", currentModelSnapshots: [model],
    diff: { addedModels: [{ modelId: model.modelId, displayName: names.model }], removedModels: [{ modelId: "fixture/old", displayName: names.model }], webSearchModeChanges: [{ modelId: model.modelId, displayName: names.model, previousMode: "off", currentMode: "provider_native" }], protocolVersionChange: { previous: "v0", current: "v1" }, domainChange: { previous: "old.example", current: project.normalizedDomain }, languageChange: { previous: "en", current: "pt-BR" } },
  };
  const run = { id: "run-fixture", status: "completed", createdAt: timestamp, baselineVersion: 1, plannedModelRunCount: 1 };
  const modelRun = { id: "model-run-fixture", status: "completed", modelSnapshot: model, recognitionMode: "unaided_domain_recognition", errorMessage: null };
  const evidence = { start: 0, end: 3 };
  const rawAnswer = collisions ? "品牌：项目\n来源与模型，无法确认。" : "Brand: Acme. Software analytics from Competitor.";
  const archive = {
    result: { id: "result-fixture", domainRecognition: "recognized", recognizedBrand: { value: names.brand, evidence }, businessDescription: { value: names.business, evidence }, detailedDescription: { value: names.description, evidence }, productCategory: { value: names.category, evidence }, fieldIssues: [] },
    competitors: [{ id: "competitor-fixture", name: names.competitor, evidence, businessDescription: { value: names.business, evidence }, productCategory: { value: names.category, evidence } }],
    brandKeywords: [{ id: "brand-keyword-fixture", keyword: names.keyword, evidence }],
    competitorKeywords: [{ id: "competitor-keyword-fixture", competitorRecognitionId: "competitor-fixture", keyword: names.keyword, evidence }],
    providerCitations: [{ url: "https://source.example/article", title: names.citation }],
    answerMentionedUrls: [{ url: "https://source.example/answer" }],
  };
  const modelDetail = {
    archive,
    attempts: [{ id: "attempt-fixture", attemptNumber: 1, status: "completed", rawAnswer }],
    analysisRevisions: [{ status: "complete" }],
    presentation: { statusLabel: "已完成", detail: "缺失或格式不正确的字段会明确保留为空，不会推断。", localAnalysis: "complete", requestExecution: "response_received", primaryAction: "none" },
  };
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((value) => localStorage.setItem("niubigeo.product.locale", value), locale);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: object;
    if (path === "/api/projects") body = { projects: [project] };
    else if (path === "/api/provider-models") body = { models: [model] };
    else if (path.endsWith("/models")) body = { selections: [model] };
    else if (path.endsWith("/baselines")) body = { baselines: [baseline] };
    else if (path.endsWith("/monitoring-configuration")) body = { configuration };
    else if (path.endsWith("/recognition-runs")) body = { runs: [run] };
    else if (path.endsWith(`/recognition-runs/${run.id}`)) body = { run, modelRuns: [modelRun] };
    else if (path.endsWith(`/model-runs/${modelRun.id}`)) body = modelDetail;
    else { unexpectedRequests.push(path); body = {}; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(baseUrl);
  await expect(page.getByTestId("selected-project-title")).toHaveText(names.project);
  return { names, rawAnswer, errors, unexpectedRequests };
}

async function expectPortugueseInterface(page: Page) {
  await expect.poll(() => page.locator("body").evaluate((body) => {
    const containsHan = (value: string) => [...value].some((character) => {
      const point = character.codePointAt(0) || 0;
      return point >= 0x3400 && point <= 0x9fff;
    });
    const attributes = [...body.querySelectorAll("*")]
      .filter((element) => element.getClientRects().length > 0)
      .flatMap((element) => ["aria-label", "placeholder", "title"].map((attribute) => element.getAttribute(attribute) || ""));
    return [...body.innerText.split("\n"), ...attributes].filter(containsHan);
  })).toEqual([]);
}

test("pt-BR: populated models, configuration and recognition views translate all visible UI", async ({ page }) => {
  const fixture = await fixtureProduct(page, "pt-BR");
  await expectPortugueseInterface(page);
  await page.locator('[data-page="models"]').first().click();
  await expect(page.getByTestId("catalog-model")).toHaveCount(1);
  await expect(page.getByTestId("save-models")).toHaveText("Salvar configuração dos modelos");
  await expectPortugueseInterface(page);
  await page.getByTestId("model-search").fill("not-present");
  await expect(page.getByTestId("catalog-model")).toHaveCount(0);
  await expectPortugueseInterface(page);
  await page.getByTestId("model-search").fill("");
  await expect(page.getByTestId("catalog-model")).toHaveCount(1);

  await page.locator('[data-page="configuration"]').first().click();
  await expect(page.getByTestId("configuration-diff")).toBeVisible();
  await page.locator("details.technical-details > summary").click();
  await expectPortugueseInterface(page);

  await page.locator('[data-page="recognition"]').first().click();
  await expect(page.getByTestId("recognition-model-run")).toHaveCount(1);
  await expect(page.locator(".recognition-summary")).toBeVisible();
  await page.locator("details.evidence-details > summary").click();
  await expect(page.locator("pre.raw-answer")).toHaveText(fixture.rawAnswer);
  await expectPortugueseInterface(page);
  expect(fixture.unexpectedRequests).toEqual([]);
  expect(fixture.errors).toEqual([]);
});

for (const locale of ["en", "pt-BR"]) {
  test(`${locale}: model, configuration and recognition data matching UI translations stays verbatim`, async ({ page }) => {
    const fixture = await fixtureProduct(page, locale, true);
    await page.locator('[data-page="models"]').first().click();
    await expect(page.getByTestId("catalog-model").locator(".model-name > strong")).toHaveText(fixture.names.model);
    await expect(page.locator("#model-provider-filter option").last()).toHaveText(fixture.names.vendor);
    await expect(page.getByTestId("catalog-model").locator("input[type=checkbox]")).toHaveAttribute("aria-label", `${locale === "pt-BR" ? "Selecionar " : "Select "}${fixture.names.model}`);
    await page.locator('[data-page="configuration"]').first().click();
    const diff = page.getByTestId("configuration-diff");
    for (const row of [0, 1, 2]) await expect(diff.locator("li").nth(row)).toContainText(fixture.names.model);
    await expect(page.getByTestId("configuration-version-row")).toContainText(fixture.names.model);
    await page.locator("details.technical-details > summary").click();
    await expect(page.locator("details.technical-details .detail-cell strong").nth(0)).toHaveText(`${fixture.names.protocol}/v1`);
    await expect(page.locator("details.technical-details .detail-cell strong").nth(1)).toHaveText(fixture.names.hash);

    await page.locator('[data-page="recognition"]').first().click();
    const card = page.getByTestId("recognition-model-run");
    await expect(card.locator("h3")).toHaveText(fixture.names.model);
    const values = card.locator(".recognition-summary > div > strong");
    for (const [index, expected] of [[0, fixture.names.brand], [2, fixture.names.business], [3, fixture.names.description], [4, fixture.names.category], [5, fixture.names.competitor], [6, fixture.names.keyword]] as const) {
      expect(await values.nth(index).evaluate((element) => [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.nodeValue).join(""))).toBe(expected);
    }
    await expect(values.nth(7)).toContainText(`${fixture.names.competitor}：${fixture.names.keyword}`);
    await card.locator("[data-evidence-target]").first().click();
    expect(await card.locator("pre.raw-answer").textContent()).toBe(fixture.rawAnswer);
    await expect(card.locator("pre.raw-answer mark").first()).toHaveText("品牌：");
    await expect(card.locator('a[href="https://source.example/article"]')).toHaveText(fixture.names.citation);
    expect(fixture.unexpectedRequests).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });
}

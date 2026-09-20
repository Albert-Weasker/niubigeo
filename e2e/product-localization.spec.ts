import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { renderProductLocalizationScript } from "../src/ui/product-localization.js";
import { renderProductPhase4AppHtml } from "../src/ui/product-phase4-app.js";
import { renderProductPhase5AppHtml } from "../src/ui/product-phase5-app.js";

let server: Server;
let baseUrl = "";

const focusedFixture = () => `<!doctype html><html><body>
  <main id="app">
    <h1 id="static-label" data-product-i18n>项目</h1>
    <button id="action-label" data-product-i18n>保存草稿</button>
    <div id="mixed-label" data-product-i18n>项目<span id="nested-user">项目</span><span id="nested-label" data-product-i18n>来源</span></div>
    <input id="static-attributes" data-product-i18n-placeholder data-product-i18n-title data-product-i18n-aria-label placeholder="可选" title="项目" aria-label="来源">
    <input id="user-attributes" placeholder="可选" title="项目" aria-label="来源" value="项目">
    <pre id="raw-answer">品牌：项目</pre>
    <span class="prototype-key" data-product-i18n>constructor</span>
    <span class="prototype-key" data-product-i18n>toString</span>
    <span class="prototype-key" data-product-i18n>__proto__</span>
  </main>
  <aside id="outside-app" data-product-i18n>保存草稿</aside>
  ${renderProductLocalizationScript()}
</body></html>`;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    const url = new URL(request.url || "/", "http://localhost");
    response.end(url.pathname === "/translator" ? focusedFixture() : url.searchParams.get("view") === "measurements" ? renderProductPhase5AppHtml() : renderProductPhase4AppHtml());
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

const locales = [
  { locale: "zh", language: "zh-CN", project: "项目", source: "来源", optional: "可选", draft: "保存草稿", saving: "正在保存…", saved: "已保存", evidence: "查看证据", refresh: "刷新报告", unknown: "无法确认", version: "报告版本 1", offline: "不联网", native: "Provider 原生联网" },
  { locale: "en", language: "en", project: "Project", source: "Sources", optional: "Optional", draft: "Save draft", saving: "Saving…", saved: "Saved", evidence: "View evidence", refresh: "Refresh report", unknown: "Unable to confirm", version: "Report version 1", offline: "Offline", native: "Provider-native web" },
  { locale: "pt-BR", language: "pt-BR", project: "Projeto", source: "Fontes", optional: "Opcional", draft: "Salvar rascunho", saving: "Salvando…", saved: "Salvo", evidence: "Ver evidências", refresh: "Atualizar relatório", unknown: "Não foi possível confirmar", version: "Versão do relatório 1", offline: "Sem acesso à web", native: "Acesso nativo do provedor à web" },
];

for (const language of locales) {
  test(`${language.locale}: only explicitly marked UI text and attributes are localized`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((locale) => localStorage.setItem("niubigeo.product.locale", locale), language.locale);
    await page.goto(`${baseUrl}/translator`);
    await expect(page.locator("html")).toHaveAttribute("lang", language.language);
    await expect(page.locator("#static-label")).toHaveText(language.project);
    await expect(page.locator("#action-label")).toHaveText(language.draft);
    await expect(page.locator("#nested-label")).toHaveText(language.source);
    await expect(page.locator("#nested-user")).toHaveText("项目");
    expect(await page.locator("#mixed-label").evaluate((element) => element.firstChild?.nodeValue)).toBe(language.project);
    await expect(page.locator("#static-attributes")).toHaveAttribute("placeholder", language.optional);
    await expect(page.locator("#static-attributes")).toHaveAttribute("title", language.project);
    await expect(page.locator("#static-attributes")).toHaveAttribute("aria-label", language.source);
    await expect(page.locator("#user-attributes")).toHaveAttribute("placeholder", "可选");
    await expect(page.locator("#user-attributes")).toHaveAttribute("title", "项目");
    await expect(page.locator("#user-attributes")).toHaveAttribute("aria-label", "来源");
    await expect(page.locator("#user-attributes")).toHaveValue("项目");
    await expect(page.locator("#raw-answer")).toHaveText("品牌：项目");
    await expect(page.locator(".prototype-key")).toHaveText(["constructor", "toString", "__proto__"]);

    await page.evaluate(() => {
      const root = document.createElement("button");
      root.id = "inserted-label";
      root.setAttribute("data-product-i18n", "");
      root.setAttribute("data-product-i18n-title", "");
      root.setAttribute("title", "项目");
      root.textContent = "保存草稿";
      document.getElementById("app")!.appendChild(root);
      const user = document.createElement("span");
      user.id = "inserted-user";
      user.textContent = "品牌：项目";
      user.setAttribute("title", "来源");
      document.getElementById("app")!.appendChild(user);
      document.getElementById("action-label")!.textContent = "正在保存…";
      document.getElementById("outside-app")!.textContent = "正在保存…";
      document.getElementById("static-attributes")!.setAttribute("title", "来源");
    });
    await expect(page.locator("#inserted-label")).toHaveText(language.draft);
    await expect(page.locator("#inserted-label")).toHaveAttribute("title", language.project);
    await expect(page.locator("#inserted-user")).toHaveText("品牌：项目");
    await expect(page.locator("#inserted-user")).toHaveAttribute("title", "来源");
    await expect(page.locator("#action-label")).toHaveText(language.saving);
    await expect(page.locator("#outside-app")).toHaveText(language.saving);
    await expect(page.locator("#static-attributes")).toHaveAttribute("title", language.source);

    await page.locator("#action-label").evaluate((element) => { element.firstChild!.nodeValue = "  已保存\n"; });
    await expect.poll(() => page.locator("#action-label").textContent()).toBe(`  ${language.saved}\n`);
    await page.locator("#inserted-user").evaluate((element) => { element.firstChild!.nodeValue = "项目"; });
    await expect(page.locator("#inserted-user")).toHaveText("项目");
    expect(errors).toEqual([]);
  });

  test(`${language.locale}: project data and report evidence stay verbatim through highlighting`, async ({ page }) => {
    const errors: string[] = [];
    const unexpectedRequests: string[] = [];
    const rawAnswer = "品牌：项目\n来源\n无法确认\nconstructor\ntoString\n__proto__";
    const project = { id: "project-fixture", name: "项目", primaryDomain: "fixture.example", normalizedDomain: "fixture.example", status: "draft", defaultLanguage: "zh-CN", createdAt: "2026-09-20T00:00:00.000Z", updatedAt: "2026-09-20T00:00:00.000Z" };
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((locale) => localStorage.setItem("niubigeo.product.locale", locale), language.locale);
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: object;
      if (path === "/api/projects") body = { projects: [project] };
      else if (path.endsWith("/models")) body = { selections: [] };
      else if (path.endsWith("/baselines")) body = { baselines: [] };
      else if (path.endsWith("/monitoring-configuration")) body = { configuration: null };
      else if (path.endsWith("/recognition-runs")) body = { runs: [] };
      else { unexpectedRequests.push(path); body = {}; }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(baseUrl);
    await expect(page.getByTestId("project-title")).toHaveText("项目");
    await expect(page.getByTestId("selected-project-title")).toHaveText("项目");
    await expect(page.locator("#edit-name")).toHaveValue("项目");
    await expect(page.locator(".project-label")).toHaveText(language.project);

    await page.evaluate((answer) => {
      const app = window as unknown as {
        __niubigeoPhase2: { state: { page: string; phase4: { report: unknown; reports: unknown[] } } };
        __niubigeoPhase4: { render(): void };
      };
      const evidence = { integrity: "valid", evidence: { start: 0, end: 3 } };
      const cells = [{ modelRunId: "model-run", state: "reported", recordIds: ["competitor"] }];
      app.__niubigeoPhase2.state.page = "reports";
      app.__niubigeoPhase2.state.phase4.report = {
        reportId: "report-fixture", runId: "run-fixture", reportRevision: 1, generatedAt: "2026-09-20T00:00:00.000Z", domain: "fixture.example", monitoringConfigurationVersion: 1,
        competitorGroups: [{ id: "competitor-group", name: "项目", sourceRecordIds: ["competitor"], cells }],
        brandKeywordGroups: [{ id: "keyword-group", keyword: "来源", cells }],
        models: [{
          modelRunId: "model-run", modelId: "fixture/model", displayName: "来源", recognitionMode: "unaided_domain_recognition", state: "recognized", webSearch: { label: "不联网" },
          rawAnswer: answer, rawProviderResponse: { text: answer },
          recognizedBrand: { value: "项目", evidence }, businessDescription: { value: "无法确认", evidence }, productCategory: null,
          competitors: [{ id: "competitor", name: "项目", domain: "competitor.example", evidence }],
          brandKeywords: [{ keyword: "来源", evidence }],
          competitorKeywords: [{ competitorRecordId: "competitor", keyword: "无法确认", evidence }],
          providerCitations: [{ url: "https://source.example/", title: "项目", domain: "source.example", providerPayloadPath: "constructor" }],
          answerMentionedUrls: [{ url: "https://source.example/answer", domain: "来源", evidence }],
        }],
      };
      app.__niubigeoPhase2.state.phase4.reports = [];
      app.__niubigeoPhase4.render();
    }, rawAnswer);

    const card = page.getByTestId("report-model-card");
    await expect(page.getByTestId("refresh-report")).toHaveText(language.refresh);
    await expect(page.locator('[data-phase4-model="model-run"]')).toHaveText("来源");
    await expect(card.locator("h3")).toHaveText("来源");
    await expect(card.locator(".detail-cell strong")).toHaveText(["项目", "无法确认", language.unknown]);
    await expect(card.locator(".evidence-group li strong")).toHaveText("项目");
    await expect(card.locator(".evidence-group .tag")).toHaveText("来源");
    await expect(page.locator('a[href="https://source.example/"]')).toHaveText("项目");
    await expect(page.locator('a[href="https://source.example/answer"]')).toHaveText("来源");
    await expect(page.locator(".heading .inline-actions > .subtle")).toHaveText(language.version);
    expect(await page.getByTestId("report-raw-answer").textContent()).toBe(rawAnswer);
    expect(await card.locator("pre.raw-answer").nth(1).textContent()).toBe(JSON.stringify({ text: rawAnswer }, null, 2));
    await expect(card.locator("[data-phase4-evidence-model]").first()).toHaveText(language.evidence);

    // Exercise the actual report event handler and renderer, including evidence offsets.
    await card.locator("[data-phase4-evidence-model]").first().click();
    expect(await page.getByTestId("report-raw-answer").textContent()).toBe(rawAnswer);
    await expect(page.getByTestId("report-raw-answer").locator("mark")).toHaveText("品牌：");
    expect(await page.evaluate(() => {
      const app = window as unknown as { __niubigeoPhase2: { state: { phase4: { report: { models: { rawAnswer: string }[] } } } } };
      return app.__niubigeoPhase2.state.phase4.report.models[0]!.rawAnswer;
    })).toBe(rawAnswer);
    expect(unexpectedRequests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${language.locale}: measurement mode labels translate while model names stay verbatim`, async ({ page }) => {
    const errors: string[] = [];
    const unexpectedRequests: string[] = [];
    const project = { id: "measurement-project", name: "项目", normalizedDomain: "fixture.example", activeBaselineId: "baseline-fixture" };
    const selections = [
      { modelId: "fixture/off", displayName: "不联网", webSearchMode: "off" },
      { modelId: "fixture/native", displayName: "Provider 原生联网", webSearchMode: "provider_native" },
    ];
    const run = { id: "measurement-run", source: "manual", modelRuns: selections.map((modelSnapshot) => ({ modelSnapshot, status: "completed", probeRunIds: ["probe-fixture"] })) };
    const watchSet = { id: "watchset-fixture", status: "active", baselineId: project.activeBaselineId, targetObjectId: "target", version: 1, repetitions: 1, objects: [{ id: "target", role: "target", name: "项目", domain: "fixture.example" }], keywords: [] };
    const points = selections.map((model, index) => ({
      id: `point-${index}`, runId: run.id, modelId: model.modelId, modelDisplayName: model.displayName, webSearchMode: model.webSearchMode,
      metric: "domain_recognition", objectId: "target", fingerprint: "fixture", observedAt: "2026-09-20T00:00:00.000Z",
      value: 100, valueUnit: "percent", numerator: 1, denominator: 1, planned: 1, failed: 0, complete: true,
    }));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((locale) => localStorage.setItem("niubigeo.product.locale", locale), language.locale);
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: object;
      if (path === "/api/projects") body = { projects: [project] };
      else if (path === "/api/provider-models") body = { models: [] };
      else if (path.endsWith("/models")) body = { selections };
      else if (path.endsWith("/baselines")) body = { baselines: [] };
      else if (path.endsWith("/monitoring-configuration")) body = { configuration: null };
      else if (path.endsWith("/watch-sets")) body = { watchSets: [watchSet] };
      else if (path.endsWith("/measurement-runs")) body = { runs: [run] };
      else if (path.endsWith("/monitoring-tasks")) body = { tasks: [] };
      else if (path.endsWith("/measurement-stats")) body = { snapshot: { points } };
      else { unexpectedRequests.push(path); body = {}; }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(`${baseUrl}/?view=measurements`);
    await expect(page.getByTestId("phase5-ready")).toBeVisible();
    await expect(page.locator("#p5-recognition tbody tr td:first-child")).toHaveText(["不联网", "Provider 原生联网"]);
    await expect(page.locator("#p5-recognition tbody tr td:nth-child(2)")).toHaveText([language.offline, language.native]);

    const chart = page.locator(".p5-chart").first();
    await chart.locator("summary").click();
    await expect(chart.locator("tbody tr td:nth-child(2)")).toHaveText(["不联网", "Provider 原生联网"]);
    await expect(chart.locator("tbody tr td:nth-child(3)")).toHaveText([language.offline, language.native]);
    expect(unexpectedRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

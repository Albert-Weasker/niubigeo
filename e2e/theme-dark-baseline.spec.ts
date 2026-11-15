import type { Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { AuditMetrics, AuditRun, GeoGapAnalysis, PromptRun } from "../src/core/types.js";
import { entityFromInput } from "../src/utils/domain.js";
import { renderDashboardHtml } from "../src/report/report-html.js";
import { Phase4FixtureCatalog, Phase4FixtureExecutor } from "../test/fixtures/phase4-fixture-adapter.js";

let server: Server;
let baseUrl = "";
let dataRoot = "";
let priorDataDir: string | undefined;
let priorKey: string | undefined;

const screenshotOptions = { fullPage: true, animations: "disabled" as const, maxDiffPixelRatio: 0.001 };

async function expectDarkScreenshot(page: Page, name: string): Promise<void> {
  // The new theme control is the one intentional dark UI addition in this PR.
  await page.addStyleTag({ content: "[data-theme-toggle] { visibility: hidden !important; }" });
  await expect(page).toHaveScreenshot(name, screenshotOptions);
}

test.beforeAll(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "niubigeo-theme-baseline-"));
  priorDataDir = process.env.PRODUCT_DATA_DIR;
  priorKey = process.env.OPENROUTER_API_KEY;
  process.env.PRODUCT_DATA_DIR = dataRoot;
  process.env.OPENROUTER_API_KEY = "theme-baseline-fixture-key";
  const { createProductServer } = await import("../src/product/product-server.js");
  server = createProductServer({
    modelCatalog: new Phase4FixtureCatalog(),
    recognitionExecutor: new Phase4FixtureExecutor(),
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing theme baseline server address.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("niubigeo.product.locale", "en"));
});

test.afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (dataRoot) await rm(dataRoot, { recursive: true, force: true });
  if (priorDataDir === undefined) delete process.env.PRODUCT_DATA_DIR;
  else process.env.PRODUCT_DATA_DIR = priorDataDir;
  if (priorKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = priorKey;
});

async function screenshotPage(page: Page, path: string, name: string): Promise<void> {
  await page.goto(`${baseUrl}${path}`);
  await expect(page.locator("body")).toBeVisible();
  await expectDarkScreenshot(page, name);
}

test("dashboard dark baseline", async ({ page }) => {
  await screenshotPage(page, "/", "dashboard-dark.png");
});

test("measurements dark baseline", async ({ page }) => {
  await page.goto(`${baseUrl}/?view=measurements`);
  await expect(page.getByTestId("phase5-workbench")).toBeVisible();
  await expectDarkScreenshot(page, "measurements-dark.png");
});

test("keyword monitoring dark baseline", async ({ page }) => {
  await page.goto(`${baseUrl}/?view=keyword-monitoring`);
  await expect(page.locator("h1")).toBeVisible();
  await expectDarkScreenshot(page, "keyword-monitoring-dark.png");
});

test("provider key dialog dark baseline", async ({ page }) => {
  await page.goto(baseUrl);
  await page.locator("[data-connect-key]").click();
  await expect(page.locator("#openrouter-key-dialog")).toBeVisible();
  await expectDarkScreenshot(page, "provider-key-dialog-dark.png");
});

function generatedReportHtml(): string {
  const target = entityFromInput({ type: "target", domain: "target.example", name: "TargetDocs" });
  const competitor = entityFromInput({ type: "competitor", domain: "forge.example", name: "Forge" });
  const prompt = {
    id: "theme-prompt", type: "category" as const, topic: "documentation tools", language: "en",
    text: "best documentation tools", enabled: true, auditCategory: "organic_discovery" as const, targetIncluded: false,
  };
  const run: PromptRun = {
    id: "theme-run", prompt, target, competitors: [competitor], providerId: "openrouter", model: "fixture/model-a",
    webSearchEnabled: false, sourceType: "api", sourceLabel: "Source: fixture API", status: "completed",
    startedAt: "2026-09-03T00:00:00.000Z", finishedAt: "2026-09-03T00:00:01.000Z",
    result: {
      providerId: "openrouter", providerName: "Fixture", sourceType: "api", sourceLabel: "Source: fixture API",
      resultCaveat: "Fixture API answer.", model: "fixture/model-a", modelVersion: "fixture/model-a",
      text: "TargetDocs helps teams publish documentation. Forge is another documentation tool.",
      citations: [], webQueries: [], tokenUsage: { input: 10, output: 20, total: 30 },
      costUsd: 0, latencyMs: 1, createdAt: "2026-09-03T00:00:01.000Z",
    },
    analysis: {
      citations: [],
      mentions: [{
        entityId: target.id, entityName: target.name, entityType: "target", count: 1, firstPosition: 0,
        rankPosition: 1, mentionType: "recommendation", sentiment: "positive", isMentioned: true,
        isRecommendation: true, isFirstPosition: true, hasCitation: false, hasOfficialLink: false,
        context: "TargetDocs helps teams publish documentation.", paragraph: "TargetDocs helps teams publish documentation.",
      }],
    },
  };
  const audit: AuditRun = {
    id: "theme-audit", target, competitors: [competitor], prompts: [prompt],
    providerTargets: [{ providerId: "openrouter", model: "fixture/model-a" }],
    domainProfile: {
      domain: "target.example", brandName: "TargetDocs", aliases: [], category: "documentation tools",
      description: "A documentation tool for teams.", competitors: [{ name: "Forge", domain: "forge.example", reason: "Documentation tool" }],
      promptSuggestions: [],
    },
    runs: [run], startedAt: "2026-09-03T00:00:00.000Z", finishedAt: "2026-09-03T00:00:01.000Z",
  };
  return renderDashboardHtml({ audit, metrics: {} as AuditMetrics, gaps: {} as GeoGapAnalysis, generatedAt: "2026-09-03T00:00:01.000Z" });
}

test("generated HTML report dark baseline", async ({ page }) => {
  await page.setContent(generatedReportHtml(), { waitUntil: "load" });
  await expect(page.locator("h1")).toBeVisible();
  await expectDarkScreenshot(page, "generated-report-dark.png");
});

test("generated HTML report light palette", async ({ page }) => {
  await page.setContent(generatedReportHtml(), { waitUntil: "load" });
  await page.evaluate(() => (window as Window & { niubigeoTheme: { setPreference: (value: string) => void } }).niubigeoTheme.setPreference("light"));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".source-note")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page).toHaveScreenshot("generated-report-light.png", screenshotOptions);
});

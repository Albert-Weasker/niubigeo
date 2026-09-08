import { spawn, type ChildProcess } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const validationRoot = join(process.cwd(), "validation", "rebuild-phase-4-2026-09-07");
const screenshots = join(validationRoot, "screenshots");
const results: Array<{ id: string; status: string; screenshot: string; assertions: number }> = [];
const networkAttempts: Array<{ url: string; method: string; external: boolean }> = [];
let temporaryRoot = "";
let baseUrl = "";
let server: ChildProcess | undefined;
let realArchiveRoot = "";
let realArchiveServer: ChildProcess | undefined;
let realArchiveBaseUrl = "";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function freePort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => resolve());
  });
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local test port.");
  await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function startServer(): Promise<void> {
  const port = await freePort();
  temporaryRoot = await mkdtemp(join(tmpdir(), "niubigeo-phase4-browser-"));
  server = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "test/fixtures/phase4-product-server-v2.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), PRODUCT_DATA_DIR: temporaryRoot, RUNS_DIR: join(temporaryRoot, "runs"), MONITORING_DATA_DIR: join(temporaryRoot, "monitoring") },
    stdio: "ignore",
  });
  baseUrl = `http://127.0.0.1:${port}`;
  for (let index = 0; index < 80; index += 1) {
    try {
      if ((await fetch(`${baseUrl}/health`)).status === 200) return;
    } catch {
      // The product server is not listening yet.
    }
    await wait(50);
  }
  throw new Error("Phase 4 product server did not start.");
}

async function stopServer(): Promise<void> {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server?.once("exit", () => resolve()));
  }
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
}

async function startRealArchiveServer(): Promise<void> {
  const referencePath = (await readFile(join(process.cwd(), "validation", "rebuild-phase-3-2026-09-06", "niubistar-live-current-path.txt"), "utf8")).trim();
  const sourceData = join(referencePath, "product-data");
  realArchiveRoot = await mkdtemp(join(tmpdir(), "niubigeo-phase4-real-archive-"));
  await cp(sourceData, join(realArchiveRoot, "product-data"), { recursive: true });
  const port = await freePort();
  realArchiveServer = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "src/product/product-server.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), PRODUCT_DATA_DIR: join(realArchiveRoot, "product-data"), RUNS_DIR: join(realArchiveRoot, "runs"), MONITORING_DATA_DIR: join(realArchiveRoot, "monitoring") },
    stdio: "ignore",
  });
  realArchiveBaseUrl = `http://127.0.0.1:${port}`;
  for (let index = 0; index < 80; index += 1) {
    try {
      if ((await fetch(`${realArchiveBaseUrl}/health`)).status === 200) return;
    } catch {
      // The copied real archive server is not listening yet.
    }
    await wait(50);
  }
  throw new Error("Copied real archive server did not start.");
}

async function stopRealArchiveServer(): Promise<void> {
  if (realArchiveServer && realArchiveServer.exitCode === null) {
    realArchiveServer.kill("SIGTERM");
    await new Promise<void>((resolve) => realArchiveServer?.once("exit", () => resolve()));
  }
  if (realArchiveRoot) await rm(realArchiveRoot, { recursive: true, force: true });
}

async function createProject(page: Page, domain: string, name: string): Promise<string> {
  await page.getByTestId("new-project").click();
  await page.locator("#project-domain").fill(domain);
  await page.locator("#project-name").fill(name);
  await page.getByTestId("save-draft").click();
  await expect(page.getByTestId("selected-project-title")).toHaveText(name);
  await expect(page.getByTestId("project-drawer")).toHaveAttribute("aria-hidden", "true");
  return page.getByTestId("project-select").inputValue();
}

async function configure(page: Page, selected: Array<{ id: string; mode: "off" | "provider_native" }>): Promise<void> {
  await page.getByRole("button", { name: "AI 模型", exact: true }).click();
  await expect(page.getByTestId("catalog-model").first()).toBeVisible();
  for (const model of selected) {
    await page.locator(`[data-model-checkbox="${model.id}"]`).check();
    if (model.mode === "provider_native") await page.locator(`[data-model-mode="${model.id}"]`).selectOption("provider_native");
  }
  await page.getByTestId("save-models").click();
  await page.getByRole("button", { name: "监测配置", exact: true }).click();
  await page.getByTestId("save-monitoring-configuration").click();
  await expect(page.getByTestId("save-monitoring-configuration")).toBeDisabled();
}

async function createRun(page: Page): Promise<void> {
  await page.getByRole("button", { name: "域名认知", exact: true }).click();
  await page.getByTestId("start-recognition").click();
  await expect(page.getByTestId("recognition-model-run").first()).not.toContainText("正在调用", { timeout: 8_000 });
}

async function openReport(page: Page): Promise<void> {
  await page.getByRole("button", { name: "当前报告", exact: true }).click();
  await expect(page.getByTestId("recognition-report")).toBeVisible({ timeout: 8_000 });
}

test.beforeAll(startServer);

test.beforeEach(async ({ page }) => {
  page.on("request", (request) => {
    const parsed = new URL(request.url());
    const external = parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost";
    networkAttempts.push({ url: request.url(), method: request.method(), external });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  await mkdir(screenshots, { recursive: true });
  const id = testInfo.title.slice(0, 3);
  const screenshot = join(screenshots, `${id}-${testInfo.status}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ id, status: testInfo.status, screenshot, assertions: 1 });
});

test.afterAll(async () => {
  await mkdir(validationRoot, { recursive: true });
  await writeFile(join(validationRoot, "browser-results.json"), `${JSON.stringify({ fixtureScenarioCount: 6, realArchiveScenarioCount: 1, passed: results.filter((item) => item.status === "passed").length, failed: results.filter((item) => item.status !== "passed").length, browserTestFiles: 1, actionAssertions: results.reduce((total, item) => total + item.assertions, 0), results }, null, 2)}\n`, "utf8");
  await writeFile(join(validationRoot, "network-audit.json"), `${JSON.stringify({ attemptCount: networkAttempts.length, externalAttemptCount: networkAttempts.filter((item) => item.external).length, attempts: networkAttempts }, null, 2)}\n`, "utf8");
  await stopServer();
  await stopRealArchiveServer();
});

test("B01 opens the fixed A1 report with four model positions and execution modes", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, "target.example", "Target A");
  await configure(page, [{ id: "fixture/model-a", mode: "off" }, { id: "fixture/model-b", mode: "off" }, { id: "fixture/model-c", mode: "provider_native" }, { id: "fixture/model-d", mode: "off" }]);
  await createRun(page);
  await openReport(page);
  await expect(page.getByTestId("report-model-card")).toHaveCount(4);
  await expect(page.getByText("不联网域名认知", { exact: true })).toBeVisible();
  await expect(page.getByText("Provider 原生联网发现", { exact: true })).toBeVisible();
  await expect(page.getByTestId("report-model-card").filter({ hasText: "Fixture Model D" })).toContainText("本次请求失败");
});

test("B02 switches a single report snapshot between all, A, C, and all models", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, "switch.example", "Target Switch");
  await configure(page, [{ id: "fixture/model-a", mode: "off" }, { id: "fixture/model-c", mode: "provider_native" }]);
  await createRun(page);
  await openReport(page);
  await page.getByRole("button", { name: "Fixture Model A", exact: true }).click();
  await expect(page.getByTestId("report-model-card")).toHaveCount(1);
  await expect(page.getByText("开发者文档工具", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fixture Model C", exact: true }).click();
  await expect(page.getByTestId("report-model-card")).toHaveCount(1);
  await expect(page.getByText("团队知识库工具", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "全部模型", exact: true }).click();
  await expect(page.getByTestId("report-model-card")).toHaveCount(2);
});

test("B03 keeps same-name competitors and their keywords separated by host", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, "matrix.example", "Target Matrix");
  await configure(page, [{ id: "fixture/model-a", mode: "off" }, { id: "fixture/model-c", mode: "provider_native" }]);
  await createRun(page);
  await openReport(page);
  await expect(page.getByTestId("report-competitor-matrix")).toContainText("forge.example");
  await expect(page.getByTestId("report-competitor-matrix")).toContainText("forge-alt.example");
  await page.getByTestId("report-competitor-select").selectOption({ label: "Forge · forge-alt.example" });
  await expect(page.getByText("团队协作", { exact: true })).toBeVisible();
  await expect(page.getByText("版本管理", { exact: true })).toHaveCount(0);
});

test("B04 separates provider citations, answer URLs, and raw-answer evidence", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, "sources.example", "Target Sources");
  await configure(page, [{ id: "fixture/model-a", mode: "off" }, { id: "fixture/model-c", mode: "provider_native" }]);
  await createRun(page);
  await openReport(page);
  await expect(page.getByText("Provider Citation", { exact: true })).toBeVisible();
  await expect(page.getByText("回答正文 URL", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forge source", exact: true })).toHaveAttribute("href", "https://source.example/forge");
  await page.getByRole("button", { name: "Fixture Model C", exact: true }).click();
  await page.getByRole("button", { name: "查看证据", exact: true }).first().click();
  await expect(page.getByTestId("report-raw-answer").locator("mark")).toContainText("TargetDocs");
});

test("B05 preserves the first report after a single-model retry produces a new report version", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, "retry.example", "Target Retry");
  await configure(page, [{ id: "fixture/model-analysis-failed", mode: "off" }]);
  await createRun(page);
  await openReport(page);
  await expect(page.getByText("已收到回答，整理失败", { exact: true })).toBeVisible();
  const retryResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/retry"));
  await page.getByRole("button", { name: "单独重试", exact: true }).click();
  expect((await retryResponse).status()).toBe(202);
  await expect(page.getByTestId("report-history")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("report-history").locator("option")).toHaveCount(2);
});

test("B06 keeps project report data isolated and keeps all browser requests local", async ({ page }) => {
  await page.goto(baseUrl);
  const first = await createProject(page, "isolation-a.example", "Target Isolation A");
  await configure(page, [{ id: "fixture/model-a", mode: "off" }]);
  await createRun(page);
  await openReport(page);
  const second = await createProject(page, "other.example", "Target Isolation B");
  await configure(page, [{ id: "fixture/model-b", mode: "off" }]);
  await createRun(page);
  await openReport(page);
  await expect(page.getByText("TargetDocs", { exact: true })).toHaveCount(0);
  await page.getByTestId("project-select").selectOption(first);
  await page.getByRole("button", { name: "当前报告", exact: true }).click();
  await expect(page.getByText("TargetDocs", { exact: true })).toBeVisible();
  const foreign = await page.request.get(`${baseUrl}/api/projects/${second}/runs/not-a-run/reports`);
  expect(foreign.status()).toBe(404);
});

test("B07 opens a copied Phase 3 real-provider archive without a new provider call", async ({ page }) => {
  await startRealArchiveServer();
  await page.goto(realArchiveBaseUrl);
  await page.getByRole("button", { name: "当前报告", exact: true }).click();
  await expect(page.getByTestId("recognition-report")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("report-model-card")).toHaveCount(1);
  await expect(page.getByText("Provider Citation", { exact: true })).toBeVisible();
});

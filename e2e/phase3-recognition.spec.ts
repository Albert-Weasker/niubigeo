import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const validationRoot = join(process.cwd(), "validation", "rebuild-phase-3-2026-09-06");
const screenshotDirectory = join(validationRoot, "screenshots");
const browserResultsPath = join(validationRoot, "browser-results.json");
const scenarioRequests: Record<string, number> = {};
const scenarioResults: Array<{ scenario: string; status: string; screenshot: string }> = [];

let temporaryRoot = "";
let server: ChildProcess | undefined;
let baseUrl = "";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function unusedPort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => resolve());
  });
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local port.");
  await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function startProductServer(): Promise<void> {
  const port = await unusedPort();
  temporaryRoot = await mkdtemp(join(tmpdir(), "niubigeo-phase3-browser-"));
  server = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "test/fixtures/phase3-product-server.ts"], {
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
      // The product server has not started listening yet.
    }
    await wait(50);
  }
  throw new Error("The Phase 3 browser product server did not start.");
}

async function stopProductServer(): Promise<void> {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server?.once("exit", () => resolve()));
  }
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
}

async function screenshot(page: Page, name: string): Promise<string> {
  await mkdir(screenshotDirectory, { recursive: true });
  const path = join(screenshotDirectory, name);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function createProject(page: Page, input: { domain: string; name: string }): Promise<string> {
  await page.getByTestId("new-project").click();
  await expect(page.getByTestId("project-drawer")).toHaveAttribute("aria-hidden", "false");
  await page.locator("#project-domain").fill(input.domain);
  await page.locator("#project-name").fill(input.name);
  await page.getByTestId("save-draft").click();
  await expect(page.getByTestId("selected-project-title")).toHaveText(input.name);
  return page.getByTestId("project-select").inputValue();
}

async function configureProject(page: Page, modelIds: Array<{ id: string; mode: "off" | "provider_native" }>): Promise<void> {
  await page.getByRole("button", { name: "AI 模型", exact: true }).click();
  await expect(page.getByTestId("catalog-model").first()).toBeVisible();
  for (const model of modelIds) {
    const checkbox = page.locator(`[data-model-checkbox="${model.id}"]`);
    await checkbox.check();
    if (model.mode === "provider_native") {
      await page.locator(`[data-model-mode="${model.id}"]`).selectOption("provider_native");
    }
  }
  await page.getByTestId("save-models").click();
  await expect(page.getByText("模型配置已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "监测配置", exact: true }).click();
  await expect(page.getByTestId("save-monitoring-configuration")).toBeEnabled();
  await page.getByTestId("save-monitoring-configuration").click();
  await expect(page.getByTestId("save-monitoring-configuration")).toBeDisabled();
}

async function openRecognition(page: Page): Promise<void> {
  await page.getByRole("button", { name: "域名认知", exact: true }).click();
  await expect(page.getByRole("heading", { name: "域名认知测试", exact: true })).toBeVisible();
}

async function waitForRun(page: Page, expectedCards: number): Promise<void> {
  await expect(page.getByTestId("recognition-model-run")).toHaveCount(expectedCards, { timeout: 8_000 });
  await expect(page.getByTestId("recognition-model-run").first()).not.toContainText("正在调用", { timeout: 8_000 });
}

test.beforeAll(async () => {
  await startProductServer();
});

test.afterEach(async ({ page }, testInfo) => {
  const suffix = testInfo.title.slice(0, 1);
  const image = await screenshot(page, `phase3-${suffix}-${testInfo.status}.png`);
  scenarioResults.push({ scenario: testInfo.title, status: testInfo.status, screenshot: image });
});

test.afterAll(async () => {
  await mkdir(validationRoot, { recursive: true });
  const passed = scenarioResults.filter((result) => result.status === "passed").length;
  await writeFile(browserResultsPath, `${JSON.stringify({
    kind: "phase3_browser_acceptance",
    scenarioCount: 6,
    passed,
    failed: scenarioResults.length - passed,
    requestCounts: scenarioRequests,
    results: scenarioResults,
    temporaryProductDataDirectory: "created under system temporary directory and removed after acceptance",
  }, null, 2)}\n`, "utf8");
  await stopProductServer();
});

test("A start creates one run and exposes independent live model states", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, { domain: "browser-start.example", name: "Browser Start" });
  await configureProject(page, [
    { id: "contract/recognized", mode: "off" },
    { id: "contract/native", mode: "provider_native" },
  ]);
  await openRecognition(page);
  let postCount = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/recognition-runs")) postCount += 1;
  });
  const start = page.getByTestId("start-recognition");
  await start.click();
  await expect(page.getByTestId("start-recognition")).toHaveAttribute("data-action-state", "loading");
  await start.click({ force: true });
  await waitForRun(page, 2);
  await expect(page.getByTestId("recognition-model-run").filter({ hasText: "Recognized Fixture" })).toContainText("已完成");
  await expect(page.getByTestId("recognition-model-run").filter({ hasText: "Native Fixture" })).toContainText("已完成");
  expect(postCount).toBe(1);
  scenarioRequests.A = postCount;
});

test("B recognized evidence is visible without seeding product data", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, { domain: "browser-evidence.example", name: "Browser Evidence" });
  await configureProject(page, [{ id: "contract/recognized", mode: "off" }]);
  await openRecognition(page);
  await page.getByTestId("start-recognition").click();
  await waitForRun(page, 1);
  const card = page.getByTestId("recognition-model-run").filter({ hasText: "Recognized Fixture" });
  await expect(card).toContainText("Fixture Brand");
  await expect(card).toContainText("中文业务描述 😀");
  await expect(card).toContainText("Fixture category");
  await expect(card).toContainText("Fixture Rival One");
  await expect(card).toContainText("Fixture Rival Two");
  await expect(card).toContainText("fixture keyword");
  await expect(card).toContainText("rival one keyword");
  await expect(card).toContainText("rival two keyword");
  await card.getByRole("button", { name: "查看证据", exact: true }).first().click();
  await expect(card.locator("details.evidence-details")).toHaveAttribute("open", "");
  await expect(card.locator("pre.raw-answer mark").first()).toContainText("Fixture Brand");
  await expect(card.locator("pre.raw-answer")).toContainText("Fixture Brand");
  scenarioRequests.B = 1;
});

test("C keeps Provider Citation separate from answer URLs and labels offline evidence", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, { domain: "browser-sources.example", name: "Browser Sources" });
  await configureProject(page, [
    { id: "contract/recognized", mode: "off" },
    { id: "contract/native", mode: "provider_native" },
  ]);
  await openRecognition(page);
  await page.getByTestId("start-recognition").click();
  await waitForRun(page, 2);
  const offline = page.getByTestId("recognition-model-run").filter({ hasText: "Recognized Fixture" });
  await offline.getByText("查看原始回答与证据", { exact: true }).click();
  await expect(offline.getByText("本次未使用 Provider 原生联网。", { exact: true })).toBeVisible();
  const native = page.getByTestId("recognition-model-run").filter({ hasText: "Native Fixture" });
  await native.getByText("查看原始回答与证据", { exact: true }).click();
  await expect(native.getByText("Provider Citation", { exact: true })).toBeVisible();
  await expect(native.getByRole("link", { name: "Provider fixture citation", exact: true })).toHaveAttribute("href", "https://provider.example/citation");
  await expect(native.getByText("回答中的普通 URL", { exact: true })).toBeVisible();
  await expect(native.getByRole("link", { name: "provider.example/citation", exact: true })).toHaveAttribute("href", "https://provider.example/citation");
  await expect(native.getByRole("link", { name: "ordinary.example/reference", exact: true })).toHaveAttribute("href", "https://ordinary.example/reference");
  scenarioRequests.C = 1;
});

test("D preserves a successful model when another fails and retries only that model", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, { domain: "browser-retry.example", name: "Browser Retry" });
  await configureProject(page, [
    { id: "contract/recognized", mode: "off" },
    { id: "contract/failure", mode: "off" },
  ]);
  await openRecognition(page);
  await page.getByTestId("start-recognition").click();
  await waitForRun(page, 2);
  const successful = page.getByTestId("recognition-model-run").filter({ hasText: "Recognized Fixture" });
  const failed = page.getByTestId("recognition-model-run").filter({ hasText: "Failure Fixture" });
  await expect(successful).toContainText("Fixture Brand");
  await expect(failed).toContainText("Provider 调用失败");
  await expect(failed).toContainText("Fixture timeout");
  await failed.getByRole("button", { name: "单独重试", exact: true }).click();
  await page.waitForTimeout(1_100);
  await failed.getByText("查看原始回答与证据", { exact: true }).click();
  await expect(failed.getByText("尝试 2 · 已完成", { exact: true })).toBeVisible({ timeout: 8_000 });
  await successful.getByText("查看原始回答与证据", { exact: true }).click();
  await expect(successful.getByText("尝试 1 · 已完成", { exact: true })).toBeVisible();
  scenarioRequests.D = 2;
});

test("E projects remain isolated through the product UI and nested API boundary", async ({ page }) => {
  await page.goto(baseUrl);
  const firstId = await createProject(page, { domain: "browser-isolation-a.example", name: "Browser Isolation A" });
  await configureProject(page, [{ id: "contract/recognized", mode: "off" }]);
  await openRecognition(page);
  await page.getByTestId("start-recognition").click();
  await waitForRun(page, 1);
  const firstRuns = await page.request.get(`${baseUrl}/api/projects/${firstId}/recognition-runs`);
  expect(firstRuns.status()).toBe(200);
  const firstPayload = await firstRuns.json() as { runs: Array<{ id: string }> };
  expect(firstPayload.runs).toHaveLength(1);

  await page.getByTestId("new-project").click();
  await page.locator("#project-domain").fill("browser-isolation-b.example");
  await page.locator("#project-name").fill("Browser Isolation B");
  await page.getByTestId("save-draft").click();
  await expect(page.getByTestId("selected-project-title")).toHaveText("Browser Isolation B");
  const secondId = await page.getByTestId("project-select").inputValue();
  await configureProject(page, [{ id: "contract/native", mode: "provider_native" }]);
  await openRecognition(page);
  await page.getByTestId("start-recognition").click();
  await waitForRun(page, 1);
  await expect(page.getByTestId("recognition-model-run")).toContainText("Native Fixture");
  await page.getByTestId("project-select").selectOption(firstId);
  await page.getByRole("button", { name: "域名认知", exact: true }).click();
  await expect(page.getByTestId("project-select")).toHaveValue(firstId);
  await expect(page.getByTestId("recognition-model-run")).toContainText("Recognized Fixture");
  const foreign = await page.request.get(`${baseUrl}/api/projects/${secondId}/recognition-runs/${firstPayload.runs[0]?.id}`);
  expect(foreign.status()).toBe(404);
  scenarioRequests.E = 2;
});

test("F locally reanalyzes a saved compatibility answer without creating a second model attempt", async ({ page }) => {
  await page.goto(baseUrl);
  await createProject(page, { domain: "browser-recovery.example", name: "Browser Recovery" });
  await configureProject(page, [{ id: "contract/compatibility", mode: "provider_native" }]);
  await openRecognition(page);
  await page.getByTestId("start-recognition").click();
  await waitForRun(page, 1);
  const card = page.getByTestId("recognition-model-run").filter({ hasText: "Compatibility Fixture" });
  await expect(card).toContainText("回答已收到，本地整理失败");
  await card.getByRole("button", { name: "重新分析已有回答", exact: true }).click();
  await expect(card).toContainText("回答已收到，部分信息可用");
  await expect(card).toContainText("Compatibility Brand");
  await expect(card).toContainText("本次回答未明确返回认知状态");
  await expect(card).toContainText("本次回答未列出竞争对象");
  await card.getByText("查看原始回答与证据", { exact: true }).click();
  await expect(card.getByText("尝试 1 · 本地整理失败", { exact: true })).toBeVisible();
  await expect(card.getByText("本地整理版本 1 · 部分信息可用 · 未调用模型", { exact: true })).toBeVisible();
  await expect(card.getByText("尝试 2", { exact: false })).toHaveCount(0);
  scenarioRequests.F = 1;
});

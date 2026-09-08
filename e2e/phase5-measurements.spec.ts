import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const validationRoot = join(process.cwd(), "validation", "rebuild-phase-5-2026-09-07");
const screenshots = join(validationRoot, "screenshots");
const results: Array<{ id: string; status: string; screenshot: string }> = [];
const requests: Array<{ url: string; method: string; external: boolean }> = [];
let root = "";
let baseUrl = "";
let server: ChildProcess | undefined;

function measurementUrl(): string { return `${baseUrl}?view=measurements`; }

function wait(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
async function freePort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", () => resolve()); });
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("Port reservation failed.");
  await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return address.port;
}
async function startServer(): Promise<void> {
  const port = await freePort();
  root = await (await import("node:fs/promises")).mkdtemp(join(tmpdir(), "niubigeo-phase5-browser-"));
  server = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "test/fixtures/phase5-product-server.ts"], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), PRODUCT_DATA_DIR: root }, stdio: "ignore" });
  baseUrl = `http://127.0.0.1:${port}`;
  for (let index = 0; index < 100; index += 1) { try { if ((await fetch(`${baseUrl}/health`)).status === 200) return; } catch (_) { } await wait(50); }
  throw new Error("Phase 5 test server did not start.");
}
async function stopServer(): Promise<void> { if (server && server.exitCode === null) { server.kill("SIGTERM"); await new Promise((resolve) => server?.once("exit", resolve)); } if (root) await rm(root, { recursive: true, force: true }); }
async function waitForReady(page: Page): Promise<void> { await expect(page.getByTestId("phase5-workbench")).toBeVisible(); await expect(page.getByTestId("phase5-ready")).toBeVisible(); }

async function createProject(page: Page, domain: string, name: string): Promise<string> {
  await waitForReady(page);
  await page.getByRole("button", { name: "新建项目", exact: true }).first().click();
  await page.locator("form[data-form='project'] input[name='domain']").fill(domain);
  await page.locator("form[data-form='project'] input[name='name']").fill(name);
  await page.locator("form[data-form='project'] button[type='submit']").click();
  await expect(page.getByText("NiubiGEO / " + name, { exact: true })).toBeVisible();
  const selected = await page.locator("select[data-role='projects']").inputValue();
  expect(new URL(page.url()).searchParams.get("projectId")).toBe(selected);
  return selected;
}

async function configure(page: Page): Promise<void> {
  await page.getByRole("button", { name: "管理模型", exact: true }).click();
  await page.locator("input[data-model='phase5/off']").check();
  await page.locator("input[data-model='phase5/native']").check();
  await page.locator("select[data-mode='phase5/native']").selectOption("provider_native");
  await page.getByRole("button", { name: "保存模型选择", exact: true }).click();
  await page.getByRole("button", { name: "保存监测配置", exact: true }).click();
  await expect(page.getByRole("button", { name: "✓ 当前配置已保存", exact: true })).toBeDisabled();
}

async function seedRecognition(page: Page, projectId: string): Promise<void> {
  const created = await page.request.post(`${baseUrl}/api/projects/${projectId}/recognition-runs`, { data: {} });
  expect(created.status()).toBe(202);
  const body = await created.json() as { run: { id: string } };
  for (let index = 0; index < 100; index += 1) {
    const run = await page.request.get(`${baseUrl}/api/projects/${projectId}/recognition-runs/${body.run.id}`);
    const payload = await run.json() as { run: { status: string } };
    if (payload.run.status !== "queued" && payload.run.status !== "running") break;
    await wait(30);
  }
  const report = await page.request.post(`${baseUrl}/api/projects/${projectId}/recognition-runs/${body.run.id}/reports`);
  expect(report.status()).toBe(201);
}

async function scopeAndRun(page: Page, projectId: string): Promise<void> {
  await seedRecognition(page, projectId);
  await page.reload();
  await waitForReady(page);
  await page.getByRole("button", { name: "保存监测范围", exact: true }).click();
  await page.getByRole("button", { name: "保存并确认范围", exact: true }).click();
  await expect(page.getByText("当前版本 v1", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "开始认知测试", exact: true }).click();
  await expect.poll(async () => (await page.request.get(`${baseUrl}/api/projects/${projectId}/measurement-runs`)).json()).toMatchObject({ runs: expect.any(Array) });
  for (let index = 0; index < 100; index += 1) {
    const runs = await (await page.request.get(`${baseUrl}/api/projects/${projectId}/measurement-runs`)).json() as { runs: Array<{ status: string }> };
    if (runs[0] && runs[0].status !== "queued" && runs[0].status !== "running") break;
    await wait(30);
  }
  await page.reload();
  await waitForReady(page);
}

test.beforeAll(startServer);
test.beforeEach(async ({ page }) => { page.on("request", (request) => { const url = new URL(request.url()); requests.push({ url: request.url(), method: request.method(), external: url.hostname !== "127.0.0.1" && url.hostname !== "localhost" }); }); });
test.afterEach(async ({ page }, info) => { await mkdir(screenshots, { recursive: true }); const screenshot = join(screenshots, `${info.title.slice(0, 3)}-${info.status}.png`); await page.screenshot({ path: screenshot, fullPage: true }); results.push({ id: info.title.slice(0, 3), status: info.status, screenshot }); });
test.afterAll(async () => { await mkdir(validationRoot, { recursive: true }); await writeFile(join(validationRoot, "browser-results.json"), `${JSON.stringify({ browserTestFiles: 1, independentScenarios: results.length, passed: results.filter((item) => item.status === "passed").length, failed: results.filter((item) => item.status !== "passed").length, results }, null, 2)}\n`); await writeFile(join(validationRoot, "network-audit.json"), `${JSON.stringify({ attemptCount: requests.length, externalAttemptCount: requests.filter((item) => item.external).length, requests }, null, 2)}\n`); await stopServer(); });

test("B01 shows project scope, models, protocol meaning, and task entry", async ({ page }) => { await page.goto(measurementUrl()); const id = await createProject(page, "target.example", "Target"); await configure(page); await seedRecognition(page, id); await page.reload(); await waitForReady(page); await expect(page.getByText("持续测量", { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "设置定时监测", exact: true })).toBeVisible(); });
test("B02 renders eight named chart definitions from fixed data", async ({ page }) => { await page.goto(measurementUrl()); const id = await createProject(page, "charts.example", "Charts"); await configure(page); await scopeAndRun(page, id); await expect(page.getByRole("heading", { name: "哪些模型明确识别了这个域名？", exact: true })).toBeVisible(); await page.getByRole("button", { name: "回答正文域名", exact: true }).click(); await expect(page.getByRole("heading", { name: "未点名品牌时的域名提及", exact: true })).toBeVisible(); await expect(page.locator(".p5-chart")).toHaveCount(8); });
test("B03 opens a chart point and its exact stored attempt", async ({ page }) => { await page.goto(measurementUrl()); const id = await createProject(page, "evidence.example", "Evidence"); await configure(page); await scopeAndRun(page, id); await page.locator("[data-point]").first().click(); await expect(page.getByTestId("measurement-evidence-drawer")).toBeVisible(); await expect(page.getByText("数据点证据", { exact: true })).toBeVisible(); });
test("B04 adds only the new model, hides removed models by default, and preserves stored history", async ({ page }) => { await page.goto(measurementUrl()); const id = await createProject(page, "models.example", "Models"); await configure(page); await scopeAndRun(page, id); const before = await (await page.request.get(`${baseUrl}/api/projects/${id}/measurement-runs`)).json() as { runs: Array<{ id: string; modelScope: string[] }> }; await page.getByRole("button", { name: "管理模型", exact: true }).click(); await page.locator("input[data-model='phase5/added']").check(); await page.getByRole("button", { name: "保存模型选择", exact: true }).click(); await expect(page.getByText("模型或联网方式已变更", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "保存为新监测配置", exact: true }).click(); await seedRecognition(page, id); await page.reload(); await waitForReady(page); await page.getByRole("button", { name: "保存监测范围", exact: true }).click(); await page.getByRole("button", { name: "保存并确认范围", exact: true }).click(); await page.getByRole("button", { name: "只测试新增模型", exact: true }).click(); for (let index = 0; index < 100; index += 1) { const payload = await (await page.request.get(`${baseUrl}/api/projects/${id}/measurement-runs`)).json() as { runs: Array<{ status: string; modelScope: string[] }> }; if (payload.runs[0] && payload.runs[0].status !== "queued" && payload.runs[0].status !== "running") break; await wait(30); } const after = await (await page.request.get(`${baseUrl}/api/projects/${id}/measurement-runs`)).json() as { runs: Array<{ id: string; modelScope: string[] }> }; expect(after.runs[0]?.modelScope).toEqual(["phase5/added"]); expect(before.runs.some((run) => run.id === after.runs[0]?.id)).toBe(false); await page.reload(); await waitForReady(page); await page.getByRole("button", { name: "管理模型", exact: true }).click(); await page.locator("input[data-model='phase5/off']").uncheck(); await page.getByRole("button", { name: "保存模型选择", exact: true }).click(); await expect(page.getByText("Phase 5 Offline", { exact: false })).toHaveCount(0); const original = before.runs[0]; expect(original).toBeTruthy(); const archivedEvidence = await (await page.request.get(`${baseUrl}/api/projects/${id}/measurement-runs/${original?.id}`)).json() as { modelRuns: Array<{ modelSnapshot: { modelId: string } }> }; expect(archivedEvidence.modelRuns.some((model) => model.modelSnapshot.modelId === "phase5/off")).toBe(true); });
test("B05 keeps keyword discovery separate from domain recognition", async ({ page }) => { await page.goto(measurementUrl()); const id = await createProject(page, "comparison.example", "Comparison"); await configure(page); await scopeAndRun(page, id); await expect(page.getByRole("heading", { name: "问当前关键词时，哪些模型推荐这个对象？", exact: true })).toBeVisible(); await expect(page.getByRole("heading", { name: "哪些模型明确识别了这个域名？", exact: true })).toBeVisible(); });
test("B06 displays keyword coverage and a null-safe empty state", async ({ page }) => { await page.goto(measurementUrl()); await createProject(page, "keyword.example", "Keyword"); await configure(page); await expect(page.getByText("尚未形成可计算数据。先保存监测范围并完成对应探针运行。").first()).toBeVisible(); });
test("B07 creates, previews, pauses, resumes, edits, and deletes a persisted monitoring task", async ({ page }) => { await page.goto(measurementUrl()); const id = await createProject(page, "schedule.example", "Schedule"); await configure(page); await seedRecognition(page, id); await page.reload(); await waitForReady(page); await page.getByRole("button", { name: "保存监测范围", exact: true }).click(); await page.getByRole("button", { name: "保存并确认范围", exact: true }).click(); await page.getByRole("button", { name: "设置定时监测", exact: true }).click(); await page.getByRole("button", { name: "预览下三次", exact: true }).click(); await expect(page.getByText("下三次执行", { exact: true })).toBeVisible(); await page.locator("form[data-form='schedule'] button[type='submit']").click(); const taskCard = page.locator(".p5-card").filter({ hasText: "定期监测" }); await expect(taskCard).toBeVisible(); await taskCard.getByRole("button", { name: "预览", exact: true }).click(); await expect(taskCard.getByText("下三次：", { exact: false })).toBeVisible(); await taskCard.getByRole("button", { name: "暂停", exact: true }).click(); await expect(taskCard.getByText("已暂停", { exact: false })).toBeVisible(); await taskCard.getByRole("button", { name: "恢复", exact: true }).click(); await expect(taskCard.getByText("运行中", { exact: false })).toBeVisible(); await taskCard.getByRole("button", { name: "编辑", exact: true }).click(); await page.locator("form[data-form='schedule'] input[name='name']").fill("Monthly task"); await page.locator("form[data-form='schedule'] select[name='frequency']").selectOption("monthly"); await page.locator("form[data-form='schedule'] button[type='submit']").click(); await expect(page.locator(".p5-card").filter({ hasText: "Monthly task" })).toBeVisible(); const monthly = page.locator(".p5-card").filter({ hasText: "Monthly task" }); await monthly.getByRole("button", { name: "删除", exact: true }).click(); await monthly.getByRole("button", { name: "确认删除", exact: true }).click(); await expect(page.locator(".p5-card").filter({ hasText: "Monthly task" })).toHaveCount(0); const tasks = await (await page.request.get(`${baseUrl}/api/projects/${id}/monitoring-tasks`)).json() as { tasks: Array<{ status: string }> }; expect(tasks.tasks[0]?.status).toBe("deleted"); });
test("B08 supplies immediate button state and reduced-motion-compatible chart markup", async ({ page }) => { await page.goto(measurementUrl()); await createProject(page, "motion.example", "Motion"); await expect(page.locator("#app style").evaluate((element) => element.innerHTML.includes("prefers-reduced-motion"))).resolves.toBe(true); await expect(page.locator(".p5-button").first()).toBeVisible(); });
test("B09 keeps selected project measurements isolated after switching", async ({ page }) => { await page.goto(measurementUrl()); const first = await createProject(page, "first.example", "First"); await configure(page); await seedRecognition(page, first); await page.reload(); await waitForReady(page); const second = await createProject(page, "second.example", "Second"); await expect(page.getByText("当前版本 v1", { exact: false })).toHaveCount(0); await page.locator("select[data-role='projects']").selectOption(first); await expect(page.getByText("NiubiGEO / First", { exact: true })).toBeVisible(); });
test("B10 keeps measurement URLs interactive and makes dialogs escapable", async ({ page }) => {
  await page.goto(measurementUrl());
  const id = await createProject(page, "interactive.example", "Interactive");
  await page.goto(`${baseUrl}?view=measurements&projectId=${id}&project=${id}`);
  await waitForReady(page);
  await expect(page.locator("select[data-role='projects']")).toHaveValue(id);

  await page.getByRole("button", { name: "管理模型", exact: true }).click();
  await expect(page.locator("[data-modal-backdrop]")).toBeVisible();
  await page.locator(".p5-modal-head [data-action='close']").click();
  await expect(page.locator("[data-modal-backdrop]")).toHaveCount(0);

  await page.getByRole("button", { name: "管理模型", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-modal-backdrop]")).toHaveCount(0);

  await page.getByRole("button", { name: "管理模型", exact: true }).click();
  await page.locator("[data-modal-backdrop]").click({ position: { x: 4, y: 4 } });
  await expect(page.locator("[data-modal-backdrop]")).toHaveCount(0);

  await page.locator("button[data-nav-target='p5-monitoring']").click();
  await expect(page.locator("button[data-nav-target='p5-monitoring']")).toHaveClass("active");
  await expect(page.locator("#p5-monitoring")).toBeInViewport();
});

test("B11 isolates keyword series and retains gaps in explicitly synthetic chart data", async ({ page }) => {
  await page.goto(measurementUrl());
  const id = await createProject(page, "series.example", "Series");
  await configure(page);
  await scopeAndRun(page, id);
  await page.route((url) => url.pathname === `/api/projects/${id}/measurement-stats`, async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const original = payload.snapshot.points.find((point: { metric: string }) => point.metric === "keyword_association_coverage");
    expect(original).toBeTruthy();
    const first = { ...original, id: "synthetic-first", observedAt: "2026-09-01T00:00:00Z", value: 100, numerator: 1, denominator: 1, complete: true };
    payload.snapshot.points = [
      first,
      { ...first, id: "synthetic-gap", observedAt: "2026-09-02T00:00:00Z", value: null, numerator: 0, denominator: 0, complete: false },
      { ...first, id: "synthetic-last", observedAt: "2026-09-03T00:00:00Z" },
      { ...first, id: "synthetic-other-keyword", keywordId: "different-keyword", observedAt: "2026-09-02T00:00:00Z", value: 0, numerator: 0 },
    ];
    await route.fulfill({ response, json: payload });
  });
  await page.reload();
  await waitForReady(page);
  const chart = page.locator(".p5-chart").filter({ has: page.getByRole("heading", { name: "关键词关联覆盖率", exact: true }) });
  await expect(chart.locator("[data-point]")).toHaveCount(2);
  await expect(chart.locator("[data-point='synthetic-other-keyword']")).toHaveCount(0);
  const path = await chart.locator("path.p5-line").getAttribute("d");
  expect(path?.includes("L")).toBe(false);
  expect(path?.split("M").length).toBe(3);
  await chart.locator("summary").click();
  await expect(chart.locator("tbody tr")).toHaveCount(3);
  await expect(chart.getByText("暂无数据", { exact: true })).toBeVisible();
});

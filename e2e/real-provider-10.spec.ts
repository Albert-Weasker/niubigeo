import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

type CaseReference = { caseId: string; projectId: string; domain: string; language: "zh" | "en"; manualRunId?: string; scheduledRunId?: string };
type Index = { cycleId: string; cases: CaseReference[] };

const root = process.cwd();
const cycleId = process.env.NIUBIGEO_REAL_PROVIDER_CYCLE || "real-provider-10-2026-09-07-final";
const validationRoot = join(root, "validation", cycleId);
const productDataRoot = join(validationRoot, "product-data");
const indexPath = join(validationRoot, "case-index.json");
const screenshotRoot = join(root, "examples", "real-provider-10", "screenshots");
const available = existsSync(indexPath);
const index: Index = available ? JSON.parse(readFileSync(indexPath, "utf8")) as Index : { cycleId: "not-run", cases: [] };
const screenshotRows: Array<{ caseId: string; kind: "overview" | "trends" | "evidence"; path: string; sha256: string; capturedAt: string; url: string; projectId: string }> = [];
let server: ChildProcess | undefined;
let baseUrl = "";

function hash(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function wait(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function measurementUrl(projectId: string): string { return `${baseUrl}/?view=measurements&project=${encodeURIComponent(projectId)}`; }

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
  server = spawn(process.execPath, [join(root, "node_modules", "tsx", "dist", "cli.mjs"), "src/product/product-server.ts"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), PRODUCT_DATA_DIR: productDataRoot, PROVIDER_HTTP_ATTEMPTS: "1" },
    stdio: "ignore",
  });
  baseUrl = `http://127.0.0.1:${port}`;
  for (let indexValue = 0; indexValue < 100; indexValue += 1) {
    try { if ((await fetch(`${baseUrl}/health`)).status === 200) return; } catch { }
    await wait(50);
  }
  throw new Error("Real-provider evidence server did not start.");
}

async function stopServer(): Promise<void> {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server?.once("exit", resolve));
  }
}

async function capture(page: import("@playwright/test").Page, value: CaseReference, kind: "overview" | "trends" | "evidence", target: import("@playwright/test").Locator): Promise<void> {
  await mkdir(screenshotRoot, { recursive: true });
  const path = join(screenshotRoot, `${value.caseId}-${kind}.png`);
  await target.screenshot({ path });
  screenshotRows.push({ caseId: value.caseId, kind, path, sha256: hash(readFileSync(path)), capturedAt: new Date().toISOString(), url: page.url(), projectId: value.projectId });
}

test.beforeAll(async () => {
  test.skip(!available, "Real Provider archive does not exist. This browser suite is replay-only and does not create Provider calls.");
  await startServer();
});

test.afterAll(async () => {
  await stopServer();
  if (!available) return;
  await mkdir(validationRoot, { recursive: true });
  await writeFile(join(validationRoot, "screenshot-manifest.json"), `${JSON.stringify({ cycleId: index.cycleId, generatedAt: new Date().toISOString(), screenshots: screenshotRows }, null, 2)}\n`);
});

if (!available) {
  test("real Provider browser evidence is unavailable before the paid validation cycle", { skip: true }, async () => {});
} else {
  for (const value of index.cases) {
    test(`${value.caseId} opens the real project through normal navigation and captures archived evidence`, async ({ page }) => {
      await page.goto(`${baseUrl}/?project=${encodeURIComponent(value.projectId)}`);
      await expect(page.getByTestId("phase4-root")).toBeVisible();
      await page.locator("[data-phase5-open]").click();
      await expect.poll(() => page.url().includes("view=measurements") && page.url().includes(`project=${value.projectId}`)).toBe(true);
      await expect(page.getByTestId("phase5-workbench")).toBeVisible();
      await expect(page.getByText(value.domain, { exact: false })).toBeVisible();
      await capture(page, value, "overview", page.locator(".p5-shell"));
      const chart = page.locator(".p5-chart").first();
      await expect(chart).toBeVisible();
      await capture(page, value, "trends", chart);
      const point = page.locator("[data-point]").first();
      if (await point.count()) {
        await point.click();
        await expect(page.getByTestId("measurement-evidence-drawer")).toBeVisible();
        await capture(page, value, "evidence", page.getByTestId("measurement-evidence-drawer"));
      } else {
        await capture(page, value, "evidence", chart);
      }
    });
  }
}

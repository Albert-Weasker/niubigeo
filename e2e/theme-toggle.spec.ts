import type { Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { Phase4FixtureCatalog, Phase4FixtureExecutor } from "../test/fixtures/phase4-fixture-adapter.js";

let server: Server;
let baseUrl = "";
let dataRoot = "";
let priorDataDir: string | undefined;
let priorKey: string | undefined;

test.beforeAll(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "niubigeo-theme-toggle-"));
  priorDataDir = process.env.PRODUCT_DATA_DIR;
  priorKey = process.env.OPENROUTER_API_KEY;
  process.env.PRODUCT_DATA_DIR = dataRoot;
  process.env.OPENROUTER_API_KEY = "theme-toggle-fixture-key";
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
  if (!address || typeof address === "string") throw new Error("Missing theme test server address.");
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

test("theme cycles, persists, and follows the operating system", async ({ page }) => {
  await page.goto(baseUrl);
  const toggle = page.locator("[data-theme-toggle]");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveText("Theme: Dark");
  await expect(toggle).toHaveAccessibleName("Theme: Dark. Activate to switch to Light.");
  expect(await toggle.evaluate((button) => button.nextElementSibling?.matches("[data-connect-key]"))).toBe(true);
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveText("Theme: Light");
  await expect(toggle).toHaveAccessibleName("Theme: Light. Activate to switch to System.");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("niubigeo-theme"))).toBe("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await toggle.click();
  await expect(toggle).toHaveText("Theme: System");
  await expect(toggle).toHaveAccessibleName("Theme: System. Activate to switch to Dark.");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("provider key dialog uses light surfaces and its own submit colors", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("niubigeo-theme", "light"));
  await page.goto(baseUrl);
  await page.locator("[data-connect-key]").click();
  await expect(page.locator("#openrouter-key-dialog")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator("#openrouter-key-input")).toHaveCSS("border-color", "rgb(138, 144, 156)");
  await expect(page.locator("#save-openrouter-key")).toHaveCSS("background-color", "rgb(23, 32, 51)");
  await expect(page.locator("#save-openrouter-key")).toHaveCSS("color", "rgb(255, 255, 255)");
});

for (const [locale, names] of [
  ["zh", ["主题：深色。按下可切换为浅色。", "主题：浅色。按下可切换为跟随系统。", "主题：跟随系统。按下可切换为深色。"]],
  ["pt-BR", ["Tema: Escuro. Ative para mudar para Claro.", "Tema: Claro. Ative para mudar para Sistema.", "Tema: Sistema. Ative para mudar para Escuro."]],
] as const) {
  test(`${locale} theme control labels`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("niubigeo.product.locale", value), locale);
    await page.goto(baseUrl);
    const toggle = page.locator("[data-theme-toggle]");
    for (const name of names) {
      await expect(toggle).toHaveAccessibleName(name);
      await toggle.click();
    }
  });
}

for (const [route, name, ready] of [
  ["/", "dashboard", "[data-connect-key]"],
  ["/?view=measurements", "measurements", "[data-testid=phase5-workbench]"],
  ["/?view=keyword-monitoring", "keyword-monitoring", "h1"],
] as const) {
  test(`${name} dark and light screenshots`, async ({ page }) => {
    await page.goto(`${baseUrl}${route}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(ready)).toBeVisible();
    await page.screenshot({ path: `test-results/theme/${name}-dark.png`, fullPage: true, animations: "disabled" });
    await page.locator("[data-theme-toggle]").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator(ready)).toBeVisible();
    await page.screenshot({ path: `test-results/theme/${name}-light.png`, fullPage: true, animations: "disabled" });
  });
}

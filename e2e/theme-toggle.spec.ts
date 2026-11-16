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

test("theme menu selects, persists, and follows the operating system", async ({ page }) => {
  await page.goto(baseUrl);
  const toggle = page.locator("[data-theme-toggle]");
  const menu = page.locator("[data-theme-options]");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAccessibleName("Theme: Dark. Choose theme.");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await toggle.evaluate((button) => button.parentElement?.previousElementSibling?.matches("[data-connect-key]"))).toBe(true);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 720 });
    const positions = await page.evaluate(() => ({
      bar: document.querySelector(".key-workbench-bar")!.getBoundingClientRect().right,
      theme: document.querySelector("[data-theme-toggle]")!.getBoundingClientRect().right,
      connect: document.querySelector("[data-connect-key]")!.getBoundingClientRect().right,
    }));
    expect(positions.theme).toBeGreaterThan(positions.connect);
    expect(positions.bar - positions.theme).toBeLessThanOrEqual(24);
  }
  await expect(menu).toBeHidden();
  await toggle.click();
  await expect(menu).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  await menu.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveAccessibleName("Theme: Light. Choose theme.");
  await expect(menu).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("niubigeo-theme"))).toBe("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await toggle.focus();
  await page.keyboard.press("ArrowDown");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitemradio", { name: "Light" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.keyboard.press("Shift+Tab");
  await expect(menu).toBeHidden();
  await toggle.click();
  await menu.getByRole("menuitemradio", { name: "System" }).click();
  await expect(toggle).toHaveAccessibleName("Theme: System. Choose theme.");
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
  ["zh", ["主题：深色。选择主题。", "主题：浅色。选择主题。", "主题：跟随系统。选择主题。", "浅色", "跟随系统"]],
  ["pt-BR", ["Tema: Escuro. Escolher tema.", "Tema: Claro. Escolher tema.", "Tema: Sistema. Escolher tema.", "Claro", "Sistema"]],
] as const) {
  test(`${locale} theme control labels`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("niubigeo.product.locale", value), locale);
    await page.goto(baseUrl);
    const toggle = page.locator("[data-theme-toggle]");
    await expect(toggle).toHaveAccessibleName(names[0]);
    await toggle.click();
    await page.getByRole("menuitemradio", { name: names[3] }).click();
    await expect(toggle).toHaveAccessibleName(names[1]);
    await toggle.click();
    await page.getByRole("menuitemradio", { name: names[4] }).click();
    await expect(toggle).toHaveAccessibleName(names[2]);
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
    await page.locator('[data-theme-option="light"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator(ready)).toBeVisible();
    await page.screenshot({ path: `test-results/theme/${name}-light.png`, fullPage: true, animations: "disabled" });
  });
}

import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createProductServer } from "../src/product/product-server.js";

let root = "";
let baseUrl = "";
let server: Server;
let previousDataDir: string | undefined;

const hasHan = (value: string) => [...value].some((character) => {
  const point = character.codePointAt(0) || 0;
  return point >= 0x3400 && point <= 0x9fff;
});

test.beforeAll(async () => {
  previousDataDir = process.env.PRODUCT_DATA_DIR;
  root = await mkdtemp(join(tmpdir(), "niubigeo-locale-creation-"));
  process.env.PRODUCT_DATA_DIR = root;
  server = createProductServer({ modelCatalog: { list: async () => [] } });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (previousDataDir === undefined) delete process.env.PRODUCT_DATA_DIR;
  else process.env.PRODUCT_DATA_DIR = previousDataDir;
  if (root) await rm(root, { recursive: true, force: true });
});

const preferences = [
  { label: "Portuguese", locale: "pt-BR", language: "pt-BR" },
  { label: "English", locale: "en", language: "en" },
  { label: "Chinese", locale: "zh", language: "zh-CN" },
  { label: "missing preference", locale: null, language: "zh-CN" },
  { label: "unsupported preference", locale: "unsupported", language: "zh-CN" },
];

for (const view of ["overview", "measurements"]) {
  for (const preference of preferences) {
    test(`${view} project creation persists ${preference.label}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      if (preference.locale === "unsupported") {
        await page.addInitScript(() => localStorage.setItem("niubigeo.product.locale", "unsupported"));
      }
      await page.goto(`${baseUrl}/${view === "measurements" ? "?view=measurements" : ""}`);
      if (preference.locale && preference.locale !== "unsupported") {
        // Select the language through the actual control, including its persistence/reload behavior.
        await page.locator(`[data-product-locale="${preference.locale}"]`).click();
      }
      await expect(page.locator("html")).toHaveAttribute("lang", preference.language);
      if (preference.locale === "pt-BR") {
        const interfaceText = await page.locator("body").innerText();
        expect(hasHan(interfaceText), interfaceText).toBe(false);
      }

      const suffix = `${view}-${preference.locale || "missing"}`.toLowerCase();
      const domain = `${suffix}.example`;
      const name = `Locale project ${suffix}`;
      if (view === "measurements") {
        await expect(page.getByTestId("phase5-ready")).toBeVisible();
        await page.locator('[data-action="create"]').first().click();
        await page.locator('form[data-form="project"] input[name="domain"]').fill(domain);
        await page.locator('form[data-form="project"] input[name="name"]').fill(name);
      } else {
        await page.getByTestId("new-project").click();
        await page.locator("#project-domain").fill(domain);
        await page.locator("#project-name").fill(name);
      }
      const createdResponse = page.waitForResponse((response) =>
        response.url() === `${baseUrl}/api/projects` && response.request().method() === "POST",
      );
      await (view === "measurements"
        ? page.locator('form[data-form="project"] button[type="submit"]')
        : page.getByTestId("save-draft")).click();
      const response = await createdResponse;
      expect(response.status()).toBe(201);
      const { project } = await response.json();
      expect(project).toMatchObject({ name, normalizedDomain: domain, defaultLanguage: preference.language });

      // Read the actual file as well as the endpoint so an in-memory/request-only fix cannot pass.
      const stored = JSON.parse(await readFile(join(root, "projects", project.id, "project.json"), "utf8"));
      expect(stored).toMatchObject({ id: project.id, name, defaultLanguage: preference.language });
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", preference.language);
      if (preference.locale === "pt-BR") {
        const interfaceText = await page.locator("body").innerText();
        expect(hasHan(interfaceText), interfaceText).toBe(false);
      }
      const fetched = await page.request.get(`${baseUrl}/api/projects/${project.id}`);
      expect(fetched.status()).toBe(200);
      expect(await fetched.json()).toMatchObject({ project: { id: project.id, defaultLanguage: preference.language } });
      expect(errors).toEqual([]);
    });
  }
}

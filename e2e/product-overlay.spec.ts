import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { renderProductPhase5AppHtml } from "../src/ui/product-phase5-app.js";

let server: Server;
let baseUrl = "";
let previousAdvisorSetting: string | undefined;

test.beforeAll(async () => {
  previousAdvisorSetting = process.env.NIUBIGEO_VIDEO_ADVISOR_ENABLED;
  process.env.NIUBIGEO_VIDEO_ADVISOR_ENABLED = "true";
  server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(renderProductPhase5AppHtml());
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
  if (previousAdvisorSetting === undefined) delete process.env.NIUBIGEO_VIDEO_ADVISOR_ENABLED;
  else process.env.NIUBIGEO_VIDEO_ADVISOR_ENABLED = previousAdvisorSetting;
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`advisor cannot intercept model-save clicks at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem("niubigeo.product.locale", "pt-BR"));
    await context.route("https://niubigeo.ai/**", (route) => route.abort());
    const project = { id: "overlay-project", name: "Fixture", normalizedDomain: "fixture.example" };
    const model = { modelId: "fixture/model", displayName: "Fixture model", nativeWebSearchSupported: true, webSearchMode: "off" };
    const writes: unknown[] = [];
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: object = {};
      if (path === "/api/projects") body = { projects: [project] };
      else if (path === "/api/provider-models") body = { models: [model] };
      else if (path.endsWith("/models")) {
        if (route.request().method() === "PUT") writes.push(route.request().postDataJSON());
        body = { selections: [model] };
      } else if (path.endsWith("/baselines")) body = { baselines: [] };
      else if (path.endsWith("/watch-sets")) body = { watchSets: [] };
      else if (path.endsWith("/measurement-runs")) body = { runs: [] };
      else if (path.endsWith("/monitoring-tasks")) body = { tasks: [] };
      else if (path.endsWith("/monitoring-configuration")) body = { configuration: null };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(`${baseUrl}/?view=measurements`);
    await expect(page.locator("[data-niubigeo-advisor]")).toBeVisible();
    await page.locator('[data-action="models"]').click();
    const save = page.locator('[data-action="save-models"]');
    await expect(save).toBeVisible();
    expect(await save.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      return [
        [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2],
        [bounds.right - 8, bounds.bottom - 8],
      ].every(([x, y]) => button.contains(document.elementFromPoint(x!, y!)));
    })).toBe(true);
    await save.click();
    await expect.poll(() => writes).toEqual([{ selections: [{ modelId: model.modelId, webSearchMode: "off" }] }]);
    expect(context.pages()).toHaveLength(1);
  });
}

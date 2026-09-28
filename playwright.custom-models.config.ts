import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "custom-models.spec.ts", workers: 1,
  outputDir: "validation/multi-model-2026-09-28/browser",
  reporter: [["list"], ["html", { outputFolder: "validation/multi-model-2026-09-28/report", open: "never" }]],
  use: { browserName: "chromium", reducedMotion: "reduce", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }, trace: "retain-on-failure" },
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase2-configuration.spec.ts",
  outputDir: "validation/rebuild-phase-2-2026-09-05/playwright-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "validation/rebuild-phase-2-2026-09-05/playwright-report", open: "never" }],
  ],
  workers: 1,
  use: {
    browserName: "chromium",
    launchOptions: {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    trace: "on",
    screenshot: "off",
    video: "off",
  },
});

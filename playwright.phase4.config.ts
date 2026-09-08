import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase4-reports.spec.ts",
  outputDir: "validation/rebuild-phase-4-2026-09-07/traces",
  reporter: [
    ["list"],
    ["html", { outputFolder: "validation/rebuild-phase-4-2026-09-07/playwright-report", open: "never" }],
  ],
  workers: 1,
  use: {
    browserName: "chromium",
    launchOptions: { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
    trace: "on",
    screenshot: "off",
    video: "off",
  },
});

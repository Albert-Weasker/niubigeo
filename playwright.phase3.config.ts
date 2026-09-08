import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase3-recognition.spec.ts",
  outputDir: "validation/rebuild-phase-3-2026-09-06/traces",
  reporter: [
    ["list"],
    ["html", { outputFolder: "validation/rebuild-phase-3-2026-09-06/playwright-report", open: "never" }],
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

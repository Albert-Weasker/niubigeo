import { defineConfig } from "@playwright/test";

const cycleId = process.env.NIUBIGEO_REAL_PROVIDER_CYCLE || "real-provider-10-2026-09-07-final";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "real-provider-10.spec.ts",
  outputDir: `validation/${cycleId}/traces`,
  reporter: [["list"], ["html", { outputFolder: `validation/${cycleId}/playwright-report`, open: "never" }]],
  workers: 1,
  use: {
    browserName: "chromium",
    launchOptions: { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
    trace: "on",
    screenshot: "off",
    video: "off",
  },
});

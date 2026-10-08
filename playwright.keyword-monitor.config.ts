import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"./e2e",testMatch:"keyword-monitor.spec.ts",workers:1,use:{browserName:"chromium",launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}}});

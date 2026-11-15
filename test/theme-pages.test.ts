import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderAppHtml } from "../src/ui/app-html.js";
import { renderKeywordMonitoringAppHtml } from "../src/ui/keyword-monitoring-app.js";
import { renderProductPhase2AppHtml } from "../src/ui/product-phase2-app.js";
import { renderProductPhase4AppHtml } from "../src/ui/product-phase4-app.js";
import { renderProductPhase5AppHtml } from "../src/ui/product-phase5-app.js";
import { renderProductProjectAppHtml } from "../src/ui/product-project-app.js";
import { THEME_TOKENS_CSS } from "../src/ui/theme-tokens.js";

test("every rendered UI shell initializes the theme before paint", () => {
  const pages = {
    workbench: renderAppHtml(),
    project: renderProductProjectAppHtml(),
    product: renderProductPhase2AppHtml(),
    reports: renderProductPhase4AppHtml(),
    measurements: renderProductPhase5AppHtml(),
    keywords: renderKeywordMonitoringAppHtml(),
  };
  for (const [name, html] of Object.entries(pages)) {
    const headEnd = html.indexOf("</head>");
    assert.ok(headEnd > 0, name);
    const head = html.slice(0, headEnd);
    assert.ok(head.includes('name="color-scheme" content="dark light"'), name);
    assert.ok(head.includes("niubigeo-theme"), name);
    assert.ok(head.includes(':root[data-theme="light"]'), name);
    assert.ok(head.includes("--border-control: #8a909c"), name);
  }
});

test("theme definitions are literal and UI colors live in the token sheet", () => {
  assert.equal(THEME_TOKENS_CSS.includes("color-mix("), false);
  for (const name of readdirSync("src/ui").filter((file) => file.endsWith(".ts"))) {
    if (["theme-tokens.ts", "brand.ts", "video-advisor.ts"].includes(name)) continue;
    const source = readFileSync(join("src/ui", name), "utf8");
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(source), false, name);
  }
});

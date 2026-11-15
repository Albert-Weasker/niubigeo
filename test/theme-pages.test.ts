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
  const hexDigits = "0123456789abcdefABCDEF";
  const hasColorLiteral = (source: string): boolean => {
    if (source.includes("rgb(") || source.includes("rgba(")) return true;
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] !== "#") continue;
      let end = index + 1;
      while (end < source.length && hexDigits.includes(source[end]!)) end += 1;
      if (end - index - 1 >= 3 && end - index - 1 <= 8) return true;
    }
    return false;
  };
  for (const name of readdirSync("src/ui").filter((file) => file.endsWith(".ts"))) {
    if (["theme-tokens.ts", "brand.ts", "video-advisor.ts"].includes(name)) continue;
    const source = readFileSync(join("src/ui", name), "utf8");
    assert.equal(hasColorLiteral(source), false, name);
  }
});

test("light control, chart, and status colors meet their contrast targets", () => {
  const light = THEME_TOKENS_CSS.split(':root[data-theme="light"] {')[1]?.split("}")[0];
  assert.ok(light);
  const hex = (name: string): string => {
    const line = light.split("\n").find((item) => item.trimStart().startsWith(`${name}: `));
    const value = line?.trim().slice(name.length + 2).split(";")[0];
    if (!value?.startsWith("#") || value.length !== 7) throw new Error(`Missing literal ${name}`);
    return value;
  };
  const luminance = (value: string): number => {
    const channels = [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  };
  const contrast = (left: string, right: string): number => {
    const a = luminance(hex(left));
    const b = luminance(hex(right));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  assert.ok(contrast("--border-control", "--surface") >= 3);
  for (const series of ["--accent-blue", "--accent-green", "--accent-purple", "--accent-amber", "--accent-red", "--chart-sky"]) {
    assert.ok(contrast(series, "--surface") >= 3, series);
  }
  for (const status of ["success", "error", "warning", "info", "advisor"]) {
    const background = status === "advisor" ? "--advisor-surface" : `--${status}-bg`;
    const ratio = contrast(`--${status}-border`, background);
    assert.ok(ratio >= 2 && ratio <= 3, `${status}: ${ratio.toFixed(2)}`);
  }
});

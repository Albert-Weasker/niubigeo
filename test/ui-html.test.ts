import test from "node:test";
import assert from "node:assert/strict";
import { renderAppHtml } from "../src/ui/app-html.js";

test("app shell exposes bilingual controls and submits the selected locale", () => {
  const html = renderAppHtml();

  assert.match(html, /data-language-choice="zh"/);
  assert.match(html, /data-language-choice="en"/);
  assert.match(html, /id="confirm-plan"/);
  assert.match(html, /id="confirm-run-button"/);
  assert.match(html, /\/audit-plan/);
  assert.match(html, /confirmedPlan: planPayloadForRun\(\)/);
  assert.match(html, /id="keywords"/);
  assert.match(html, /id="competitors"/);
  assert.match(html, /id="githubRepo"/);
  assert.ok(html.includes('id="webSearchEnabled"'));
  assert.ok(html.includes('id="webSearchMode"'));
  assert.ok(html.includes('webSearchEnabled: $("webSearchEnabled").value === "true"'));
  assert.ok(html.includes('webSearchMode: $("webSearchMode").value'));
  assert.match(html, /keywordMode: "关键词模式"/);
  assert.match(html, /languageSwitch: "语言"/);
  assert.match(html, /const state = \{ providers: \[\], latestResult: null, latestRuns: null, auditPlan: null, locale: "zh" \}/);
  assert.match(html, /language: locale\(\)/);
  assert.match(html, /keywords: \$\("keywords"\)\.value/);
  assert.match(html, /competitors: \$\("competitors"\)\.value/);
  assert.match(html, /githubRepo: \$\("githubRepo"\)\.value/);
  assert.doesNotMatch(html, /<select id="language"/);
  assert.doesNotMatch(html, /id="language" name="language"/);
});

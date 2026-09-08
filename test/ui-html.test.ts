import test from "node:test";
import assert from "node:assert/strict";
import { renderAppHtml } from "../src/ui/app-html.js";

test("app shell exposes bilingual controls and submits the selected locale", () => {
  const html = renderAppHtml();

  assert.ok(html.includes('data-language-choice="zh"'));
  assert.ok(html.includes('data-language-choice="en"'));
  assert.ok(html.includes('id="confirm-plan"'));
  assert.ok(html.includes('id="confirm-run-button"'));
  assert.ok(html.includes('/audit-plan'));
  assert.ok(html.includes('confirmedPlan: planPayloadForRun()'));
  assert.ok(html.includes('id="keywords"'));
  assert.ok(html.includes('id="competitors"'));
  assert.ok(html.includes('id="githubRepo"'));
  assert.ok(html.includes('id="webSearchEnabled"'));
  assert.equal(html.includes('id="webSearchMode"'), false);
  assert.ok(html.includes('webSearchEnabled: $("webSearchEnabled").value === "true"'));
  assert.ok(html.includes('webSearchMode: "provider_native"'));
  assert.ok(html.includes('keywordMode: "关键词模式"'));
  assert.ok(html.includes('languageSwitch: "语言"'));
  assert.ok(html.includes('const state = { providers: [], modelCatalogs: [], modelCatalogError: "", latestResult: null, latestRuns: null, auditPlan: null, locale: "zh" }'));
  assert.ok(html.includes('language: locale()'));
  assert.ok(html.includes('keywords: $("keywords").value'));
  assert.ok(html.includes('competitors: $("competitors").value'));
  assert.ok(html.includes('githubRepo: $("githubRepo").value'));
  assert.ok(!html.includes('<select id="language"'));
  assert.ok(!html.includes('id="language" name="language"'));
});

test("app shell renders the project monitoring workspace and restrained dark design", () => {
  const html = renderAppHtml();

  for (const view of ["overview", "prompts", "visibility", "competitors", "citations", "monitoring", "runs", "providers", "settings"]) {
    assert.equal(html.includes(`data-view="${view}"`), true, view);
    assert.equal(html.includes(`data-view-panel="${view}"`), true, view);
  }
  for (const endpoint of ["/projects", "/workbench?", "/baselines", "/tasks", "/observations"]) {
    assert.equal(html.includes(endpoint), true, endpoint);
  }
  for (const step of ["1", "2", "3", "4", "5"]) assert.equal(html.includes(`data-step="${step}"`), true, step);
  assert.equal(html.includes("--bg: #050505"), true);
  assert.equal(html.includes("--sidebar: #080808"), true);
  assert.equal(html.includes("--panel: #111111"), true);
  assert.equal(html.includes("linear-gradient"), false);
  assert.equal(html.includes("backdrop-filter"), false);
  assert.equal(html.includes("AI 魔法"), false);
  assert.equal(html.includes('brandDiscovery: "自然问题中被发现"'), true);
  assert.equal(html.includes('candidateEntryBasis: "只统计运行前已固定为候选决策的问题。"'), true);
  assert.equal(html.includes('explicitRecommendationBasis: "只统计运行前已固定为推荐决策的问题。"'), true);
  assert.equal(html.includes('officialDomainCoverageTitle: "官网域名覆盖"'), true);
  assert.equal(html.includes('function targetDomainBreakdown()'), true);
  assert.equal(html.includes('t("sourcePageBreakdown")'), true);
  assert.equal(html.includes('trendTitle: "AI 对你品牌的回答变化"'), true);
  assert.equal(html.includes('discoveryProof: "用户没有直接说出品牌名时，AI 是否会主动想到你的品牌。"'), true);
  assert.equal(html.includes('function trendDefinitionsMarkup(seriesRows)'), true);
  assert.equal(html.includes('function trendProofMarkup(seriesRows)'), true);
  assert.equal(html.includes('function seriesDrawable(series)'), true);
  assert.equal(html.includes('if (!seriesDrawable(series)) return'), true);
  assert.equal(html.includes('function openTrendPoint(metricId, runId)'), true);
  assert.equal(html.includes('data-trend-run-id'), true);
  assert.equal(html.includes('trendEvidenceSection(t("newlyMatched")'), true);
  assert.equal(html.includes('trendEvidenceSection(t("persistentlyMatched")'), true);
  assert.equal(html.includes('trendEvidenceSection(t("removedMatched")'), true);
  assert.equal(html.includes('cannotProveCause: "某次优化导致了这些变化"'), true);
  assert.equal(html.includes('id="audit-progress"'), true);
  assert.equal(html.includes('id="provider-model-search"'), true);
  assert.equal(html.includes('id="selected-model-capabilities"'), true);
  assert.equal(html.includes('requestJson("/provider-models")'), true);
  assert.equal(html.includes('data-native-web-search'), true);
  assert.equal(html.includes('nativeWebSearchSupported'), true);
  assert.equal(html.includes('id="detail-backdrop"'), true);
  assert.equal(html.includes('data-ui-state="loading"'), true);
  assert.equal(html.includes('data-ui-state="success"'), true);
  assert.equal(html.includes('data-ui-state="error"'), true);
});

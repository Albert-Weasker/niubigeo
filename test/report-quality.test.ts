import test from "node:test";
import assert from "node:assert/strict";
import type { AuditRun, PromptRun } from "../src/core/types.js";
import { entityFromInput } from "../src/utils/domain.js";
import { MetricsEngine } from "../src/metrics/metrics-engine.js";
import { GeoGapAnalyzer } from "../src/insights/gap-analyzer.js";
import { ReportBuilder } from "../src/report/report-builder.js";
import { ReportModelBuilder } from "../src/report/report-model.js";
import { validateReport } from "../src/report/report-quality.js";
import { buildHumanReport } from "../src/report/human-report.js";

const target = entityFromInput({ type: "target", domain: "vercel.com", name: "Vercel" });
const competitor = entityFromInput({ type: "competitor", domain: "netlify.com", name: "Netlify" });

function makeRun(overrides: Partial<PromptRun> = {}): PromptRun {
  const prompt = overrides.prompt || {
    id: "p1",
    type: "category" as const,
    topic: "category",
    language: "en",
    text: "best frontend deployment platforms",
    enabled: true,
    auditCategory: "organic_discovery" as const,
    targetIncluded: false,
  };
  return {
    id: "openrouter::openai/gpt-4o-mini::p1",
    prompt,
    target,
    competitors: [competitor],
    providerId: "openrouter",
    model: "openai/gpt-4o-mini",
    webSearchEnabled: false,
    sourceType: "api",
    sourceLabel: "Source: OpenRouter API",
    status: "completed",
    startedAt: "2026-09-03T00:00:00.000Z",
    finishedAt: "2026-09-03T00:00:01.000Z",
    result: {
      providerId: "openrouter",
      providerName: "OpenRouter",
      sourceType: "api",
      sourceLabel: "Source: OpenRouter API",
      resultCaveat: "API results are provider API results.",
      model: "openai/gpt-4o-mini",
      modelVersion: "openai/gpt-4o-mini",
      text: "Vercel is a platform for deploying frontend applications. Netlify is also relevant. https://vercel.com",
      rawJson: null,
      citations: [
        {
          id: "c1",
          url: "https://vercel.com/",
          domain: "vercel.com",
          citationIndex: 0,
          source: "answer_text_url",
          citationType: "target_official",
          entityId: target.id,
          entityName: target.name,
          promptId: "p1",
          runId: "openrouter::openai/gpt-4o-mini::p1",
        },
      ],
      webQueries: [],
      tokenUsage: { input: 10, output: 20, total: 30 },
      costUsd: 0.0001,
      latencyMs: 1000,
      createdAt: "2026-09-03T00:00:01.000Z",
    },
    analysis: {
      citations: [
        {
          id: "c1",
          url: "https://vercel.com/",
          domain: "vercel.com",
          citationIndex: 0,
          source: "answer_text_url",
          citationType: "target_official",
          entityId: target.id,
          entityName: target.name,
          promptId: "p1",
          runId: "openrouter::openai/gpt-4o-mini::p1",
        },
      ],
      mentions: [
        {
          entityId: target.id,
          entityName: target.name,
          entityType: "target",
          count: 1,
          firstPosition: 0,
          rankPosition: 1,
          mentionType: "recommendation",
          sentiment: "positive",
          isMentioned: true,
          isRecommendation: true,
          isFirstPosition: true,
          hasCitation: true,
          hasOfficialLink: true,
          context: "Vercel is a platform for deploying frontend applications.",
          paragraph: "Vercel is a platform for deploying frontend applications.",
        },
        {
          entityId: competitor.id,
          entityName: competitor.name,
          entityType: "competitor",
          count: 1,
          firstPosition: 53,
          rankPosition: 2,
          mentionType: "ordinary",
          sentiment: "neutral",
          isMentioned: true,
          isRecommendation: false,
          isFirstPosition: false,
          hasCitation: false,
          hasOfficialLink: false,
          context: "Netlify is also relevant.",
          paragraph: "Netlify is also relevant.",
        },
      ],
    },
    ...overrides,
  };
}

function buildAudit(run: PromptRun): AuditRun {
  return {
    id: "audit-1",
    target,
    competitors: [competitor],
    prompts: [run.prompt],
    providerTargets: [{ providerId: "openrouter", model: "openai/gpt-4o-mini" }],
    domainProfile: {
      domain: "vercel.com",
      brandName: "Vercel",
      aliases: [],
      category: "frontend deployment",
      description: "A cloud platform for frontend teams.",
      competitors: [{ name: "Netlify", domain: "netlify.com", reason: "Similar frontend deployment platform" }],
      promptSuggestions: [],
    },
    runs: [run],
    startedAt: "2026-09-03T00:00:00.000Z",
    finishedAt: "2026-09-03T00:00:01.000Z",
  };
}

test("generated report answers user-facing brand questions without technical evidence fields", () => {
  const run = makeRun();
  const audit = buildAudit(run);
  const metrics = new MetricsEngine().compute(audit.runs);
  const gaps = new GeoGapAnalyzer().analyze(audit, metrics);
  const reportModel = new ReportModelBuilder().build(audit, metrics, gaps);
  const reportBuilder = new ReportBuilder();
  const markdown = reportBuilder.renderMarkdown(reportModel);
  const html = reportBuilder.renderHtml(reportModel, markdown);
  const quality = validateReport(markdown, audit, metrics, gaps);

  assert.equal(quality.ok, true, quality.errors.join("\n"));
  assert.equal(markdown.includes("## Summary"), true);
  assert.equal(markdown.includes("## How AI Sees You"), true);
  assert.equal(markdown.includes("## Who Competes With You"), true);
  assert.equal(markdown.includes("## Competitive Differences"), true);
  assert.equal(markdown.includes("## Sources"), true);
  assert.equal(markdown.includes("Actual AI answer"), true);
  assert.equal(html.includes("How AI Sees You"), true);
  assert.equal(html.includes("Who Competes With You"), true);
  assert.equal(html.includes("View actual AI answers"), true);
  assert.equal(html.includes("OpenRouter API / openai/gpt-4o-mini"), true);
  assert.equal(html.includes("<table"), true);

  const forbidden = ["Mention Rate", "Share of Voice", "Prompt ID", "Run ID", "Raw JSON", "Token Usage", "Cost:", "Latency", "Technical Evidence"];
  for (const term of forbidden) {
    assert.equal(markdown.includes(term), false, term);
    assert.equal(html.includes(term), false, term);
  }
});

test("Chinese audit report renders user-facing Chinese sections and actual answers", () => {
  const run = makeRun({
    id: "openrouter::openai/gpt-4o-mini::p-zh",
    prompt: {
      id: "p-zh",
      type: "category",
      topic: "category",
      language: "zh",
      text: "有哪些前端部署平台？",
      enabled: true,
      auditCategory: "organic_discovery",
      targetIncluded: false,
    },
    executionPrompt: "请使用简体中文回答。\n\n问题：有哪些前端部署平台？",
    result: {
      providerId: "openrouter",
      providerName: "OpenRouter",
      sourceType: "api",
      sourceLabel: "Source: OpenRouter API",
      resultCaveat: "API results are provider API results.",
      model: "openai/gpt-4o-mini",
      modelVersion: "openai/gpt-4o-mini",
      text: "Vercel 是一个前端部署平台，Netlify 也是常见选择。",
      rawJson: null,
      citations: [],
      webQueries: [],
      costUsd: 0.0001,
      latencyMs: 1000,
      createdAt: "2026-09-03T00:00:01.000Z",
    },
    analysis: {
      citations: [],
      mentions: [
        {
          entityId: target.id,
          entityName: target.name,
          entityType: "target",
          count: 1,
          firstPosition: 0,
          rankPosition: 1,
          mentionType: "ordinary",
          sentiment: "neutral",
          isMentioned: true,
          isRecommendation: false,
          isFirstPosition: true,
          hasCitation: false,
          hasOfficialLink: false,
          context: "Vercel 是一个前端部署平台。",
          paragraph: "Vercel 是一个前端部署平台。",
        },
      ],
    },
  });
  const audit = buildAudit(run);
  const metrics = new MetricsEngine().compute(audit.runs);
  const gaps = new GeoGapAnalyzer().analyze(audit, metrics);
  const reportModel = new ReportModelBuilder().build(audit, metrics, gaps);
  const reportBuilder = new ReportBuilder();
  const markdown = reportBuilder.renderMarkdown(reportModel);
  const html = reportBuilder.renderHtml(reportModel, "");

  assert.equal(html.includes('lang="zh-CN"'), true);
  assert.equal(markdown.includes("## 总结"), true);
  assert.equal(markdown.includes("## AI怎么看你"), true);
  assert.equal(markdown.includes("## 谁在和你竞争"), true);
  assert.equal(markdown.includes("## 竞争差异"), true);
  assert.equal(markdown.includes("## 来源"), true);
  assert.equal(markdown.includes("<summary>查看AI实际回答</summary>"), true);
  assert.equal(html.includes("AI实际回答"), true);
  assert.equal(html.includes("技术证据"), false);
  assert.equal(html.includes("原始 JSON"), false);
  assert.equal(html.includes("提及率"), false);
});

test("report distinguishes requested web search from confirmed execution", () => {
  const run = makeRun({
    webSearchEnabled: false,
    search: {
      requested: true,
      requestMode: "auto",
      used: false,
      usedMode: "requested_not_confirmed",
      endpointKind: "official_api",
      endpointProtocol: "chat_completions",
      endpointUrl: "https://openrouter.ai/api/v1/chat/completions",
      toolName: "openrouter:web",
      webQueries: [],
      citationCount: 0,
    },
  });

  const report = buildHumanReport(buildAudit(run));

  assert.equal(report.sections.answers[0]?.webSearch, "Search unconfirmed");
});

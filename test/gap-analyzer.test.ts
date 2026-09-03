import test from "node:test";
import assert from "node:assert/strict";
import type { AuditRun, Mention, MonitoringPrompt, PromptRun } from "../src/core/types.js";
import { GeoGapAnalyzer } from "../src/insights/gap-analyzer.js";
import { MetricsEngine } from "../src/metrics/metrics-engine.js";
import { entityFromInput } from "../src/utils/domain.js";

const target = entityFromInput({ type: "target", domain: "niubistar.com", name: "NiubiStar" });
const competitor = entityFromInput({ type: "competitor", domain: "competitor.example", name: "Competitor A" });

function mention(input: Partial<Mention> & Pick<Mention, "entityId" | "entityName" | "entityType">): Mention {
  return {
    count: 0,
    firstPosition: null,
    rankPosition: null,
    mentionType: "not_mentioned",
    sentiment: "neutral",
    isMentioned: false,
    isRecommendation: false,
    isFirstPosition: false,
    hasCitation: false,
    hasOfficialLink: false,
    context: null,
    paragraph: null,
    ...input,
  };
}

function prompt(id: string, text: string): MonitoringPrompt {
  return { id, type: "recommendation", topic: "recommendation", language: "en", text, enabled: true };
}

function run(id: string, promptRow: MonitoringPrompt, mentions: Mention[]): PromptRun {
  return {
    id,
    prompt: promptRow,
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
    rawJsonPath: `/tmp/${id}.json`,
    analysis: { mentions, citations: [] },
  };
}

test("detects provider, prompt, and citation gaps from structured run evidence", () => {
  const p1 = prompt("p1", "best tools");
  const p2 = prompt("p2", "which tool should I use");
  const audit: AuditRun = {
    id: "audit-gap",
    target,
    competitors: [competitor],
    prompts: [p1, p2],
    providerTargets: [{ providerId: "openrouter", model: "openai/gpt-4o-mini" }],
    runs: [
      run("r1", p1, [
        mention({ entityId: target.id, entityName: target.name, entityType: "target" }),
        mention({
          entityId: competitor.id,
          entityName: competitor.name,
          entityType: "competitor",
          count: 1,
          firstPosition: 0,
          rankPosition: 1,
          mentionType: "recommendation",
          sentiment: "positive",
          isMentioned: true,
          isRecommendation: true,
          isFirstPosition: true,
          context: "Competitor A is recommended.",
          paragraph: "Competitor A is recommended.",
        }),
      ]),
      run("r2", p2, [
        mention({
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
          context: "NiubiStar is recommended.",
          paragraph: "NiubiStar is recommended.",
        }),
        mention({ entityId: competitor.id, entityName: competitor.name, entityType: "competitor" }),
      ]),
    ],
    startedAt: "2026-09-03T00:00:00.000Z",
    finishedAt: "2026-09-03T00:00:02.000Z",
  };

  const metrics = new MetricsEngine().compute(audit.runs);
  const gaps = new GeoGapAnalyzer().analyze(audit, metrics);
  const titles = gaps.findings.map((finding) => finding.title);

  assert.ok(titles.some((title) => title.includes("rarely cites official target sources")));
  assert.ok(titles.some((title) => title.includes("competitors but not the target")));
  assert.ok(titles.some((title) => title.includes("mentioned without official citations")));
});

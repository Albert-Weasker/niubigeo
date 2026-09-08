import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
import { entityFromInput } from "../src/utils/domain.js";
import { DeterministicPlanBuilder } from "../src/planning/deterministic-plan-builder.js";
import { AuditRunner } from "../src/runner/audit-runner.js";
import { ProviderRequestError } from "../src/providers/provider-error.js";

class AnswerThenAnalysisFailureProvider implements AnswerProvider {
  readonly definition: ProviderDefinition = {
    id: "openrouter",
    label: "OpenRouter",
    sourceType: "api",
    envKeys: ["OPENROUTER_API_KEY"],
    defaultModels: ["test-model"],
    analysisModel: "test-model",
    supportsAnyModel: true,
    supportsJsonSchema: true,
    supportsNativeCitations: true,
    supportsWebSearch: true,
    resultCaveat: "Provider API result",
  };
  calls = 0;

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    this.calls += 1;
    if (input.responseJsonSchema) {
      throw new ProviderRequestError({ code: "invalid_response", message: "Structured analysis was unavailable." });
    }
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: "Source: OpenRouter API",
      resultCaveat: this.definition.resultCaveat,
      model: input.model,
      modelVersion: input.model,
      text: "Example is a software product for teams.",
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: "2026-09-05T00:00:01.000Z",
    };
  }
}

test("a completed provider answer is persisted even when every later structured analysis attempt fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-answer-first-"));
  const previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  try {
    const provider = new AnswerThenAnalysisFailureProvider();
    const target = entityFromInput({ type: "target", domain: "example.test", name: "Example" });
    const plan = new DeterministicPlanBuilder().build({
      target,
      competitors: [],
      questions: [{ id: "question-1", text: "What does Example provide?" }],
      providerTargets: [{ providerId: "openrouter", model: "test-model", webSearchEnabled: false }],
      language: "en",
      scopeConfirmed: true,
    }, { planId: "plan-answer-first", plannedAt: "2026-09-05T00:00:00.000Z" });
    const output = await new AuditRunner({
      catalog: {
        get: () => provider,
        validate: () => undefined,
      },
      competitorDiscovery: {
        discover: async () => [],
      },
    }).run({ confirmedPlan: plan, runsRoot: root, maxTokens: 200 });

    const run = output.audit.runs[0];
    assert.equal(run?.status, "completed");
    assert.equal(run?.result?.text, "Example is a software product for teams.");
    assert.equal(run?.intentAnalysis?.status, "failed");
    assert.equal(run?.analysisStatus, "partial");
    assert.equal(provider.calls, 3);

    const purposes = (output.audit.providerCalls || []).map((record) => `${record.purpose}:${record.outcome}`);
    assert.deepEqual(purposes, [
      "audit_answer:completed",
      "answer_analysis:failed",
      "structured_repair:failed",
    ]);

    const checkpoint = JSON.parse(await readFile(join(output.paths.runDir, "audit-state.json"), "utf8")) as {
      runs?: Array<{ result?: { text?: string } }>;
    };
    assert.equal(checkpoint.runs?.[0]?.result?.text, "Example is a software product for teams.");
    assert.equal((await readFile(output.paths.reportHtml, "utf8")).includes("Example is a software product for teams."), true);
  } finally {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
    await rm(root, { recursive: true, force: true });
  }
});

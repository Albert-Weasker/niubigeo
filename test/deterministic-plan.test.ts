import test from "node:test";
import assert from "node:assert/strict";
import { admitConfirmedQuestion } from "../src/admission/question-admission.js";
import { DeterministicPlanBuilder } from "../src/planning/deterministic-plan-builder.js";
import { entityFromInput } from "../src/utils/domain.js";

function spec() {
  const target = entityFromInput({ type: "target", domain: "example.test", name: "Example Product", aliases: ["Example"] });
  return {
    target,
    competitors: [],
    questions: [{ id: "question-1", text: "Is Example Product suitable for a small development team?" }],
    providerTargets: [{ providerId: "openrouter", model: "provider/model", webSearchEnabled: false }],
    language: "en",
    scopeConfirmed: true as const,
  };
}

test("confirmed questions build a plan without a provider or site preparation", () => {
  const builder = new DeterministicPlanBuilder();
  const first = builder.build(spec(), { planId: "plan-fixed", plannedAt: "2026-01-01T00:00:00.000Z" });
  const second = builder.build(spec(), { planId: "plan-fixed", plannedAt: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(first, second);
  assert.equal(first.prompts[0]?.text, spec().questions[0]?.text);
  assert.equal(first.autoDiscover, false);
  assert.equal(first.domainProfile, undefined);
  assert.equal(first.siteEvidence, undefined);
  assert.equal(first.promptGeneration, undefined);
});

test("identity admission is language independent and requires explicit scope confirmation", () => {
  const target = spec().target;
  assert.equal(admitConfirmedQuestion({ question: "请评价 Example 是否适合团队使用", target, scopeConfirmed: true }).accepted, true);
  assert.equal(admitConfirmedQuestion({ question: "请评价这个产品", target, scopeConfirmed: true }).failureCode, "target_identity_missing");
  assert.equal(admitConfirmedQuestion({ question: "Is Example suitable?", target, scopeConfirmed: false }).failureCode, "scope_confirmation_required");
});


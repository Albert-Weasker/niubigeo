import test from "node:test";
import assert from "node:assert/strict";
import type { DomainProfile } from "../src/core/types.js";
import { DomainPromptPlanner } from "../src/prompts/domain-prompt-planner.js";
import { entityFromInput } from "../src/utils/domain.js";

test("uses only provider-generated domain prompt suggestions", () => {
  const target = entityFromInput({ type: "target", domain: "acme.example", name: "Acme" });
  const competitors = [
    entityFromInput({ type: "competitor", domain: "example-competitor.com", name: "Example Competitor" }),
  ];
  const profile: DomainProfile = {
    domain: "acme.example",
    brandName: "Acme",
    aliases: [],
    category: "GitHub project promotion platform",
    description: "A platform that helps developers promote GitHub projects.",
    competitors: [],
    promptSuggestions: [
      { type: "brand", topic: "identity", prompt: "What does Acme do?", auditCategory: "brand_awareness", targetIncluded: true },
      { type: "category", topic: "need", prompt: "Which products solve this need?", auditCategory: "organic_discovery", targetIncluded: false },
      { type: "recommendation", topic: "selection", prompt: "Which option should a team consider?", auditCategory: "organic_discovery", targetIncluded: false },
      { type: "comparison", topic: "comparison", prompt: "Compare Acme with Example Competitor.", auditCategory: "comparison", targetIncluded: true },
      { type: "scenario", topic: "workflow", prompt: "How should a team solve this workflow?", auditCategory: "organic_discovery", targetIncluded: false },
      { type: "alternative", topic: "alternatives", prompt: "What can replace Acme?", auditCategory: "comparison", targetIncluded: true },
    ],
  };

  const prompts = new DomainPromptPlanner().build({
    target,
    competitors,
    profile,
    language: "en",
    count: 6,
  });

  assert.equal(prompts.length, 6);
  assert.ok(prompts.some((prompt) => prompt.targetIncluded === true));
  assert.ok(prompts.filter((prompt) => prompt.targetIncluded === false).length >= 3);
  assert.ok(prompts.some((prompt) => prompt.type === "comparison"));
});

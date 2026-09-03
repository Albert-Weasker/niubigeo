import test from "node:test";
import assert from "node:assert/strict";
import type { DomainProfile } from "../src/core/types.js";
import { DomainPromptPlanner } from "../src/prompts/domain-prompt-planner.js";
import { entityFromInput } from "../src/utils/domain.js";

test("builds a mixed NiubiStar prompt plan with organic unbranded prompts", () => {
  const target = entityFromInput({ type: "target", domain: "www.niubistar.com", name: "NiubiStar" });
  const competitors = [
    entityFromInput({ type: "competitor", domain: "example-competitor.com", name: "Example Competitor" }),
  ];
  const profile: DomainProfile = {
    domain: "niubistar.com",
    brandName: "NiubiStar",
    aliases: [],
    category: "GitHub project promotion platform",
    description: "A platform that helps developers promote GitHub projects.",
    competitors: [],
    promptSuggestions: [],
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

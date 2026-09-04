import test from "node:test";
import assert from "node:assert/strict";
import { promptsFromManual } from "../src/prompts/prompt-generator.js";
import { entityFromInput } from "../src/utils/domain.js";

test("classifies Chinese manual prompts by user intent", () => {
  const target = entityFromInput({
    type: "target",
    domain: "www.niubistar.com",
    name: "NiubiStar",
    aliases: ["牛逼Star"],
  });

  const prompts = promptsFromManual({
    target,
    language: "zh",
    prompts: [
      "NiubiStar 是什么？",
      "NiubiStar 有哪些替代品？",
      "对比 NiubiStar 和 GitStar 的差异。",
      "推荐几个 GitHub 项目推广平台。",
      "如何推广一个新的 GitHub 项目？",
      "GitHub 项目推广平台有哪些？",
    ],
  });

  assert.equal(prompts[0]?.type, "brand");
  assert.equal(prompts[0]?.auditCategory, "brand_awareness");

  assert.equal(prompts[1]?.type, "alternative");
  assert.equal(prompts[1]?.auditCategory, "comparison");

  assert.equal(prompts[2]?.type, "comparison");
  assert.equal(prompts[2]?.auditCategory, "comparison");

  assert.equal(prompts[3]?.type, "recommendation");
  assert.equal(prompts[3]?.auditCategory, "organic_discovery");

  assert.equal(prompts[4]?.type, "scenario");
  assert.equal(prompts[4]?.auditCategory, "organic_discovery");

  assert.equal(prompts[5]?.type, "category");
  assert.equal(prompts[5]?.auditCategory, "organic_discovery");
});

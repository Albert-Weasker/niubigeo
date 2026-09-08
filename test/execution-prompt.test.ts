import test from "node:test";
import assert from "node:assert/strict";
import { buildExecutionPrompt } from "../src/prompts/execution-prompt.js";
import type { MonitoringPrompt } from "../src/core/types.js";

function prompt(language: string, text: string): MonitoringPrompt {
  return {
    id: `p-${language}`,
    type: "category",
    topic: "category",
    language,
    text,
    enabled: true,
    targetIncluded: false,
  };
}

test("wraps Chinese audit prompts with a Chinese answer instruction", () => {
  const executionPrompt = buildExecutionPrompt(prompt("zh", "有哪些 AI 可见度监测工具？"));

  assert.ok(executionPrompt.includes("zh"));
  assert.ok(executionPrompt.includes("有哪些 AI 可见度监测工具？"));
});

test("wraps English audit prompts with an English answer instruction", () => {
  const executionPrompt = buildExecutionPrompt(prompt("en", "What are the best AI visibility monitoring tools?"));

  assert.ok(executionPrompt.includes("en"));
  assert.ok(executionPrompt.includes("What are the best AI visibility monitoring tools?"));
});

test("requests provider-native search only when the user enables web search", () => {
  const monitoredPrompt = prompt("en", "What does the target product provide?");
  const offline = buildExecutionPrompt(monitoredPrompt, false);
  const online = buildExecutionPrompt(monitoredPrompt, true);

  assert.equal(offline.includes("provider-native web search"), false);
  assert.equal(online.includes("provider-native web search"), true);
});

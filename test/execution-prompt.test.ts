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

  assert.match(executionPrompt, /请使用简体中文回答/);
  assert.match(executionPrompt, /问题：有哪些 AI 可见度监测工具？/);
});

test("wraps English audit prompts with an English answer instruction", () => {
  const executionPrompt = buildExecutionPrompt(prompt("en", "What are the best AI visibility monitoring tools?"));

  assert.match(executionPrompt, /Answer in English/);
  assert.match(executionPrompt, /Question: What are the best AI visibility monitoring tools\?/);
});

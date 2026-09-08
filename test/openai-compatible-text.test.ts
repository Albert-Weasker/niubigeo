import test from "node:test";
import assert from "node:assert/strict";
import { extractOpenAICompatibleText } from "../src/providers/openai-compatible.js";

test("extracts both string and segmented OpenAI-compatible message content", () => {
  assert.equal(
    extractOpenAICompatibleText({ choices: [{ message: { content: " answer " } }] }),
    "answer",
  );
  assert.equal(
    extractOpenAICompatibleText({ choices: [{ message: { content: [{ type: "text", text: "first" }, { type: "text", text: "second" }] } }] }),
    "first\nsecond",
  );
});

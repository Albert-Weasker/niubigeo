import test from "node:test";
import assert from "node:assert/strict";
import { jsonContainer } from "../src/utils/text.js";

test("jsonContainer keeps a brace that appears inside a JSON string", () => {
  const text = 'Prefix {"ok":true,"note":"use } in prose"} and then a stray } here';
  assert.equal(jsonContainer(text, "{", "}"), '{"ok":true,"note":"use } in prose"}');
});

test("jsonContainer does not extend past the first balanced object when prose has another brace", () => {
  const text = '{"ok":true} Note: remember to close with }';
  assert.equal(jsonContainer(text, "{", "}"), '{"ok":true}');
});

test("jsonContainer reads a fenced object and ignores trailing prose braces", () => {
  const text = "```json\n{\"a\":1}\n```\nAlso see }";
  assert.equal(jsonContainer(text, "{", "}"), '{"a":1}');
});

test("jsonContainer reads the first balanced array", () => {
  const text = 'Items: [1, [2, 3], {"x":"]"}] trailing ]';
  assert.equal(jsonContainer(text, "[", "]"), '[1, [2, 3], {"x":"]"}]');
});

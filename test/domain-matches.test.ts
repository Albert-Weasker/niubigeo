import test from "node:test";
import assert from "node:assert/strict";
import { domainMatches, normalizeDomain } from "../src/utils/domain.js";

test("domainMatches accepts an exact host and its subdomains", () => {
  assert.equal(domainMatches("example.com", "example.com"), true);
  assert.equal(domainMatches("www.example.com", "example.com"), true);
  assert.equal(domainMatches("docs.example.com", "example.com"), true);
});

test("domainMatches rejects a bare TLD as the expected domain", () => {
  assert.equal(domainMatches("evil.com", "com"), false);
  assert.equal(domainMatches("foo.co.uk", "uk"), false);
});

test("domainMatches rejects empty domains", () => {
  assert.equal(domainMatches("example.com", ""), false);
  assert.equal(domainMatches("", "example.com"), false);
});

test("normalizeDomain strips www and lowercases", () => {
  assert.equal(normalizeDomain("HTTPS://WWW.Example.COM/path"), "example.com");
});

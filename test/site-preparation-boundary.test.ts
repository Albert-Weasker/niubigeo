import test from "node:test";
import assert from "node:assert/strict";
import { SitePreparationService } from "../src/preparation/site-preparation-service.js";

test("site preparation returns unavailable instead of blocking a confirmed audit", async () => {
  const service = new SitePreparationService({
    async collect() {
      throw new Error("fetch failed");
    },
  });
  const result = await service.prepare({ domain: "example.test" });
  assert.equal(result.status, "unavailable");
  assert.equal(result.evidence, null);
  assert.equal(result.failureCode, "unreachable");
});


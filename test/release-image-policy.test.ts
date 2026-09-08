import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const policyPath = pathToFileURL(resolve("scripts/release-image-policy.mjs")).href;
const { parseSemver, validateDigest, createReleasePlan, digestFromRegistryResponse, checkReleasePlan, publishRelease } = await import(policyPath);
const sourceSha = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;
const otherDigest = `sha256:${"c".repeat(64)}`;
const candidateInput = { eventName: "workflow_dispatch", tag: "v1.2.3-rc.1", sourceSha };
const promotionInput = {
  ...candidateInput, action: "promote-stable", tag: "v1.2.3",
  candidateTag: "v1.2.3-rc.1", testedDigest: digest, testedSourceSha: sourceSha,
  confirmTested: true, acceptanceUrl: "https://example.com/releases/acceptance.json",
  ref: "refs/heads/main", defaultBranch: "main",
};
const stableInput = {
  eventName: "release", action: "build-stable", tag: "v1.2.3", sourceSha,
  ref: "refs/tags/v1.2.3", releasePublished: true, releasePrerelease: false,
};

test("direct stable builds require a published stable release and exact tag ref", () => {
  const plan = createReleasePlan(stableInput);
  assert.deepEqual(plan.tags, ["v1.2.3", `sha-${sourceSha}`, "latest"]);
  for (const change of [
    { eventName: "workflow_dispatch" }, { releasePublished: false },
    { releasePrerelease: true }, { ref: "refs/heads/main" },
    { tag: "v1.2.3-rc.1", ref: "refs/tags/v1.2.3-rc.1" },
    { testedDigest: digest }, { sourceSha: "short" },
  ]) assert.throws(() => createReleasePlan({ ...stableInput, ...change }));
});

test("stable build verifies version and source aliases before updating latest", async () => {
  const plan = createReleasePlan(stableInput);
  const store = registry([[digest, digest], ["latest", otherDigest]]);
  await publishRelease(plan, digest, store);
  assert.deepEqual(store.writes.map(item => item.tags), [plan.immutableTags, ["latest"]]);
  for (const tag of plan.tags) assert.equal(store.contents.get(tag), digest);
  await assert.rejects(publishRelease(plan, digest, store));
});

test("stable build alias verification failure leaves latest unchanged", async () => {
  const plan = createReleasePlan(stableInput);
  const store = registry([[digest, digest], ["latest", otherDigest]]);
  await assert.rejects(publishRelease(plan, digest, {
    ...store,
    createTags: async (_image: string, _digest: string, tags: string[]) => {
      for (const tag of tags) store.contents.set(tag, otherDigest);
    },
  }));
  assert.equal(store.contents.get("latest"), otherDigest);
});

function registry(entries: Array<[string, string]> = []) {
  const contents = new Map(entries);
  const writes: Array<{ image: string; digest: string; tags: string[] }> = [];
  const lookups: string[] = [];
  return {
    contents, writes, lookups,
    lookup: async (reference: string) => { lookups.push(reference); return contents.get(reference) ?? null; },
    createTags: async (image: string, value: string, tags: string[]) => {
      writes.push({ image, digest: value, tags });
      for (const tag of tags) contents.set(tag, value);
    },
  };
}

test("SemVer parser preserves valid identifiers and arbitrarily large integers", () => {
  for (const value of ["0.0.0", "v1.2.3", "1.2.3-rc.0", "1.2.3-preview.1", "1.2.3-alpha-beta.01a", "1.2.3--", "1.2.3+build.001", "1.2.3-rc.1+build.001", "999999999999999999999.2.3"]) {
    assert.equal(parseSemver(value).version, value.startsWith("v") ? value.slice(1) : value);
  }
  assert.deepEqual(parseSemver("v1.2.3-rc.1+build.001"), { version: "1.2.3-rc.1+build.001", core: "1.2.3", prerelease: ["rc", "1"], build: ["build", "001"] });
});

test("SemVer parser rejects malformed, ambiguous and injected version strings", () => {
  for (const value of [undefined, null, 123, "", "v", "vv1.2.3", "V1.2.3", "1.2", "1.2.3.4", "01.2.3", "1.02.3", "1.2.03", "1.2.3-", "1.2.3-rc..1", "1.2.3-01", "1.2.3-rc.01", "1.2.3+", "1.2.3+build..1", "1.2.3+x+y", "1.2.3_rc", "1.2.3-rc/1", "1.2.3-rc:1", "1.2.3-rc\nlatest", " 1.2.3", "1.2.3 ", "1.2.3-rc.\u00e9", "1.2.3-$(id)"]) {
    assert.throws(() => parseSemver(value), { name: "Error" }, String(value));
  }
});

test("preview, rc and other prereleases never publish latest on either event", () => {
  for (const eventName of ["release", "workflow_dispatch"]) {
    for (const tag of ["v1.2.3-preview.1", "v1.2.3-rc.1", "1.2.3-alpha.1", "v1.2.3-latest"]) {
      const plan = createReleasePlan({ ...candidateInput, eventName, tag });
      assert.equal(plan.mode, "candidate");
      assert.deepEqual(plan.tags, [tag.startsWith("v") ? tag : `v${tag}`, `sha-${sourceSha}`]);
      assert.equal(plan.tags.includes("latest"), false);
      assert.deepEqual(plan.immutableTags, plan.tags);
    }
  }
});

test("stable release events and default manual builds cannot publish stable or latest", () => {
  for (const eventName of ["release", "workflow_dispatch"]) {
    for (const tag of ["v1.2.3", "latest", "main", "sha-1234"]) {
      assert.throws(() => createReleasePlan({ ...candidateInput, eventName, tag }));
    }
  }
  for (const input of [{ eventName: "push" }, { action: "unknown" }, { sourceSha: "short" }, { tag: "1.2.3-rc+build.1" }, { tag: `1.2.3-${"a".repeat(128)}` }, { testedDigest: digest }, { confirmTested: true }]) {
    assert.throws(() => createReleasePlan({ ...candidateInput, ...input }));
  }
});

test("explicit accepted stable promotion preserves the tested source mapping", () => {
  const plan = createReleasePlan(promotionInput);
  assert.equal(plan.mode, "promote-stable");
  assert.deepEqual(plan.tags, ["v1.2.3", "latest"]);
  assert.deepEqual(plan.immutableTags, ["v1.2.3"]);
  assert.equal(plan.testedDigest, digest);
  assert.equal(plan.sourceSha, sourceSha);
  assert.equal(plan.candidateTag, "v1.2.3-rc.1");
  assert.equal(plan.acceptanceUrl, promotionInput.acceptanceUrl);
});

test("promotion requires explicit manual acceptance, matching candidate, digest, commit and evidence", () => {
  for (const input of [
    { eventName: "release" }, { confirmTested: false }, { confirmTested: "true" },
    { ref: "refs/heads/other" }, { defaultBranch: "" }, { tag: "1.2.3-rc.2" },
    { candidateTag: "" }, { candidateTag: "1.2.3" }, { candidateTag: "1.2.4-rc.1" },
    { testedDigest: "" }, { testedDigest: `${digest}\n` }, { testedSourceSha: "" },
    { testedSourceSha: sourceSha.toUpperCase() }, { acceptanceUrl: "" },
    { acceptanceUrl: "file:///acceptance.json" }, { acceptanceUrl: "http://example.com/evidence" },
    { acceptanceUrl: "https://user:password@example.com/evidence" },
  ]) assert.throws(() => createReleasePlan({ ...promotionInput, ...input }));
});

test("digest validation accepts only exact lowercase SHA-256 references", () => {
  assert.equal(validateDigest(digest), digest);
  for (const value of [null, undefined, "latest", "sha256:", digest.slice(0, -1), digest + "0", digest.toUpperCase(), `sha256:${"g".repeat(64)}`, `ghcr.io/example/image@${digest}`]) {
    assert.throws(() => validateDigest(value));
  }
});

test("registry checks distinguish missing manifests from auth, service and malformed responses", () => {
  assert.equal(digestFromRegistryResponse(404, null), null);
  assert.equal(digestFromRegistryResponse(200, digest), digest);
  for (const status of [301, 400, 401, 403, 405, 429, 500, 502, 503]) {
    assert.throws(() => digestFromRegistryResponse(status, null));
  }
  assert.throws(() => digestFromRegistryResponse(200, null));
  assert.throws(() => digestFromRegistryResponse(200, "invalid"));
});

test("either existing immutable candidate tag stops publication, including same-digest reuse", async () => {
  const plan = createReleasePlan(candidateInput);
  for (const tag of plan.immutableTags) {
    for (const value of [digest, otherDigest]) {
      const store = registry([[tag, value], [digest, digest]]);
      await assert.rejects(publishRelease(plan, digest, store));
      assert.deepEqual(store.writes, []);
    }
  }
});

test("pre-build check is repeated before any tag write", async () => {
  const plan = createReleasePlan(candidateInput);
  const store = registry([[digest, digest]]);
  await checkReleasePlan(plan, store.lookup);
  store.contents.set(plan.tag, otherDigest);
  await assert.rejects(publishRelease(plan, digest, store));
  assert.deepEqual(store.writes, []);
});

test("candidate publication copies exact digest to immutable tags without moving latest", async () => {
  const plan = createReleasePlan(candidateInput);
  const store = registry([[digest, digest], ["latest", otherDigest]]);
  const result = await publishRelease(plan, digest, store);
  assert.equal(result.digest, digest);
  assert.equal(store.writes.length, 1);
  assert.deepEqual(store.writes[0]?.tags, plan.immutableTags);
  assert.equal(store.contents.get("latest"), otherDigest);
  for (const tag of plan.tags) assert.equal(store.contents.get(tag), digest);
});

test("promotion copies the accepted digest without rebuilding or changing candidate and commit tags", async () => {
  const plan = createReleasePlan(promotionInput);
  const store = registry([[digest, digest], [plan.candidateTag, digest], [`sha-${sourceSha}`, digest], ["latest", otherDigest]]);
  await publishRelease(plan, "", store);
  assert.deepEqual(store.writes, [{ image: plan.image, digest, tags: ["v1.2.3"] }, { image: plan.image, digest, tags: ["latest"] }]);
  for (const tag of [plan.candidateTag, `sha-${sourceSha}`, "v1.2.3", "latest"]) assert.equal(store.contents.get(tag), digest);
});

test("promotion fails closed on existing stable version, missing source or changed source identity", async () => {
  const plan = createReleasePlan(promotionInput);
  for (const blocked of [plan.candidateTag, `sha-${sourceSha}`, digest, plan.tag]) {
    for (const value of [null, otherDigest]) {
      if (blocked === plan.tag && value === null) continue;
      const store = registry([[digest, digest], [plan.candidateTag, digest], [`sha-${sourceSha}`, digest]]);
      if (value === null) store.contents.delete(blocked);
      else store.contents.set(blocked, value);
      await assert.rejects(publishRelease(plan, "", store));
      assert.deepEqual(store.writes, []);
    }
  }
  const store = registry([[digest, digest], [plan.candidateTag, digest], [`sha-${sourceSha}`, digest]]);
  await assert.rejects(publishRelease(plan, digest, store));
  assert.deepEqual(store.writes, []);
  store.contents.set(plan.tag, digest);
  await assert.rejects(publishRelease(plan, "", store));
  assert.deepEqual(store.writes, []);
});

test("missing candidate build digest and registry failures never issue tag writes", async () => {
  const plan = createReleasePlan(candidateInput);
  const store = registry();
  await assert.rejects(publishRelease(plan, undefined, store));
  await assert.rejects(publishRelease(plan, digest, store));
  await assert.rejects(publishRelease(plan, digest, { ...store, lookup: async () => { throw new Error("Registry unavailable"); } }));
  assert.deepEqual(store.writes, []);
});

test("post-publication verification detects a changed digest", async () => {
  const plan = createReleasePlan(candidateInput);
  const store = registry([[digest, digest]]);
  await assert.rejects(publishRelease(plan, digest, {
    ...store,
    createTags: async (_image: string, _digest: string, tags: string[]) => {
      for (const tag of tags) store.contents.set(tag, otherDigest);
    },
  }));
});

test("stable version verification failure prevents latest from moving", async () => {
  const plan = createReleasePlan(promotionInput);
  const store = registry([[digest, digest], [plan.candidateTag, digest], [`sha-${sourceSha}`, digest], ["latest", otherDigest]]);
  const written: string[] = [];
  await assert.rejects(publishRelease(plan, "", {
    ...store,
    createTags: async (_image: string, _digest: string, tags: string[]) => {
      written.push(...tags);
      for (const tag of tags) store.contents.set(tag, otherDigest);
    },
  }));
  assert.deepEqual(written, [plan.tag]);
  assert.equal(store.contents.get("latest"), otherDigest);
});

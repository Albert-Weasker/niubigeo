import { appendFile, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const IMAGE = "ghcr.io/albert-weasker/niubigeo";
const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const HEX = "0123456789abcdef";
const MANIFEST_TYPES = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

function consistsOf(value, characters) {
  return typeof value === "string" && value.length > 0 && [...value].every((character) => characters.includes(character));
}

function numericIdentifier(value) {
  return consistsOf(value, DIGITS) && (value.length === 1 || value[0] !== "0");
}

export function parseSemver(value) {
  if (typeof value !== "string" || !value) throw new Error("A SemVer version is required.");
  const version = value.startsWith("v") ? value.slice(1) : value;
  const parts = version.split("+");
  if (parts.length > 2) throw new Error("Invalid SemVer build metadata.");
  const build = parts.length === 2 ? parts[1].split(".") : [];
  const separator = parts[0].indexOf("-");
  const core = separator === -1 ? parts[0] : parts[0].slice(0, separator);
  const prerelease = separator === -1 ? [] : parts[0].slice(separator + 1).split(".");
  const numbers = core.split(".");
  if (numbers.length !== 3 || !numbers.every(numericIdentifier)) throw new Error("Invalid SemVer core version.");
  for (const identifier of [...prerelease, ...build]) {
    if (!consistsOf(identifier, DIGITS + LETTERS + "-")) throw new Error("Invalid SemVer identifier.");
  }
  if (prerelease.some((identifier) => consistsOf(identifier, DIGITS) && !numericIdentifier(identifier))) {
    throw new Error("Numeric SemVer prerelease identifiers cannot have leading zeroes.");
  }
  return { version, core, prerelease, build };
}

function imageVersion(value) {
  const version = parseSemver(value);
  if (version.build.length) throw new Error("SemVer build metadata is not supported in Docker tags; use a distinct prerelease.");
  const tag = `v${version.version}`;
  if (tag.length > 128) throw new Error("Docker tags cannot exceed 128 characters.");
  return { ...version, tag };
}

export function validateDigest(value) {
  if (typeof value !== "string" || !value.startsWith("sha256:") || value.length !== 71 || !consistsOf(value.slice(7), HEX)) {
    throw new Error("An exact lowercase sha256 digest is required.");
  }
  return value;
}

function validateSourceSha(value) {
  if (typeof value !== "string" || value.length !== 40 || !consistsOf(value, HEX)) {
    throw new Error("A full lowercase 40-character source commit is required.");
  }
  return value;
}

export function createReleasePlan(input) {
  if (input.eventName !== "release" && input.eventName !== "workflow_dispatch") throw new Error("Unsupported publication event.");
  const mode = input.action || "candidate";
  const version = imageVersion(input.tag);
  if (mode === "build-stable") {
    if (input.eventName !== "release" || input.releasePublished !== true || input.releasePrerelease !== false) {
      throw new Error("Direct stable builds require an explicitly published stable GitHub Release.");
    }
    if (version.prerelease.length || input.ref !== `refs/tags/${version.tag}`) {
      throw new Error("Stable builds must check out the exact stable release tag.");
    }
    if (input.testedDigest || input.testedSourceSha || input.candidateTag || input.acceptanceUrl || input.confirmTested) {
      throw new Error("Stable builds cannot accept promotion inputs.");
    }
    const sourceSha = validateSourceSha(input.sourceSha);
    return {
      mode, image: IMAGE, tag: version.tag, sourceSha,
      immutableTags: [version.tag, `sha-${sourceSha}`],
      tags: [version.tag, `sha-${sourceSha}`, "latest"],
    };
  }
  if (mode === "candidate") {
    if (!version.prerelease.length) throw new Error("Stable versions require explicit manual promotion of a tested digest.");
    if (input.testedDigest || input.testedSourceSha || input.candidateTag || input.acceptanceUrl || input.confirmTested) {
      throw new Error("Candidate builds cannot accept promotion inputs.");
    }
    const sourceSha = validateSourceSha(input.sourceSha);
    return {
      mode, image: IMAGE, tag: version.tag, sourceSha,
      immutableTags: [version.tag, `sha-${sourceSha}`],
      tags: [version.tag, `sha-${sourceSha}`],
    };
  }
  if (mode !== "promote-stable") throw new Error("Unknown publication action.");
  if (input.eventName !== "workflow_dispatch" || input.confirmTested !== true) {
    throw new Error("Stable promotion requires manual dispatch and explicit acceptance of the tested digest.");
  }
  if (!input.defaultBranch || input.ref !== `refs/heads/${input.defaultBranch}`) {
    throw new Error("Stable promotion must use the default branch's release policy.");
  }
  if (version.prerelease.length) throw new Error("Only a stable SemVer version can update latest.");
  const candidate = imageVersion(input.candidateTag);
  if (!candidate.prerelease.length || candidate.core !== version.core) {
    throw new Error("The tested candidate must be a prerelease of the same stable version.");
  }
  const testedDigest = validateDigest(input.testedDigest);
  const sourceSha = validateSourceSha(input.testedSourceSha);
  let evidence;
  try { evidence = new URL(input.acceptanceUrl); } catch { throw new Error("An HTTPS acceptance evidence URL is required."); }
  if (evidence.protocol !== "https:" || evidence.username || evidence.password) throw new Error("Acceptance evidence must use HTTPS without embedded credentials.");
  return {
    mode, image: IMAGE, tag: version.tag, sourceSha, testedDigest,
    candidateTag: candidate.tag, acceptanceUrl: evidence.href,
    immutableTags: [version.tag], tags: [version.tag, "latest"],
  };
}

export function digestFromRegistryResponse(status, digest) {
  if (status === 404) return null;
  if (status !== 200) throw new Error(`Registry lookup failed with HTTP ${status}; refusing publication.`);
  return validateDigest(digest);
}

export async function checkReleasePlan(plan, lookup) {
  for (const tag of plan.immutableTags) {
    const existing = await lookup(tag);
    if (existing !== null) throw new Error(`Immutable tag ${tag} already exists; refusing to overwrite it.`);
  }
  if (plan.mode === "promote-stable") {
    for (const reference of [plan.candidateTag, `sha-${plan.sourceSha}`, plan.testedDigest]) {
      if (await lookup(reference) !== plan.testedDigest) {
        throw new Error(`Promotion source ${reference} does not resolve to the accepted digest.`);
      }
    }
  }
}

export async function publishRelease(plan, builtDigest, { lookup, createTags }) {
  if (plan.mode === "promote-stable" && builtDigest) throw new Error("Stable promotion must not rebuild the candidate.");
  const digest = validateDigest(plan.mode === "promote-stable" ? plan.testedDigest : builtDigest);
  await checkReleasePlan(plan, lookup);
  if (await lookup(digest) !== digest) throw new Error("Source digest is missing from the registry.");
  // Verify immutable aliases before allowing a stable promotion to move latest.
  await createTags(plan.image, digest, plan.immutableTags);
  for (const tag of plan.immutableTags) {
    if (await lookup(tag) !== digest) throw new Error(`Published tag ${tag} failed digest verification; inspect the registry before retrying.`);
  }
  if (plan.mode === "promote-stable" || plan.mode === "build-stable") {
    await createTags(plan.image, digest, ["latest"]);
    if (await lookup("latest") !== digest) throw new Error("Published latest failed digest verification; inspect the registry before retrying.");
  }
  return { ...plan, digest };
}

// Network and Docker access exist only behind an explicit CLI invocation.
async function registryLookup() {
  const token = process.env.GHCR_TOKEN;
  const actor = process.env.GITHUB_ACTOR;
  if (!token || !actor) throw new Error("GHCR_TOKEN and GITHUB_ACTOR are required for authenticated registry checks.");
  const repository = IMAGE.slice("ghcr.io/".length);
  const tokenUrl = new URL("https://ghcr.io/token");
  tokenUrl.searchParams.set("service", "ghcr.io");
  tokenUrl.searchParams.set("scope", `repository:${repository}:pull,push`);
  const response = await fetch(tokenUrl, {
    headers: { Authorization: `Basic ${Buffer.from(`${actor}:${token}`).toString("base64")}` },
    redirect: "error", signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Registry authentication failed with HTTP ${response.status}.`);
  const credentials = await response.json();
  const bearer = credentials.token || credentials.access_token;
  if (typeof bearer !== "string" || !bearer) throw new Error("Registry did not return an access token.");
  return async (reference) => {
    const result = await fetch(`https://ghcr.io/v2/${repository}/manifests/${encodeURIComponent(reference)}`, {
      method: "HEAD", headers: { Authorization: `Bearer ${bearer}`, Accept: MANIFEST_TYPES },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000),
    });
    return digestFromRegistryResponse(result.status, result.headers.get("docker-content-digest"));
  };
}

async function planFromEvent() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const input = event.inputs || {};
  const release = process.env.GITHUB_EVENT_NAME === "release";
  if (release && (event.action !== "published" || event.release?.draft)) throw new Error("Only published releases are supported.");
  const plan = createReleasePlan({
    eventName: process.env.GITHUB_EVENT_NAME,
    action: release ? (event.release?.prerelease ? "candidate" : "build-stable") : input.action,
    tag: release ? event.release?.tag_name : input.tag,
    sourceSha: process.env.GITHUB_SHA,
    ref: process.env.GITHUB_REF,
    defaultBranch: event.repository?.default_branch,
    candidateTag: input.candidate_tag,
    testedDigest: input.tested_digest,
    testedSourceSha: input.tested_source_sha,
    acceptanceUrl: input.acceptance_url,
    confirmTested: input.confirm_tested === true || input.confirm_tested === "true",
    releasePublished: release && event.action === "published",
    releasePrerelease: event.release?.prerelease,
  });
  if (plan.mode !== "promote-stable") {
    const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const taggedSource = execFileSync("git", ["rev-parse", `${plan.tag}^{commit}`], { encoding: "utf8" }).trim();
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    if (source !== plan.sourceSha || taggedSource !== source || pkg.version !== plan.tag.slice(1)) {
      throw new Error("Tag, checked-out source, workflow SHA and package version must agree.");
    }
  }
  return plan;
}

async function main(command) {
  if (!["plan", "check", "publish"].includes(command)) throw new Error("Usage: node scripts/release-image-policy.mjs plan|check|publish");
  const plan = await planFromEvent();
  if (command === "plan") {
    await writeFile(process.env.RELEASE_PLAN_FILE, `${JSON.stringify(plan, null, 2)}\n`);
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(process.env.GITHUB_OUTPUT, `mode=${plan.mode}\nimage=${plan.image}\ntag=${plan.tag}\n`);
    }
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const lookup = await registryLookup();
  if (command === "check") return checkReleasePlan(plan, lookup);
  const receipt = {
    ...plan, digest: validateDigest(plan.mode === "promote-stable" ? plan.testedDigest : process.env.BUILT_DIGEST),
    publicationStatus: "pending", startedAt: new Date().toISOString(), workflowSha: process.env.GITHUB_SHA,
    runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    buildMetadata: process.env.BUILDX_METADATA ? JSON.parse(process.env.BUILDX_METADATA) : null,
    runtimeVerification: "Not performed by publication; see the candidate acceptance evidence for each architecture.",
  };
  await writeFile(process.env.RELEASE_RECEIPT_FILE, `${JSON.stringify(receipt, null, 2)}\n`);
  try {
    await publishRelease(plan, process.env.BUILT_DIGEST, {
      lookup,
      createTags: async (image, digest, tags) => {
        execFileSync("docker", ["buildx", "imagetools", "create", "--prefer-index=false", ...tags.flatMap((tag) => ["--tag", `${image}:${tag}`]), `${image}@${digest}`], { stdio: "inherit" });
      },
    });
    receipt.publicationStatus = "verified";
    receipt.publishedAt = new Date().toISOString();
  } catch (error) {
    receipt.publicationStatus = "failed";
    receipt.failure = "Publication did not complete verification. Inspect tag digests and workflow logs before retrying; partial writes may exist.";
    throw error;
  } finally {
    await writeFile(process.env.RELEASE_RECEIPT_FILE, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `Published ${plan.mode}:\n\n\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\`\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

// One-time, explicitly requested compatibility alias. Never retag Git sources.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { IMAGE, validateDigest } from './release-image-policy.mjs';
const receipt = JSON.parse(await readFile('release-image-receipt.json', 'utf8'));
assert.equal(receipt.tag, 'v0.3.2');
assert.equal(receipt.publicationStatus, 'verified');
assert.equal(receipt.image, IMAGE);
const digest = validateDigest(receipt.digest);
for (const arch of ['amd64', 'arm64']) {
  const check = JSON.parse(await readFile(`release-container-${arch}.json`, 'utf8'));
  assert.equal(check.status, 'passed');
  assert.equal(check.image, `${IMAGE}@${digest}`);
  assert.equal(check.version, 'v0.3.2');
  assert.equal(check.source, receipt.sourceSha);
  assert.ok(check.checks.length && check.checks.every(check => check.passed));
}
const docker = (...args) => execFileSync('docker', args, {encoding: 'utf8', timeout: 120000}).trim();
const lookup = tag => validateDigest(JSON.parse(docker('buildx', 'imagetools', 'inspect', `${IMAGE}:${tag}`, '--format', '{{json .Manifest}}')).digest);
assert.equal(lookup('v0.3.2'), digest);
assert.equal(lookup('latest'), digest);
const aliases = JSON.parse(await readFile('scripts/security-image-aliases.json', 'utf8'));
const results = [];
// Preflight every alias before changing any of them. Refuse unexpected concurrent writes.
for (const [tag, expected] of Object.entries(aliases)) {
  const previous = lookup(tag);
  assert.ok([digest, expected].includes(previous), `Unexpected digest for ${tag}`);
  results.push({tag, previous, digest, status: 'pending'});
}
const save = () => writeFile('security-alias-receipt.json', JSON.stringify({source: receipt.sourceSha, digest, aliases: results}, null, 2));
await save();
for (const result of results) {
  assert.ok([result.previous, digest].includes(lookup(result.tag)));
  docker('buildx', 'imagetools', 'create', '--prefer-index=false', '--tag', `${IMAGE}:${result.tag}`, `${IMAGE}@${digest}`);
  assert.equal(lookup(result.tag), digest);
  result.status = 'verified';
  await save();
}

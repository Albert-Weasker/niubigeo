// One-time, explicitly requested compatibility alias. Never retag Git sources.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { IMAGE, validateDigest } from './release-image-policy.mjs';
const receipt = JSON.parse(await readFile('release-image-receipt.json', 'utf8'));
assert.equal(receipt.tag, 'v0.3.1');
assert.equal(receipt.publicationStatus, 'verified');
assert.equal(receipt.image, IMAGE);
const digest = validateDigest(receipt.digest);
for (const arch of ['amd64', 'arm64']) {
  const check = JSON.parse(await readFile(`release-container-${arch}.json`, 'utf8'));
  assert.equal(check.status, 'passed');
  assert.equal(check.image, `${IMAGE}@${digest}`);
  assert.equal(check.version, 'v0.3.1');
  assert.equal(check.source, receipt.sourceSha);
  assert.ok(check.checks.length && check.checks.every(check => check.passed));
}
const docker = (...args) => execFileSync('docker', args, {encoding: 'utf8'}).trim();
const lookup = tag => validateDigest(JSON.parse(docker('buildx', 'imagetools', 'inspect', `${IMAGE}:${tag}`, '--format', '{{json .Manifest}}')).digest);
assert.equal(lookup('v0.3.1'), digest);
assert.equal(lookup('latest'), digest);
const previous = lookup('v0.3.0');
// Refuse unexpected concurrent changes; this is the original published v0.3.0 digest.
assert.ok([digest, 'sha256:4031aecbd5a2d4232113196d3112a88b465a854fcfe44ed10c36f53ccd1519af'].includes(previous));
await writeFile('v030-alias-receipt.json', JSON.stringify({previous, digest, source: receipt.sourceSha, status: 'pending'}, null, 2));
docker('buildx', 'imagetools', 'create', '--prefer-index=false', '--tag', `${IMAGE}:v0.3.0`, `${IMAGE}@${digest}`);
assert.equal(lookup('v0.3.0'), digest);
await writeFile('v030-alias-receipt.json', JSON.stringify({previous, digest, source: receipt.sourceSha, status: 'verified'}, null, 2));

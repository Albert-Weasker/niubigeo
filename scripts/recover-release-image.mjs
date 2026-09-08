import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const command = process.argv[2];
assert.ok(['prepare', 'publish'].includes(command));
const { createReleasePlan, validateDigest } = await import(pathToFileURL(resolve('scripts/release-image-policy.mjs')).href);
const tag = process.env.RECOVERY_TAG;
const digest = validateDigest(process.env.RECOVERY_DIGEST);
const source = process.env.RECOVERY_SOURCE;
const originalRun = process.env.ORIGINAL_RUN;
const originalAttempt = process.env.ORIGINAL_ATTEMPT;
for (const value of [originalRun, originalAttempt]) assert.ok(value && [...value].every(character => '0123456789'.includes(character)));
const repository = process.env.GITHUB_REPOSITORY;
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });
const release = JSON.parse(gh('api', `repos/${repository}/releases/tags/${encodeURIComponent(tag)}`));
assert.equal(release.draft, false);
assert.equal(release.tag_name, tag);
assert.ok(release.published_at);
const original = JSON.parse(gh('api', `repos/${repository}/actions/runs/${originalRun}/attempts/${originalAttempt}`));
assert.equal(original.event, 'release');
assert.equal(original.head_sha, source);
assert.equal(original.status, 'completed');
assert.equal(original.path, '.github/workflows/docker-publish.yml');
const current = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(current, source);
const event = { action: 'published', release, repository: { default_branch: 'main' } };
const eventPath = resolve('recovery-release-event.json');
await writeFile(eventPath, JSON.stringify(event));
const plan = createReleasePlan({
  eventName: 'release', action: release.prerelease ? 'candidate' : 'build-stable', tag,
  sourceSha: source, ref: `refs/tags/${tag}`, releasePublished: true, releasePrerelease: release.prerelease,
});
if (command === 'prepare') {
  gh('run', 'download', originalRun, '--repo', repository, '--name', `image-release-${originalRun}-${originalAttempt}`, '--dir', 'original-acceptance');
}
const originalPlan = JSON.parse(await readFile('original-acceptance/release-image-plan.json', 'utf8'));
assert.equal(originalPlan.sourceSha, source);
assert.equal(originalPlan.tag, tag);
assert.equal(originalPlan.mode, plan.mode);
const originalCheck = JSON.parse(await readFile('original-acceptance/release-container-amd64.json', 'utf8'));
assert.equal(originalCheck.image, `${plan.image}@${digest}`);
assert.equal(originalCheck.source, source);
assert.equal(originalCheck.version, tag);
const environment = {
  ...process.env,
  GITHUB_EVENT_NAME: 'release', GITHUB_EVENT_PATH: eventPath,
  GITHUB_SHA: source, GITHUB_REF: `refs/tags/${tag}`,
  BUILT_DIGEST: digest,
};
if (command === 'publish') {
  for (const arch of ['amd64', 'arm64']) {
    const check = JSON.parse(await readFile(`release-container-${arch}.json`, 'utf8'));
    assert.equal(check.status, 'passed');
    assert.equal(check.image, `${plan.image}@${digest}`);
    assert.equal(check.source, source);
    assert.equal(check.version, tag);
    assert.equal(check.platform, `linux/${arch}`);
    assert.ok(check.checks.length > 0 && check.checks.every(item => item.passed));
  }
}
const commands = command === 'prepare' ? ['plan', 'check'] : ['publish'];
for (const action of commands) execFileSync(process.execPath, ['scripts/release-image-policy.mjs', action], { env: environment, stdio: 'inherit' });
await writeFile('recovery-provenance.json', JSON.stringify({
  tag, digest, sourceSha: source, originalRunUrl: original.html_url,
  originalAttempt, recoveryRunUrl: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  rebuilt: false, originalReleaseEventFetchedFromGitHub: true,
  command, recordedAt: new Date().toISOString(),
}, null, 2) + '\n');
if (command === 'prepare' && process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `image=${plan.image}@${digest}\n`);

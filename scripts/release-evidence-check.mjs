import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { files, hash, readJson, snapshot, writeJson } from '../examples/lib/io.mjs';

const root = 'validation/release-v0.2.0-rc.1';
const directory = `${root}/additional-${Date.now()}`;
await mkdir(directory, { recursive: true });
const before = await snapshot('.', ['src', 'test', 'e2e', 'scripts', 'website', 'examples/lib', 'examples/study-plan.json']);
const records = [];
const errors = [];
let assertions = 0;
let current;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
async function verify(name, operation) {
  assertions += 1;
  try { await operation(); current.assertions.push({ name, passed: true }); }
  catch (error) { current.assertions.push({ name, passed: false, error: String(error) }); throw error; }
}
async function capture(name) {
  const path = `${directory}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  current.screenshots.push({ path, sha256: hash(await readFile(path)) });
}
async function scenario(id, operation) {
  current = { id, assertions: [], screenshots: [], passed: false };
  records.push(current);
  try { await operation(); current.passed = true; }
  catch (error) { current.error = String(error); await capture(`${id}-failure`); }
}
async function ready(base) {
  await expect.poll(async () => {
    try { return (await fetch(`${base}/api/projects`)).status; } catch { return 0; }
  }, { timeout: 30000 }).toBe(200);
}
try {
  await scenario('B01', async () => {
    await page.goto('http://127.0.0.1:8794/en/cases/');
    await page.getByRole('heading', { name: 'niubistar.com', exact: true }).getByRole('link').click();
    await verify('English case navigation', () => expect(page).toHaveURL(url => url.pathname === '/en/cases/R01/'));
    const disclosure = page.locator('details').filter({ has: page.getByText('Read the original answer', { exact: true }) }).first();
    await disclosure.locator('summary').click();
    await verify('nonempty original answer', () => expect(disclosure.locator('pre')).toContainText('domainRecognition'));
    await verify('Provider source category', () => expect(page.getByRole('heading', { name: 'Provider citations', exact: true }).first()).toBeVisible());
    const link = page.locator('a[href$="public-evidence.json"]').first();
    const url = new URL(await link.getAttribute('href'), page.url());
    const response = await fetch(url);
    await verify('public evidence directly downloadable', async () => expect(response.status).toBe(200));
    current.evidenceHash = hash(await response.text());
    await capture('B01-original-answer');
  });
  await scenario('B02', async () => {
    await page.goto('http://127.0.0.1:8794/en/cases/R01/');
    await page.locator('.language-link').click();
    await verify('Chinese document language', () => expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN'));
    await verify('Chinese case path', () => expect(page).toHaveURL(url => url.pathname === '/zh/cases/R01/'));
    await verify('Chinese summary', () => expect(page.getByRole('heading', { name: '本次实际结果', exact: true })).toBeVisible());
    await capture('B02-Chinese-case');
  });
  await scenario('B03', async () => {
    await page.goto('http://127.0.0.1:8794/en/cases/R01/');
    await verify('sponsor disclosure', () => expect(page.locator('body')).toContainText('sponsor'));
    for (const model of (await readJson(`${root}/study-plan.json`)).models) await verify(`model visible: ${model.modelId}`, () => expect(page.locator('body')).toContainText(model.modelId));
    await capture('B03-sponsor-and-models');
  });
  await scenario('B04', async () => {
    await page.goto('http://127.0.0.1:8794/en/cases/R04/');
    await verify('real partial case', () => expect(page.locator('[data-result-status=partial]').first()).toBeVisible());
    await verify('real analysis failure retained', () => expect(page.locator('body')).toContainText('analysis_failed'));
    await capture('B04-partial-case');
  });
  for (const [id, metric] of [['B05', 'positive_recommendation'], ['B06', 'keyword_association_coverage']]) await scenario(id, async () => {
    const state = (await readJson(`${root}/results.json`)).cases.find(item => item.caseId === 'R04');
    await page.goto(`http://127.0.0.1:8798/?view=measurements&projectId=${state.projectId}&project=${state.projectId}`);
    await expect(page.getByTestId('phase5-ready')).toBeVisible();
    await page.getByRole('button', { name: '关键词', exact: true }).click();
    await expect(page.locator('[data-point]').first()).toBeVisible();
    const visible = await page.locator('[data-point]').evaluateAll(elements => elements.map(element => element.getAttribute('data-point')));
    const point = state.statistics.snapshot.points.find(item => item.metric === metric && visible.includes(item.id));
    await verify(`${metric}: actual archived point is visible`, async () => expect(Boolean(point)).toBe(true));
    const button = page.locator(`[data-point="${point.id}"]`);
    const tooltip = await button.locator('title').textContent();
    await verify('tooltip has archived numerator and denominator', async () => expect(tooltip).toContain(`命中 ${point.numerator} / 可判定 ${point.denominator}`));
    await button.click();
    const drawer = page.getByTestId('measurement-evidence-drawer');
    await verify('point opens evidence drawer', () => expect(drawer).toBeVisible());
    await verify('drawer agrees with point counts', () => expect(drawer).toContainText(`分子 ${point.numerator} / 分母 ${point.denominator}`));
    const answers = await drawer.locator('pre').allTextContents();
    const attempts = state.measurementRuns.flatMap(run => run.probes.flatMap(probe => probe.attempts));
    await verify('drawer answers exactly match stored attempts', async () => expect(answers.length > 0 && answers.every(answer => attempts.some(attempt => attempt.rawAnswer === answer))).toBe(true));
    current.point = { id: point.id, metric, numerator: point.numerator, denominator: point.denominator, observedAt: point.observedAt, modelId: point.modelId, keywordId: point.keywordId, tooltip };
    current.rawAnswerHashes = answers.map(hash);
    await capture(`${id}-point-and-originals`);
  });
  await scenario('A21-local-asset-check', async () => {
    const pairs = ['niubigeo-emblem', 'niubigeo-lockup'];
    for (const name of pairs) {
      const dark = await readFile(`assets/brand/${name}.svg`, 'utf8');
      const light = await readFile(`assets/brand/${name}-light.svg`, 'utf8');
      const geometry = svg => {
        const $ = load(svg, { xmlMode: true });
        return JSON.stringify($('*').toArray().map(element => ({ tag: element.name, attributes: Object.fromEntries(Object.entries(element.attribs || {}).filter(([key]) => key !== 'fill').sort(([a], [b]) => a.localeCompare(b))) })));
      };
      await verify(`${name}: identical geometry`, async () => expect(geometry(dark)).toBe(geometry(light)));
      await verify(`${name}: no bitmap`, async () => expect(load(dark, { xmlMode: true })('image').length).toBe(0));
    }
    current.scope = 'SVG geometry only; actual GitHub dark/light rendering not verified because this candidate is unpublished.';
  });
  await scenario('B08', async () => {
    const base = 'http://127.0.0.1:8810';
    const container = 'niubigeo-phase6-acceptance-' + Date.now();
    const data = `${directory}/container-data`;
    await mkdir(data);
    execFileSync('docker', ['run', '-d', '--name', container, '--platform', 'linux/amd64', '-p', '127.0.0.1:8810:8787', '-v', `${process.cwd()}/${data}:/app/data/product-v2`, 'niubigeo:v0.2.0-rc.1-rc4-amd64']);
    await ready(base);
    await page.goto(base);
    await verify('fresh candidate empty', () => expect(page.getByTestId('empty-state')).toBeVisible());
    await verify('20 study projects not seeded', () => expect(page.getByTestId('project-card')).toHaveCount(0));
    await capture('B08-empty-container');
    async function create(domain, name) {
      await page.getByTestId('new-project').click();
      await page.locator('#project-domain').fill(domain);
      await page.locator('#project-name').fill(name);
      await page.getByTestId('save-draft').click();
      await verify(`created ${name}`, () => expect(page.getByTestId('selected-project-title')).toHaveText(name));
      await expect(page.getByTestId('project-drawer')).toHaveAttribute('aria-hidden', 'true');
      return new URL(page.url()).searchParams.get('projectId');
    }
    const a = await create('example.com', 'Candidate A');
    const b = await create('example.org', 'Candidate B');
    await page.selectOption('[data-testid=project-select]', a);
    await verify('switch A', () => expect(page.getByTestId('selected-project-title')).toHaveText('Candidate A'));
    await page.reload();
    await verify('refresh preserves A', () => expect(page.getByTestId('selected-project-title')).toHaveText('Candidate A'));
    const restartBefore = await snapshot('.', [data]);
    execFileSync('docker', ['restart', container]);
    await ready(base);
    await page.goto(`${base}/?projectId=${a}`);
    await verify('restart preserves A', () => expect(page.getByTestId('selected-project-title')).toHaveText('Candidate A'));
    await verify('restart preserves file hashes', async () => expect((await snapshot('.', [data])).sha256).toBe(restartBefore.sha256));
    await capture('B08-restarted');
    await page.getByTestId('archive-project').click();
    await verify('archive selects B', () => expect(page.getByTestId('selected-project-title')).toHaveText('Candidate B'));
    await page.locator('[data-list-mode=archived]').click();
    await page.getByRole('button', { name: '恢复项目' }).click();
    await verify('restore A', () => expect(page.getByTestId('selected-project-title')).toHaveText('Candidate A'));
    page.once('dialog', dialog => dialog.accept());
    await page.getByTestId('delete-project').click();
    await page.reload();
    await verify('delete selects B and does not revive A', () => expect(page.getByTestId('selected-project-title')).toHaveText('Candidate B'));
    await verify('one active project remains', () => expect(page.getByTestId('project-card')).toHaveCount(1));
    await verify('deleted project API404', async () => expect((await fetch(`${base}/api/projects/${a}`)).status).toBe(404));
    const backup = `${directory}/backup-data`;
    await cp(data, backup, { recursive: true });
    const restored = `${container}-restore`;
    execFileSync('docker', ['run', '-d', '--name', restored, '--platform', 'linux/arm64', '-p', '127.0.0.1:8811:8787', '-v', `${process.cwd()}/${backup}:/app/data/product-v2`, 'niubigeo:v0.2.0-rc.1-rc4-arm64']);
    await ready('http://127.0.0.1:8811');
    await page.goto(`http://127.0.0.1:8811/?projectId=${b}`);
    await verify('backup reopened in arm64', () => expect(page.getByTestId('selected-project-title')).toHaveText('Candidate B'));
    await verify('deleted project absent in backup', () => expect(page.getByTestId('project-card')).toHaveCount(1));
    await capture('B08-backup-copy');
    current.persistence = { data, backup, records: await Promise.all([a, b].map(id => readJson(`${data}/projects/${id}/project.json`))), restartHash: restartBefore.sha256 };
    current.containers = [container, restored];
    current.platforms = ['linux/amd64', 'linux/arm64'];
    current.candidateDigest = (await readJson(`${root}/rc4-image-provenance.json`)).indexDigest;
    const rollback = `${directory}/rollback-copy`;
    await cp(backup, rollback, { recursive: true });
    const rollbackContainer = `${container}-rollback`;
    execFileSync('docker', ['run', '-d', '--name', rollbackContainer, '--platform', 'linux/amd64', '-p', '127.0.0.1:8812:8787', '-v', `${process.cwd()}/${rollback}:/app/data/product-v2`, 'niubigeo:v0.2.0-rc.1-final-amd64']);
    await ready('http://127.0.0.1:8812');
    await page.goto(`http://127.0.0.1:8812/?projectId=${b}`);
    await verify('previous candidate reads rollback copy', () => expect(page.getByTestId('selected-project-title')).toHaveText('Candidate B'));
    await verify('rollback does not revive deleted A', () => expect(page.getByTestId('project-card')).toHaveCount(1));
    await capture('B08-rollback-copy');
    current.rollback = { data: rollback, container: rollbackContainer, imageId: JSON.parse(execFileSync('docker', ['inspect', rollbackContainer], { encoding: 'utf8' }))[0].Image, scope: 'previous local candidate; not a stable-release migration guarantee' };
    current.containers.push(rollbackContainer);
  });
} finally {
  await context.tracing.stop({ path: `${directory}/trace.zip` });
  await browser.close();
  const after = await snapshot('.', ['src', 'test', 'e2e', 'scripts', 'website', 'examples/lib', 'examples/study-plan.json']);
  const report = { records, assertions, passed: records.every(x => x.passed) && errors.length === 0 && before.sha256 === after.sha256, errors, beforeHash: before.sha256, afterHash: after.sha256, unchanged: before.sha256 === after.sha256, providerInferenceCalls: 0, trace: `${directory}/trace.zip` };
  await writeJson(`${directory}/report.json`, report);
  console.log(JSON.stringify({ path: `${directory}/report.json`, passed: report.passed, assertions, failures: records.filter(x => !x.passed).map(x => ({ id: x.id, error: x.error })) }));
  if (!report.passed) process.exitCode = 1;
}

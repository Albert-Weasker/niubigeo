import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { argumentsMap, files, hash, readJson, snapshot, writeJson } from '../examples/lib/io.mjs';

const options = Object.fromEntries(Object.entries(argumentsMap(process.argv.slice(2))).map(([key, value]) => [key.slice(2), value]));
const root = resolve(options.root || 'validation/release-v0.2.0-rc.1');
const mode = options.mode;
const folder = join(root, `${mode}-browser-${Date.now()}`);
await mkdir(folder, { recursive: true });
const sourcePaths = ['src', 'test', 'e2e', 'scripts', 'website', 'examples/lib', 'examples/cli.mjs', 'examples/case-inputs.json', 'examples/model-inputs.json', 'examples/study-plan.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'assets/brand', 'Dockerfile', 'docker-compose.yml', '.dockerignore', '.github'];
const before = await snapshot('.', sourcePaths);
await writeJson(join(folder, 'before.json'), before);
const records = [];
let browser;

async function run(command, args, config = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...config });
  const output = [];
  child.stdout.on('data', value => output.push(value.toString()));
  child.stderr.on('data', value => output.push(value.toString()));
  const exitCode = await new Promise((resolveResult, reject) => { child.once('error', reject); child.once('close', resolveResult); });
  return { command: [command, ...args], exitCode, output: output.join('') };
}

try {
  if (mode === 'regression') {
    const workspace = join(folder, 'workspace');
    await mkdir(workspace);
    for (const path of ['src', 'test', 'e2e', 'assets/brand', 'package.json', 'package-lock.json', 'tsconfig.json', ...((await readdir('.')).filter(x => x.startsWith('playwright') && x.endsWith('.ts')))]) {
      await cp(path, join(workspace, path), { recursive: true });
    }
    await symlink(resolve('node_modules'), join(workspace, 'node_modules'));
    const reference = 'validation/rebuild-phase-3-2026-09-06/niubistar-live-current-path.txt';
    await mkdir(join(workspace, 'validation/rebuild-phase-3-2026-09-06'), { recursive: true });
    await cp(reference, join(workspace, reference));
    for (const phase of [1, 2, 3, 4, 5]) {
      const destination = join(folder, `phase${phase}`);
      await mkdir(destination);
      const config = phase === 1 ? 'playwright.config.ts' : `playwright.phase${phase}.config.ts`;
      const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: join(destination, 'results.json'), PLAYWRIGHT_HTML_OUTPUT_DIR: join(destination, 'html') };
      delete env.OPENROUTER_API_KEY;
      const execution = await run(process.execPath, [resolve('node_modules/playwright/cli.js'), 'test', '--config', config, '--reporter=json,html', '--output', join(destination, 'artifacts')], { cwd: workspace, env });
      await writeFile(join(destination, 'output.log'), execution.output);
      const report = await readJson(join(destination, 'results.json'));
      const specs = [];
      function visit(suite) { specs.push(...(suite.specs || [])); for (const child of suite.suites || []) visit(child); }
      for (const suite of report.suites) visit(suite);
      const assertions = [];
      function steps(items) { for (const step of items || []) { if (step.category === 'expect') assertions.push(step); steps(step.steps); } }
      for (const spec of specs) for (const test of spec.tests) for (const result of test.results) steps(result.steps);
      const record = { phase, command: execution.command, exitCode: execution.exitCode, stats: report.stats, testFiles: new Set(specs.map(x => x.file)).size, independentScenarios: specs.length, recordedAssertions: assertions.length, assertionCountScope: 'expect steps present in Playwright JSON; trace may contain additional browser operations', failures: specs.filter(x => !x.ok).map(x => ({ title: x.title, tests: x.tests })), path: destination };
      records.push(record);
      console.log(JSON.stringify({ phase, exitCode: record.exitCode, stats: record.stats }));
    }
  } else {
    const baseUrl = options.base;
    if (!baseUrl || !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)) throw new Error('Only an explicit local candidate URL is allowed.');
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    if (mode === 'cases') {
      if (!options.digest) throw new Error('Candidate image digest is required.');
      const results = await readJson(join(root, 'results.json'));
      const plan = await readJson(join(root, 'study-plan.json'));
      const index = [];
      const ledgerBefore = hash(await readFile(join(root, 'provider-ledger.json')));
      for (const state of results.cases) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
        const page = await context.newPage();
        const errors = [];
        const writes = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (request.method() !== 'GET') writes.push({ method: request.method(), url: request.url() }); });
        const trace = join(folder, `${state.caseId}-trace.zip`);
        const checks = [];
        async function capture(view, zh, en, isMeasurement = false) {
          const models = state.recognitionRuns.flatMap(x => x.models);
          const attempts = isMeasurement ? state.measurementRuns.flatMap(x => x.probes.flatMap(p => p.attempts)) : models.flatMap(x => x.attempts);
          const path = `assets/screenshots/v0.2.0-rc.1/${state.caseId}-${view}.png`;
          await page.screenshot({ path, fullPage: true });
          const observationTimes = [...new Set(attempts.map(x => x.startedAt).filter(Boolean))];
          const protocol = isMeasurement ? 'D/K' : 'D';
          index.push({ path, sha256: hash(await readFile(path)), caseId: state.caseId, view, runIds: [...new Set(attempts.map(x => x.runId))], modelRunIds: [...new Set(attempts.map(x => x.modelRunId))], attemptIds: attempts.map(x => x.id), observedAt: observationTimes, capturedAt: new Date().toISOString(), viewport: page.viewportSize(), browser: browser.version(), candidateImageDigest: options.digest, platform: 'linux/arm64', pagePath: new URL(page.url()).pathname + new URL(page.url()).search, trace, redacted: false, alt: { en: `${state.domain}: ${en}`, zh: `${state.domain}：${zh}` }, caption: { en: `${state.caseId} · ${state.domain} · ${protocol} · ${attempts.length} archived attempts · ${plan.models.map(x => `${x.modelId} (${x.webSearchMode})`).join(', ')} · ${observationTimes[0]} to ${observationTimes.at(-1)}. Original failures remain visible.`, zh: `${state.caseId} · ${state.domain} · ${protocol} · ${attempts.length} 条归档尝试 · ${plan.models.map(x => `${x.modelId}（${x.webSearchMode}）`).join('、')} · ${observationTimes[0]} 至 ${observationTimes.at(-1)}。保留原始失败状态。` } });
        }
        try {
          await page.goto(`${baseUrl}/?projectId=${state.projectId}`);
          await page.getByRole('button', { name: '域名认知', exact: true }).click();
          await expect(page.getByTestId('recognition-model-run')).toHaveCount(state.recognitionRuns.at(-1).models.length);
          checks.push('all selected model cards rendered');
          await capture('models', '各模型域名认知结果', 'individual domain recognition results');
          for (const detail of await page.locator('details.evidence-details').all()) if (await detail.getAttribute('open') === null) await detail.locator('summary').first().click();
          await expect(page.locator('details.evidence-details[open]')).toHaveCount(state.recognitionRuns.at(-1).models.length);
          checks.push('all model evidence disclosures opened using DOM');
          await capture('answers', '原始回答及来源类别', 'original answers and source categories');
          if (state.keywords?.selected?.length) {
            await page.goto(`${baseUrl}/?view=measurements&projectId=${state.projectId}&project=${state.projectId}`);
            await expect(page.getByTestId('phase5-ready')).toBeVisible();
            await page.getByRole('button', { name: '关键词', exact: true }).click();
            await capture('keywords', '实际中性关键词测量', 'actual neutral keyword measurements', true);
            checks.push('keyword page rendered from actual measurement archives');
            if (state.measurementRuns.length > 1) {
              await expect(page.locator('[data-point]').first()).toBeVisible();
              const point = page.locator('[data-point]').first();
              const tooltip = await point.locator('title').textContent();
              await point.click();
              await expect(page.getByTestId('measurement-evidence-drawer')).toBeVisible();
              await expect(page.getByTestId('measurement-evidence-drawer').locator('pre').first()).toBeVisible();
              checks.push({ pointId: await point.getAttribute('data-point'), tooltip, drawer: await page.getByTestId('measurement-evidence-drawer').innerText() });
              await capture('point-evidence', '数据点及逐条原文证据', 'measurement point and original-answer evidence', true);
            }
          }
        } catch (error) { errors.push(String(error)); await page.screenshot({ path: join(folder, `${state.caseId}-failed.png`), fullPage: true }); }
        await context.tracing.stop({ path: trace });
        await context.close();
        const record = { caseId: state.caseId, checks, errors, writes, passed: errors.length === 0 };
        records.push(record);
        await writeJson(join(folder, 'screenshot-index.json'), index);
        console.log(JSON.stringify({ caseId: state.caseId, passed: record.passed, screenshots: index.filter(x => x.caseId === state.caseId).length }));
      }
      await writeJson(join(root, 'screenshot-index.json'), index);
      records.push({ check: 'no inference during evidence read', passed: ledgerBefore === hash(await readFile(join(root, 'provider-ledger.json'))) });
    } else if (mode === 'site') {
      const context = await browser.newContext();
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      for (const language of ['en', 'zh']) for (const width of [390, 768, 1440]) for (const route of ['', 'cases/', 'cases/R01/']) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${baseUrl}/${language}/${route}`);
        for (const image of await page.locator('img').all()) {
          if (!(await image.isVisible())) continue;
          await image.scrollIntoViewIfNeeded();
          await expect.poll(() => image.evaluate(element => element.complete), { timeout: 10000 }).toBe(true);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        const state = await page.evaluate(() => ({ width: innerWidth, contentWidth: document.documentElement.scrollWidth, brokenImages: [...document.images].filter(x => !x.complete || !x.naturalWidth).map(x => x.src), lang: document.documentElement.lang }));
        const screenshot = join(folder, `${language}-${width}-${route.split('/').filter(Boolean).join('-') || 'home'}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        records.push({ language, width, route, ...state, screenshot, passed: state.contentWidth <= width && state.brokenImages.length === 0 });
      }
      await page.goto(`${baseUrl}/en/cases/`);
      await page.locator('[name=q]').fill('vercel');
      await expect(page.locator('[data-case]:visible')).toHaveCount(1);
      await page.locator('[data-reset]').click();
      await expect(page.locator('[data-case]:visible')).toHaveCount(20);
      await page.locator('.language-link').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      records.push({ check: 'search/reset/language/reduced-motion', passed: await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches) });
      records.push({ check: 'page errors', errors: pageErrors, passed: pageErrors.length === 0 });
      await context.tracing.stop({ path: join(folder, 'trace.zip') });
      await context.close();
    } else throw new Error('Expected --mode regression, cases or site.');
  }
} catch (error) {
  records.push({ check: 'script completed without an uncaught error', passed: false, error: String(error) });
} finally {
  if (browser) await browser.close();
  const after = await snapshot('.', sourcePaths);
  await writeJson(join(folder, 'after.json'), after);
  const report = { mode, path: folder, beforeHash: before.sha256, afterHash: after.sha256, unchanged: before.sha256 === after.sha256, records, passed: before.sha256 === after.sha256 && records.length > 0 && records.every(x => x.passed === true || x.exitCode === 0), providerInferenceCalls: 0, evidenceScope: mode === 'regression' ? 'existing isolated tests; fixture providers except explicitly archived evidence' : 'actual browser DOM on local serving process' };
  await writeJson(join(folder, 'report.json'), report);
  console.log(JSON.stringify({ report: join(folder, 'report.json'), passed: report.passed }));
  if (!report.passed) process.exitCode = 1;
}

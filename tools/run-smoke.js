/**
 * Runs the browser smoke suites headlessly, so CI exercises them instead of waiting for somebody
 * to open the pages by hand.
 *
 * This gap was not hypothetical: `tests/smoke/smoke.js` audits its own coverage and had been
 * throwing on the first uncovered component for long enough that thirteen of them had drifted out,
 * and the page reported "0 passed, 1 failed" to nobody. `tests/unit/smoke-coverage.test.js` now
 * catches a *missing* case from Node; only a real browser catches a case that *fails*.
 *
 * Deliberately uses `playwright-core` against an installed Chrome rather than `playwright`, which
 * downloads its own browsers on install. GitHub's ubuntu runners ship Google Chrome, and so does
 * every machine that develops this library, so the devDependency stays a few hundred kilobytes.
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SMOKE_PORT ?? 8399);
const base = `http://127.0.0.1:${port}`;

/*
 * The two suites, the global each publishes its result on, and the element that says it has
 * finished. Both pages pre-initialise their global to an empty result so a crash still leaves
 * something readable, which means the global's mere presence proves nothing — waiting on it alone
 * reads the placeholder and reports a pass with zero checks. The status element is the real signal:
 * it stays "Running…" with no `data-state` until the run is over.
 */
const suites = [
  { name: 'source', url: `${base}/tests/smoke/smoke.html`, global: '__zxSmoke', done: '#summary' },
  { name: 'dist', url: `${base}/tests/smoke/smoke-dist.html`, global: '__zxDistSmoke', done: '#result' }
];

const server = spawn(process.execPath, [resolve(root, 'tools/serve.js')], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore'
});
process.on('exit', () => server.kill());

let browser;
let failed = false;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome' });
  for (const suite of suites) failed = (await run(browser, suite)) || failed;
} catch (error) {
  console.error(`\nSmoke run could not start: ${error.message}`);
  if (String(error.message).includes('chrome')) {
    console.error('Install Google Chrome, or set a channel Playwright can find.');
  }
  failed = true;
} finally {
  await browser?.close();
  server.kill();
}

process.exit(failed ? 1 : 0);

/**
 * Opens one suite and reports it.
 * @param {import('playwright-core').Browser} instance Browser.
 * @param {{name: string, url: string, global: string}} suite Suite descriptor.
 * @returns {Promise<boolean>} Whether the suite failed.
 */
async function run(instance, suite) {
  const page = await instance.newPage();
  /** @type {string[]} */
  const problems = [];

  // An uncaught exception is always a failure — it is how the coverage audit announces itself.
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));

  /*
   * Resources are judged from the response, not from the console. "Failed to load resource" does
   * not say which one, and every page a browser opens asks for /favicon.ico whether it declares
   * one or not — reading that as a failure would make the suite permanently red for a file no page
   * here ever references.
   */
  page.on('response', (response) => {
    const url = response.url();
    if (response.ok() || new URL(url).pathname === '/favicon.ico') return;
    problems.push(`${response.status()} ${url}`);
  });

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() !== 'error') return;
    if (text.startsWith('Failed to load resource')) return; // covered above, with the URL
    problems.push(`console: ${text}`);
  });

  await page.goto(suite.url, { waitUntil: 'load' });
  const finished = await page.waitForFunction(
    (selector) => ['pass', 'fail'].includes(document.querySelector(selector)?.dataset.state),
    suite.done,
    { timeout: 60_000 }
  ).then(() => true).catch(() => false);
  const result = finished
    ? await page.evaluate((name) => globalThis[name] ?? null, suite.global)
    : null;
  await page.close();

  if (!result) {
    console.error(`FAIL  ${suite.name}: the suite never finished (${suite.done} never reached a result)`);
    for (const problem of problems.slice(0, 5)) console.error(`        ${problem}`);
    return true;
  }

  // The two pages report differently: the source suite counts surfaces, the dist page is a
  // single pass/fail over the global bundles.
  const failures = (result.results ?? []).filter((entry) => entry.passed === false
    || (entry.create !== undefined && !(entry.create && entry.exercise && entry.destroy && entry.recreate)));
  const bad = suite.name === 'dist' ? result.passed !== true : failures.length > 0;

  if (bad) {
    console.error(`FAIL  ${suite.name}`);
    for (const entry of failures) {
      console.error(`        ${entry.component ?? entry.name}: ${(entry.error ?? '').split('\n').join(' / ')}`);
    }
    for (const problem of problems.slice(0, 5)) console.error(`        ${problem}`);
    return true;
  }

  const count = suite.name === 'dist' ? (result.results?.length ?? 0) : result.passed;
  if (problems.length) {
    console.error(`FAIL  ${suite.name} passed its assertions but the page reported ${problems.length} problem(s)`);
    for (const problem of problems.slice(0, 5)) console.error(`        ${problem}`);
    return true;
  }
  console.log(`PASS  ${suite.name} — ${count} checks`);
  return false;
}

/** @returns {Promise<void>} */
async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/tests/smoke/smoke.html`, { method: 'HEAD' });
      if (response.ok) return;
    } catch {
      // The server is still binding.
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`dev server did not come up on ${base}`);
}

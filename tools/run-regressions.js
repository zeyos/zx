/**
 * Runs behavioral regressions against source modules in an installed Chrome.
 * Each case gets an isolated page in both themes. No generated output or browser downloads.
 * `node tools/run-regressions.js forms` selects a suite; REGRESSION_BASE reuses a dev server.
 */
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, 'tests/regression');
const selected = new Set(process.argv.slice(2));
const suites = (await readdir(directory)).filter((file) => file.endsWith('.js'))
  .filter((file) => selected.size === 0 || selected.has(file.replace(/\.js$/, ''))).sort();
if (!suites.length || [...selected].some((name) => !suites.includes(`${name}.js`))) {
  throw new Error(`Unknown or empty regression suite selection: ${[...selected].join(', ')}`);
}
const themes = (process.env.REGRESSION_THEMES ?? 'light,dark').split(',');
if (!themes.length || themes.some((theme) => !['light', 'dark'].includes(theme))) {
  throw new Error('REGRESSION_THEMES must contain light, dark, or both');
}
const port = Number(process.env.REGRESSION_PORT ?? 8398);
const base = (process.env.REGRESSION_BASE ?? `http://127.0.0.1:${port}`).replace(/\/$/, '');
const server = process.env.REGRESSION_BASE ? null : spawn(process.execPath, ['tools/serve.js'], {
  cwd: root, env: { ...process.env, PORT: String(port), SERVE_ROOT: '.', HOST: '127.0.0.1' },
  stdio: ['ignore', 'ignore', 'pipe']
});
let serverError = '';
server?.stderr.on('data', (chunk) => { serverError += chunk.toString(); });
server?.on('error', (error) => { serverError += error.message; });
const stopServer = () => server?.kill();
process.on('exit', stopServer);

let browser;
let passed = 0;
let failed = 0;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome' });
  for (const file of suites) {
    const { cases } = await import(pathToFileURL(resolve(directory, file)).href);
    if (!Array.isArray(cases) || cases.length === 0) throw new Error(`${file} exports no cases`);
    for (const theme of themes) {
      for (const entry of cases) {
        if (typeof entry.name !== 'string' || typeof entry.run !== 'function') {
          throw new Error(`Invalid case in ${file}`);
        }
        const context = await browser.newContext({
          viewport: { width: 1280, height: 900 }, colorScheme: theme,
          reducedMotion: 'reduce', timezoneId: 'Europe/Vienna'
        });
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        const problems = [];
        page.on('pageerror', (error) => problems.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') problems.push(message.text());
        });
        let timer;
        try {
          await page.goto(`${base}/tests/regression/harness.html?theme=${theme}`);
          await page.waitForFunction(() => Boolean(window.zx));
          await Promise.race([
            entry.run({ page, theme, base }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Case exceeded 30 seconds')), 30_000); })
          ]);
          if (problems.length) throw new Error(`Browser errors: ${problems.join('\n')}`);
          passed += 1;
          console.log(`PASS ${theme} ${file}: ${entry.name}`);
        } catch (error) {
          failed += 1;
          console.error(`FAIL ${theme} ${file}: ${entry.name}\n${error.stack ?? error}`);
        } finally {
          clearTimeout(timer);
          await context.close();
        }
      }
    }
  }
} catch (error) {
  failed += 1;
  console.error(error.stack ?? error);
} finally {
  await browser?.close();
  stopServer();
  process.removeListener('exit', stopServer);
}
console.log(`Browser regressions: ${passed} passed, ${failed} failed.`);
process.exitCode = failed ? 1 : 0;

/** Waits for the owned or supplied server; startup errors are never mistaken for a test pass. */
async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (serverError) throw new Error(serverError);
    if (server && server.exitCode !== null) throw new Error(`Regression server exited ${server.exitCode}`);
    try {
      const response = await fetch(`${base}/tests/regression/harness.html`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Startup may still be in progress. */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Regression server did not become available: ${base}`);
}

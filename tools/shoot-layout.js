/**
 * Screenshots one application layout from `website/layouts/` in every theme, and
 * reports what the browser complained about while doing it.
 *
 *   node tools/shoot-layout.js mail --out /tmp/shots
 *   node tools/shoot-layout.js mail --themes dark --width 1280 --height 800
 *   node tools/shoot-layout.js mail --preset ocean        # under another accent preset
 *   node tools/shoot-layout.js mail --preview            # the gallery-thumbnail state
 *   node tools/shoot-layout.js mail --steps ./steps.mjs  # drive it first
 *
 * `--steps` names a module whose default export is `async (page, { shot }) => {}`; it runs after
 * the layout has mounted, in each theme, and `shot(name)` saves an extra screenshot.
 *
 * Every run also unmounts the layout and reports any element it left behind on <body>, because a
 * gallery that opens and closes layouts in one page accumulates whatever a layout forgets to
 * destroy. Exits non-zero on a page error, a console error, or a leak.
 *
 * Uses `tests/layouts/harness.html` through its own `tools/serve.js` on a random port, so several
 * runs can go at once. Requires an installed Google Chrome, like `npm run test:browser`.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const id = args.find((arg) => !arg.startsWith('--') && !isValueOf(arg));
if (!id) {
  console.error('Usage: node tools/shoot-layout.js <id> [--out dir] [--themes light,dark] '
    + '[--preset name] [--width 1440] [--height 900] [--preview] [--steps file.mjs]');
  process.exit(2);
}

const out = resolve(option('out') ?? resolve(tmpdir(), 'zx-layout-shots'));
const themes = (option('themes') ?? 'light,dark').split(',');
const preset = option('preset');
const width = Number(option('width') ?? 1440);
const height = Number(option('height') ?? 900);
const preview = args.includes('--preview');
const stepsPath = option('steps');
const steps = stepsPath ? (await import(pathToFileURL(resolve(stepsPath)).href)).default : null;
const port = 9100 + Math.floor(Math.random() * 800);
const base = `http://127.0.0.1:${port}`;

mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, [resolve(root, 'tools/serve.js')], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore'
});
process.on('exit', () => server.kill());

let failed = false;
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome' });
  for (const theme of themes) failed = (await shoot(theme)) || failed;
} catch (error) {
  console.error(`shoot-layout: ${error.message}`);
  failed = true;
} finally {
  await browser?.close();
  server.kill();
}
process.exit(failed ? 1 : 0);

/**
 * @param {string} theme
 * @returns {Promise<boolean>} Whether anything went wrong.
 */
async function shoot(theme) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const problems = [];
  const warnings = [];
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('console', (message) => {
    // A failed request is reported with its URL by the response listener below.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      problems.push(`console.error: ${message.text()}`);
    }
    if (message.type() === 'warning') warnings.push(`console.warn: ${message.text()}`);
  });
  page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });

  const name = `${id}-${theme}${preset ? `-${preset}` : ''}${preview ? '-preview' : ''}`;
  const query = new URLSearchParams({ id, theme, ...(preset ? { preset } : {}), ...(preview ? { preview: '1' } : {}) });
  try {
    await page.goto(`${base}/tests/layouts/harness.html?${query}`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready="true"]', { timeout: 10_000 });
    await page.waitForTimeout(400);
    if (steps) {
      await steps(page, {
        theme,
        shot: async (label) => {
          const file = resolve(out, `${name}-${label}.png`);
          await page.screenshot({ path: file });
          console.log(`  ${file}`);
        }
      });
    }
    const file = resolve(out, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(`${theme}: ${file}`);

    const leftovers = await page.evaluate(() => {
      window.__layout.unmount();
      return [...document.body.children]
        .filter((node) => node.id !== 'stage' && node.localName !== 'script')
        .map((node) => `<${node.localName}${node.className ? ` class="${node.className}"` : ''}>`);
    });
    for (const leftover of leftovers) problems.push(`left on <body> after unmount: ${leftover}`);
  } catch (error) {
    problems.push(error.message);
  }
  for (const warning of new Set(warnings)) console.log(`  ${warning}`);
  for (const problem of problems) console.log(`  PROBLEM ${problem}`);
  await page.close();
  return problems.length > 0;
}

/** @param {string} name @returns {string|undefined} */
function option(name) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

/** @param {string} arg @returns {boolean} Whether `arg` is the value of a preceding option. */
function isValueOf(arg) {
  const index = args.indexOf(arg);
  return index > 0 && args[index - 1].startsWith('--') && args[index - 1] !== '--preview';
}

/** @returns {Promise<void>} */
async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${base}/tests/layouts/harness.html`);
      if (response.ok) return;
    } catch { /* not up yet */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`server did not start on ${base}`);
}

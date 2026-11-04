/**
 * Measures what large tables cost: 1,000, 10,000 and 50,000 rows of eight columns, each drawn
 * plain, sorted with `selectable: 'multi'`, and grouped into section rows.
 *
 *   npm run bench:table                      every case, standard rendering
 *   npm run bench:table -- --virtual         the same cases with `virtual: true`
 *   npm run bench:table -- --json out.json   also write the full results
 *   npm run bench:table -- --runs 5          runs per case (default 3; the median is reported)
 *   npm run bench:table -- --only 10000      only one size, or one case: --only 10000:sorted
 *
 * Per case it reports the time to first render (construction until the frame after it), the time
 * a sort takes (a click on a header until the frame after it), the scripting time per frame while
 * a script scrolls the table to its last row, and the DOM node count and JS heap once it is there.
 * The budget applies to the 10,000-row cases; the exit code is 1 when one of them misses it.
 *
 * Every run of every case gets a fresh browser context, so no case inherits another's heap, and
 * the runs are interleaved rather than repeated back to back, so a burst of load elsewhere on the
 * machine spreads across cases instead of landing on one of them.
 *
 * Drives the installed Chrome through `playwright-core`, as `tools/run-smoke.js` does, against its
 * own `tools/serve.js` on a free port, so it can run beside the smoke suites.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Row counts measured. */
const SIZES = [1000, 10000, 50000];
/** Rendering variants measured at every size. */
const CASES = ['plain', 'sorted', 'grouped'];
/** The size the budget is set for. */
const BUDGET_ROWS = 10000;
/** Budget for one 10,000-row case of eight columns. */
const BUDGET = { render: 400, sort: 250, script: 4, nodes: 150000 };
/** Frames the scripted scroll takes from the first row to the last, whatever the row count. */
const SCROLL_FRAMES = 240;
/** Height of the table's own scroll region, in CSS pixels. */
const SCROLL_HEIGHT = 600;
/** A section row every this many rows in the grouped case. */
const SECTION_EVERY = 20;

const args = parseArgs(process.argv.slice(2));
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
/** The page every case runs in: the stylesheet and the Table module, nothing else. */
const PAGE = `${base}/__bench__/table.html`;

const server = spawn(process.execPath, [resolve(root, 'tools/serve.js')], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore'
});
process.on('exit', () => server.kill());

let browser;
let exitCode = 0;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome' });
  const plan = SIZES.flatMap((rows) => CASES.map((name) => ({ rows, name })))
    .filter(({ rows, name }) => args.only.every((only) => only.rows === rows && (!only.name || only.name === name)));
  if (plan.length === 0) throw new Error(`--only matched no case (sizes ${SIZES.join(', ')}; cases ${CASES.join(', ')})`);

  /** @type {Map<string, object[]>} */
  const runs = new Map(plan.map((entry) => [key(entry), []]));
  for (let run = 0; run < args.runs; run += 1) {
    for (const entry of plan) {
      process.stderr.write(`run ${run + 1}/${args.runs}  ${entry.rows.toLocaleString('en')} ${entry.name}${args.virtual ? ' (virtual)' : ''}\n`);
      runs.get(key(entry)).push(await measure(browser, entry));
    }
  }

  const results = plan.map((entry) => {
    const samples = runs.get(key(entry));
    const median = {};
    for (const metric of ['render', 'sort', 'script', 'nodes', 'heap', 'frames']) {
      median[metric] = medianOf(samples.map((sample) => sample[metric]));
    }
    const misses = entry.rows === BUDGET_ROWS ? budgetMisses(median) : [];
    return { rows: entry.rows, case: entry.name, virtual: args.virtual, median, misses, runs: samples };
  });

  const version = browser.version();
  report(results, version);
  if (args.json) {
    writeFileSync(resolve(args.json), `${JSON.stringify({
      browser: version,
      virtual: args.virtual,
      runs: args.runs,
      columns: 8,
      scrollHeight: SCROLL_HEIGHT,
      scrollFrames: SCROLL_FRAMES,
      budget: { rows: BUDGET_ROWS, ...BUDGET },
      results
    }, null, 2)}\n`);
  }
  if (results.some((result) => result.misses.length)) exitCode = 1;
} catch (error) {
  console.error(`\nTable benchmark could not run: ${error.message}`);
  if (String(error.message).includes('chrome')) console.error('Install Google Chrome, or set a channel Playwright can find.');
  exitCode = 2;
} finally {
  await browser?.close();
  server.kill();
}
process.exit(exitCode);

/**
 * Runs one case once, in a context of its own.
 * @param {import('playwright-core').Browser} instance Browser.
 * @param {{rows: number, name: string}} entry Case.
 * @returns {Promise<{render: number, sort: number|null, script: number, frames: number, nodes: number, heap: number}>}
 */
async function measure(instance, entry) {
  const context = await instance.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  await page.route(PAGE, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: harness() }));
  try {
    await page.goto(PAGE, { waitUntil: 'load' });
    await page.waitForFunction(() => globalThis.__bench?.ready === true, null, { timeout: 15_000 });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');

    const render = await page.evaluate((options) => globalThis.__bench.mount(options), {
      rows: entry.rows, name: entry.name, virtual: args.virtual, height: SCROLL_HEIGHT, sectionEvery: SECTION_EVERY
    });
    const sort = await page.evaluate(() => globalThis.__bench.sort());

    const before = await metrics(cdp);
    const frames = await page.evaluate((count) => globalThis.__bench.scroll(count), SCROLL_FRAMES);
    const after = await metrics(cdp);
    const script = (after.ScriptDuration - before.ScriptDuration) * 1000 / frames;

    await cdp.send('HeapProfiler.collectGarbage');
    const nodes = await page.evaluate(() => globalThis.__bench.nodes());
    const heap = (await metrics(cdp)).JSHeapUsedSize / 1024 / 1024;
    const reached = await page.evaluate(() => globalThis.__bench.atEnd());
    if (!reached) problems.push('the scripted scroll did not reach the last row');
    if (problems.length) throw new Error(`${entry.rows} ${entry.name}: ${problems.slice(0, 3).join(' / ')}`);
    return { render, sort, script, frames, nodes, heap };
  } finally {
    await context.close();
  }
}

/** @param {import('playwright-core').CDPSession} cdp @returns {Promise<Record<string, number>>} */
async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.map(({ name, value }) => [name, value]));
}

/**
 * @param {{render: number, sort: number|null, script: number, nodes: number}} median Median values.
 * @returns {string[]} The budget lines missed.
 */
function budgetMisses(median) {
  const misses = [];
  if (median.render >= BUDGET.render) misses.push('render');
  if (median.sort !== null && median.sort >= BUDGET.sort) misses.push('sort');
  if (median.script >= BUDGET.script) misses.push('script');
  if (median.nodes >= BUDGET.nodes) misses.push('nodes');
  return misses;
}

/**
 * Prints the results table.
 * @param {Array<{rows: number, case: string, median: Record<string, number|null>, misses: string[]}>} results
 * @param {string} version Browser version.
 * @returns {void}
 */
function report(results, version) {
  const header = ['rows', 'case', 'render ms', 'sort ms', 'script ms/frame', 'DOM nodes', 'JS heap MB', 'budget'];
  const lines = results.map(({ rows, case: name, median, misses }) => [
    rows.toLocaleString('en'),
    name,
    median.render.toFixed(0),
    median.sort === null ? 'n/a' : median.sort.toFixed(0),
    median.script.toFixed(2),
    Math.round(median.nodes).toLocaleString('en'),
    median.heap.toFixed(1),
    rows !== BUDGET_ROWS ? '' : misses.length ? `MISSED: ${misses.join(', ')}` : 'met'
  ]);
  const widths = header.map((title, column) => Math.max(title.length, ...lines.map((line) => line[column].length)));
  const row = (cells) => cells.map((cell, column) => (column < 2 || column === 7
    ? cell.padEnd(widths[column]) : cell.padStart(widths[column]))).join('  ').trimEnd();
  console.log(`\nTable at scale — ${args.virtual ? 'virtual: true' : 'standard rendering'}, 8 columns, `
    + `${SCROLL_HEIGHT}px scroll region, median of ${args.runs} run(s), Chrome ${version}`);
  console.log(row(header));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const line of lines) console.log(row(line));
  console.log(`\nBudget at ${BUDGET_ROWS.toLocaleString('en')} rows: first render < ${BUDGET.render} ms, sort < ${BUDGET.sort} ms, `
    + `scripting < ${BUDGET.script} ms per frame while scrolling, < ${BUDGET.nodes.toLocaleString('en')} DOM nodes after scrolling to the end.`);
  console.log('Sort is n/a for the grouped case: a table holding section rows withholds its sort.');
  const missed = results.filter((result) => result.misses.length);
  console.log(missed.length ? `Budget missed by ${missed.length} case(s).` : 'Budget met.');
}

/** @param {Array<number|null>} values @returns {number|null} */
function medianOf(values) {
  const numbers = values.filter((value) => typeof value === 'number').sort((left, right) => left - right);
  if (numbers.length === 0) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

/** @param {{rows: number, name: string}} entry @returns {string} */
function key(entry) {
  return `${entry.rows}:${entry.name}`;
}

/**
 * @param {string[]} argv Command-line arguments.
 * @returns {{virtual: boolean, json: string|null, runs: number, only: Array<{rows: number, name: string|null}>}}
 */
function parseArgs(argv) {
  const options = { virtual: false, json: null, runs: 3, only: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--virtual') options.virtual = true;
    else if (arg === '--json') options.json = argv[++index] ?? null;
    else if (arg === '--runs') options.runs = Math.max(1, Math.trunc(Number(argv[++index])) || 3);
    else if (arg === '--only') {
      const [rows, name] = String(argv[++index] ?? '').split(':');
      options.only.push({ rows: Number(rows), name: name || null });
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (options.json === null && argv.includes('--json')) {
    console.error('--json needs a file name');
    process.exit(2);
  }
  return options;
}

/** @returns {Promise<number>} A port nothing is listening on. */
function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port: free } = /** @type {import('node:net').AddressInfo} */ (probe.address());
      probe.close(() => done(free));
    });
  });
}

/** @returns {Promise<void>} */
async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/src/components/table/table.js`, { method: 'HEAD' });
      if (response.ok) return;
    } catch {
      // The server is still binding.
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`dev server did not come up on ${base}`);
}

/**
 * The page each case runs in. It builds the rows before the clock starts, so only the table is
 * timed, and counts every node in the document — text nodes included, as the browser's own DOM
 * node counter does.
 * @returns {string} HTML.
 */
function harness() {
  return `<!doctype html>
<html lang="en" data-zx-theme="light">
<head>
<meta charset="utf-8">
<title>Table benchmark</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="/styles/zx.css">
<style>body { margin: 0; } #host { inline-size: 1200px; padding: 16px; }</style>
</head>
<body class="zx-scope">
<div id="host"></div>
<script type="module">
import { Table } from '/src/components/table/table.js';

const CITIES = ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Wien', 'Zürich'];
const STATUSES = ['Draft', 'Open', 'Confirmed', 'Shipped', 'Invoiced', 'Paid', 'Cancelled'];
const COMPANIES = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Wonka', 'Tyrell', 'Cyberdyne', 'Hooli'];
const FORMS = ['GmbH', 'AG', 'KG', 'SE', 'e.K.'];

let table = null;
let scroller = null;

/** Deterministic rows, so every run and both modes draw exactly the same data. */
function makeRows(count, sectionEvery) {
  const rows = [];
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let index = 0; index < count; index += 1) {
    if (sectionEvery && index % sectionEvery === 0) {
      rows.push({ ID: index + 1, kind: 'section', number: 'Section ' + (index / sectionEvery + 1) });
      continue;
    }
    const quantity = 1 + Math.floor(random() * 40);
    const price = Math.round(random() * 50000) / 100;
    const day = 1 + Math.floor(random() * 28);
    const month = 1 + Math.floor(random() * 12);
    rows.push({
      ID: index + 1,
      kind: 'position',
      number: 'SO-' + String(100000 + index),
      customer: COMPANIES[Math.floor(random() * COMPANIES.length)] + ' '
        + FORMS[Math.floor(random() * FORMS.length)] + ' ' + (1 + Math.floor(random() * 900)),
      city: CITIES[Math.floor(random() * CITIES.length)],
      status: STATUSES[Math.floor(random() * STATUSES.length)],
      date: '2026-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
      quantity,
      price,
      amount: Math.round(quantity * price * 100) / 100
    });
  }
  return rows;
}

const COLUMNS = [
  { id: 'number', label: 'Order', sortable: true },
  { id: 'customer', label: 'Customer', sortable: true },
  { id: 'city', label: 'City', sortable: true },
  { id: 'status', label: 'Status', sortable: true },
  { id: 'date', label: 'Date', sortable: true },
  { id: 'quantity', label: 'Quantity', type: 'number', sortable: true },
  { id: 'price', label: 'Price', type: 'currency', currency: 'EUR', sortable: true },
  { id: 'amount', label: 'Amount', type: 'currency', currency: 'EUR', sortable: true }
];

/** Resolves once the frame after the current task has been rendered. */
function frame() {
  return new Promise((resolve) => requestAnimationFrame(() => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  }));
}

globalThis.__bench = {
  ready: true,

  async mount({ rows, name, virtual, height, sectionEvery }) {
    const data = makeRows(rows, name === 'grouped' ? sectionEvery : 0);
    const options = { columns: COLUMNS, data, rowId: 'ID', height, label: 'Orders' };
    if (virtual) options.virtual = true;
    if (name === 'sorted') Object.assign(options, { selectable: 'multi', sort: { id: 'customer', dir: 'asc' } });
    if (name === 'grouped') Object.assign(options, { rowKind: 'kind', rowKinds: { section: { span: true } } });
    const host = document.querySelector('#host');
    await frame();
    const start = performance.now();
    table = new Table(host, options);
    await frame();
    const elapsed = performance.now() - start;
    scroller = host.querySelector('.zx-table__scroll');
    return elapsed;
  },

  /** A click on the Customer header, as a reader sorts; null when the header offers no sort. */
  async sort() {
    const button = table.el.querySelector('th[data-column="customer"] .zx-table__sort-button');
    if (!button) return null;
    await frame();
    const start = performance.now();
    button.click();
    await frame();
    return performance.now() - start;
  },

  /** Scrolls the table's own region from its first row to its last in a fixed number of frames. */
  scroll(count) {
    scroller.scrollTop = 0;
    const distance = scroller.scrollHeight - scroller.clientHeight;
    return new Promise((resolve) => {
      let step = 0;
      const tick = () => {
        step += 1;
        scroller.scrollTop = Math.ceil(distance * step / count);
        if (step < count) requestAnimationFrame(tick);
        else frame().then(() => resolve(count));
      };
      requestAnimationFrame(tick);
    });
  },

  atEnd() {
    const last = table.getData().length;
    const rows = [...scroller.querySelectorAll('tbody > tr[data-row]')];
    const view = scroller.getBoundingClientRect();
    // Reached when the last row of the data is drawn and inside the scroll region.
    const end = rows.find((row) => {
      const index = Number(row.getAttribute('aria-rowindex'));
      return index ? index === last + 1 : row === rows.at(-1) && rows.length === last;
    });
    if (!end) return false;
    const box = end.getBoundingClientRect();
    return box.top < view.bottom && box.bottom > view.top;
  },

  nodes() {
    let count = 0;
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_ALL);
    while (walker.nextNode()) count += 1;
    return count;
  }
};
</script>
</body>
</html>
`;
}

/**
 * Compares what the library looks like in the working tree against any git ref, section by section.
 *
 *   node tools/visual-diff.js                      # against HEAD: the theme page, light and dark
 *   node tools/visual-diff.js --base v5.6.0 --out /tmp/visual
 *   node tools/visual-diff.js --full               # also presets, spacing, radius, and 390 wide
 *   node tools/visual-diff.js --layouts            # also every layout
 *   node tools/visual-diff.js --layouts mail,crm   # also the layouts named
 *   node tools/visual-diff.js --only table         # one section, by card or layout id
 *
 * Nothing is stored between runs. The ref is checked out into a temporary worktree, both trees are
 * served at once, and one browser renders both, so fonts and anti-aliasing cannot differ between
 * the two sides and no binary baseline ever has to be committed.
 *
 * A section is one card on the theme page or one layout. Both screenshots of a section are decoded
 * into a canvas in that same browser and compared with `getImageData`: a pixel differs when any
 * channel moves by more than 2, and a section differs when more than 0.05% of its pixels do or when
 * its size changed. A section on only one side is reported as added or removed.
 *
 * The report is `<out>/index.html`, largest change first, and `<out>/report.json` with the same data.
 * Without `--out` it lands in a new directory under the system's temporary directory, so runs in
 * parallel do not overwrite each other; the path is printed either way.
 *
 * Exits 0 when nothing differs, 1 when a section differs, and 2 when the tool could not run. The
 * worktree and both servers are removed on every way out except SIGKILL.
 *
 * Requires an installed Google Chrome, like `npm run test:browser`.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'Usage: node tools/visual-diff.js [--base <ref>] [--out <dir>] [--full] [--layouts [ids]] '
  + '[--only <section>]';

const EXIT_SAME = 0;
const EXIT_DIFFERENT = 1;
const EXIT_FAILED = 2;

/** A pixel differs when any channel differs by more than this. */
const CHANNEL_TOLERANCE = 2;
/** A section differs when more than this share of its pixels do. */
const PIXEL_TOLERANCE = 0.0005;

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 900 };
const THEMES = ['light', 'dark'];

/**
 * What every page reads as "now": the instant the layout fixtures are set at. The theme page's date
 * cards draw today, and the two sides are never rendered at the same moment.
 */
const FIXED_TIME = new Date(2026, 9, 8, 10, 30);
/** How long a page may take to mount before that side counts as having failed. */
const READY_TIMEOUT = 30_000;
/** How many pairs of animation frames a page may take to stop moving. */
const SETTLE_ATTEMPTS = 40;

/**
 * Everything that must not outlive the run. `release()` empties it, so it can be reached from the
 * normal path, a signal, and the exit event alike.
 * @type {{servers: import('node:child_process').ChildProcess[], scratch: string|null,
 *   tree: string|null, link: string|null}}
 */
const held = { servers: [], scratch: null, tree: null, link: null };

/**
 * @typedef {object} Options
 * @property {string} base Git ref to compare against.
 * @property {string|null} out Report directory, or null for a new temporary one.
 * @property {boolean} full Whether to add the presets, the spacing and radius settings, and 390 wide.
 * @property {string[]|null} layouts Layout ids; empty means all of them, null none.
 * @property {string|null} only The one section to compare.
 */

/**
 * @typedef {object} Job One page, rendered once on each side.
 * @property {string} key Stable name, used for image file names.
 * @property {string} label What the report calls it.
 * @property {string} theme `light` or `dark`.
 * @property {string} path URL path and query, from the repository root.
 * @property {string} source The file whose absence means this page is not on a side at all.
 * @property {string} selector The page's sections.
 * @property {{width: number, height: number}} viewport
 * @property {Record<string, string>} storage Written to `localStorage` before any script runs.
 * @property {Record<string, string>} tokens Custom properties the working tree must then resolve.
 * @property {string} [layout] The layout this page mounts; it is then the page's only section.
 */

/**
 * @typedef {object} Capture What one side rendered of one job.
 * @property {Map<string, {title: string, image: Buffer}>} sections Screenshots by section id.
 * @property {number} found How many sections the page had, before `--only` narrowed them.
 * @property {string[]} problems What the page complained about, or why it failed.
 */

/**
 * @typedef {object} Difference One section that differs.
 * @property {string} job `Job.key`.
 * @property {string} page `Job.label`.
 * @property {string} section Section id.
 * @property {string} title
 * @property {'changed'|'added'|'removed'} status
 * @property {number} pixels How many pixels differ.
 * @property {number} share `pixels` over the section's area.
 * @property {boolean} resized Whether the size changed.
 * @property {{width: number, height: number}|null} before
 * @property {{width: number, height: number}|null} after
 * @property {{before: string|null, after: string|null, diff: string|null}} images Relative paths.
 */

/** A problem with how the tool was called: it answers with the usage line. */
class UsageError extends Error {}

/** The tool is out of step with the site, so a page must not be reported as merely different. */
class ToolError extends Error {}

/** Removes the worktree and stops the servers. Synchronous, so the exit event can run it. */
function release() {
  for (const server of held.servers.splice(0)) server.kill();
  const { scratch, tree, link } = held;
  held.scratch = null;
  held.tree = null;
  held.link = null;

  // First, so that nothing that walks the worktree can walk into the real node_modules.
  if (link) rmSync(link, { force: true });
  if (tree) {
    try {
      git(['worktree', 'remove', '--force', tree]);
    } catch (error) {
      console.error(`visual-diff: could not remove the worktree: ${error.message}`);
    }
  }
  if (scratch) {
    rmSync(scratch, { recursive: true, force: true });
    try {
      git(['worktree', 'prune']);
    } catch (error) {
      console.error(`visual-diff: could not prune worktrees: ${error.message}`);
    }
  }
}

process.on('exit', release);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    console.error(`\nvisual-diff: stopped by ${signal}`);
    process.exit(EXIT_FAILED);
  });
}
// Node's own answer to both is exit code 1, which here would claim that a section differs.
for (const event of ['uncaughtException', 'unhandledRejection']) {
  process.on(event, (error) => {
    console.error(`visual-diff: ${error instanceof Error ? error.message : error}`);
    process.exit(EXIT_FAILED);
  });
}

let code = EXIT_FAILED;
try {
  code = await main();
} catch (error) {
  console.error(`visual-diff: ${error.message}`);
  if (error instanceof UsageError) console.error(USAGE);
}
process.exit(code);

/** @returns {Promise<number>} The exit code. */
async function main() {
  const options = parseArguments(process.argv.slice(2));
  // Imported here because a failed static import exits 1, which here means a section differs.
  const { chromium } = await import('playwright-core');
  const { LAYOUT_IDS } = await import('../website/layouts/index.js');
  const theme = await import('../website/theme-presets.js');

  const commit = resolveCommit(options.base);
  const out = prepareOutput(options.out);
  const tree = checkOut(commit);
  const baseLayouts = await layoutsOf(tree);
  const jobs = plan(options, theme, [...new Set([...LAYOUT_IDS, ...baseLayouts])]);
  const sides = {
    before: { directory: tree, url: await serve(tree) },
    after: { directory: root, url: await serve(root) }
  };

  console.log(`Comparing the working tree against ${options.base} (${commit.slice(0, 7)})`);
  const browser = await launch(chromium);
  try {
    const comparison = await browser.newContext().then((context) => context.newPage());
    /** @type {Difference[]} */
    const differences = [];
    /** @type {string[]} */
    const problems = [];
    const counts = { sections: 0, unchanged: 0, withinTolerance: 0 };

    for (const job of jobs) {
      const [before, after] = await Promise.all([
        capture(browser, sides.before, job, options.only),
        capture(browser, sides.after, job, options.only)
      ]);
      problems.push(...before.problems.map((text) => `${job.label}, ${options.base}: ${text}`));
      problems.push(...after.problems.map((text) => `${job.label}, working tree: ${text}`));
      if (before.found === 0 && after.found === 0) {
        throw new Error(`${job.label} rendered no section on either side.\n${problems.slice(-4).join('\n')}`);
      }

      let differing = 0;
      const ids = [...new Set([...before.sections.keys(), ...after.sections.keys()])];
      for (const id of ids) {
        const measured = await measure(comparison, job, id, before.sections.get(id), after.sections.get(id), out);
        counts.sections += 1;
        if (measured.difference) {
          differences.push(measured.difference);
          differing += 1;
        } else {
          counts.unchanged += 1;
          if (measured.pixels > 0) counts.withinTolerance += 1;
        }
      }
      console.log(`  ${job.label}: ${differing} of ${ids.length} differ`);
    }

    if (counts.sections === 0) {
      throw new Error(options.only ? `no section is called ${options.only}` : 'nothing was compared');
    }
    differences.sort((one, other) => other.share - one.share || one.job.localeCompare(other.job));
    const report = {
      base: { ref: options.base, commit },
      thresholds: { channel: CHANNEL_TOLERANCE, pixels: PIXEL_TOLERANCE },
      pages: jobs.map((job) => ({ key: job.key, label: job.label, ...job.viewport })),
      summary: {
        sections: counts.sections,
        changed: differences.filter((entry) => entry.status === 'changed').length,
        added: differences.filter((entry) => entry.status === 'added').length,
        removed: differences.filter((entry) => entry.status === 'removed').length,
        unchanged: counts.unchanged,
        withinTolerance: counts.withinTolerance
      },
      problems: [...new Set(problems)],
      differences
    };
    writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(out, 'index.html'), renderReport(report));

    for (const problem of report.problems) console.error(`  PROBLEM ${problem}`);
    console.log(differences.length === 0
      ? `No differences: ${counts.unchanged} sections unchanged.`
      : `${differences.length} of ${counts.sections} sections differ.`);
    console.log(`Report: ${join(out, 'index.html')}`);
    return differences.length === 0 ? EXIT_SAME : EXIT_DIFFERENT;
  } finally {
    await browser.close();
  }
}

/**
 * @param {string[]} args Command-line arguments.
 * @returns {Options}
 */
function parseArguments(args) {
  /** @type {Options} */
  const options = { base: 'HEAD', out: null, full: false, layouts: null, only: null };
  const isFlag = (arg) => arg === undefined || arg.startsWith('--');

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = () => {
      index += 1;
      if (isFlag(args[index])) throw new UsageError(`${arg} needs a value`);
      return args[index];
    };
    if (arg === '--base') options.base = value();
    else if (arg === '--out') options.out = resolve(value());
    else if (arg === '--only') options.only = value();
    else if (arg === '--full') options.full = true;
    else if (arg === '--layouts') {
      options.layouts ??= [];
      while (!isFlag(args[index + 1])) {
        index += 1;
        options.layouts.push(...args[index].split(',').filter(Boolean));
      }
    } else {
      throw new UsageError(`unknown argument: ${arg}`);
    }
  }
  return options;
}

/**
 * @param {string[]} args
 * @returns {string} What git printed.
 */
function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * @param {string} ref
 * @returns {string} The commit it names.
 */
function resolveCommit(ref) {
  try {
    return git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`]);
  } catch {
    throw new Error(`${ref} is not a commit in this repository`);
  }
}

/**
 * Picks the report directory, and clears the images of an earlier report in it. `report.json` is
 * the evidence that `images` is this tool's own: `--out` can name any directory.
 * @param {string|null} requested
 * @returns {string} Absolute path.
 */
function prepareOutput(requested) {
  const out = requested ?? mkdtempSync(join(tmpdir(), 'zx-visual-report-'));
  if (existsSync(join(out, 'report.json'))) rmSync(join(out, 'images'), { recursive: true, force: true });
  mkdirSync(join(out, 'images'), { recursive: true });
  return out;
}

/**
 * Checks a commit out into a temporary worktree, with the working tree's `node_modules` beside it
 * for what the pages load from there (Chart.js).
 * @param {string} commit
 * @returns {string} The worktree's absolute path.
 */
function checkOut(commit) {
  // The real path, because that is what git records: the system's temporary directory is reached
  // through a symbolic link on macOS.
  held.scratch = realpathSync(mkdtempSync(join(tmpdir(), 'zx-visual-diff-')));
  const tree = join(held.scratch, 'base');
  git(['worktree', 'add', '--detach', '--quiet', tree, commit]);
  held.tree = tree;
  if (existsSync(join(root, 'node_modules'))) {
    held.link = join(tree, 'node_modules');
    symlinkSync(realpathSync(join(root, 'node_modules')), held.link);
  }
  return tree;
}

/**
 * The layouts the base ref registers, so that a layout deleted from the working tree is reported as
 * removed rather than missed.
 * @param {string} tree
 * @returns {Promise<string[]>} Layout ids; none when the ref has no such registry.
 */
async function layoutsOf(tree) {
  try {
    const registry = await import(pathToFileURL(join(tree, 'website/layouts/index.js')).href);
    return registry.LAYOUT_IDS ?? [];
  } catch {
    return [];
  }
}

/**
 * Turns the options into the pages to render.
 * @param {Options} options
 * @param {{DEFAULTS: {preset: string, spacing: number},
 *   PRESETS: {id: string, ramp: Record<number, string>}[],
 *   RANGES: Record<string, {min: number, max: number}>}} theme The working tree's theme model.
 * @param {string[]} layoutIds Every layout on either side.
 * @returns {Job[]}
 */
function plan(options, { DEFAULTS, PRESETS, RANGES }, layoutIds) {
  /** @type {Job[]} */
  const jobs = [];

  /**
   * @param {string} suffix What sets this variant apart in `Job.key`, if anything.
   * @param {string} detail The same for `Job.label`.
   * @param {Record<string, string>} [storage] What the site reads its theme from.
   * @param {Record<string, string>} [tokens] What that storage has to produce.
   * @param {{width: number, height: number}} [viewport]
   */
  const themePage = (suffix, detail, storage = {}, tokens = {}, viewport = DESKTOP) => {
    for (const name of THEMES) {
      jobs.push({
        key: `theme-${name}${suffix}`,
        label: `theme page, ${name}${detail}`,
        theme: name,
        path: 'website/theme.html',
        source: 'website/theme.html',
        selector: '.studio-card[id^="card-"]',
        viewport,
        storage: { 'zx-site-theme': name, ...storage },
        tokens
      });
    }
  };

  themePage('', '');
  if (options.full) {
    // Accent only, on the default geometry. The studio's whole recipes would move the spacing and
    // radius too, and those have variants of their own.
    for (const { id, ramp } of PRESETS) {
      if (id === DEFAULTS.preset) continue;
      themePage(`-preset-${id}`, `, preset ${id}`, { 'zx-site-preset': id }, { '--zx-accent-600': ramp[600] });
    }
    // The two ends of each slider: the settings furthest from the default that the page offers.
    for (const [setting, token] of [['spacing', '--zx-space-unit'], ['radius', '--zx-radius']]) {
      for (const value of [RANGES[setting].min, RANGES[setting].max]) {
        themePage(`-${setting}-${value}`, `, ${setting} ${value}px`, {
          'zx-theme-studio': JSON.stringify({ spacing: DEFAULTS.spacing, [setting]: value })
        }, { [token]: `${value}px` });
      }
    }
    themePage('-390', ', 390 wide', {}, {}, PHONE);
  }

  if (options.layouts) {
    const unknown = options.layouts.filter((id) => !layoutIds.includes(id));
    if (unknown.length > 0) throw new UsageError(`unknown layout: ${unknown.join(', ')}`);
    const ids = options.layouts.length > 0 ? options.layouts : layoutIds;
    for (const id of ids) {
      if (options.only && options.only !== id) continue;
      for (const name of THEMES) {
        jobs.push({
          key: `layout-${id}-${name}`,
          label: `layout ${id}, ${name}`,
          theme: name,
          // Preview is the state a layout promises to render with no timers, streaming, or focus.
          path: `tests/layouts/harness.html?${new URLSearchParams({ id, theme: name, preview: '1' })}`,
          source: `website/layouts/${id}.layout.js`,
          selector: 'body[data-ready="true"] #stage',
          viewport: DESKTOP,
          storage: {},
          tokens: {},
          layout: id
        });
      }
    }
  }
  return jobs;
}

/**
 * @returns {Promise<number>} A port that was free a moment ago.
 */
function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.on('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (probe.address());
      probe.close(() => done(port));
    });
  });
}

/**
 * Serves a directory with this tree's `tools/serve.js`, so both sides get the same server whatever
 * the ref holds. The server's line on stdout is the signal rather than an answer on the port: a run
 * in parallel can take the port first, and then the answer would come from its server.
 * @param {string} directory
 * @returns {Promise<string>} The server's origin.
 */
async function serve(directory) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = await freePort();
    const server = spawn(process.execPath, [join(root, 'tools/serve.js')], {
      cwd: root,
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), SERVE_ROOT: directory },
      stdio: ['ignore', 'pipe', 'ignore']
    });
    held.servers.push(server);
    const listening = await new Promise((done) => {
      const timer = setTimeout(() => done(false), 10_000);
      const settle = (result) => {
        clearTimeout(timer);
        done(result);
      };
      server.stdout.on('data', () => settle(true));
      server.once('error', () => settle(false));
      server.once('exit', () => settle(false));
    });
    if (listening) return `http://127.0.0.1:${port}`;
    server.kill();
  }
  throw new Error(`could not start a server for ${directory}`);
}

/**
 * @param {import('playwright-core').BrowserType} chromium
 * @returns {Promise<import('playwright-core').Browser>}
 */
async function launch(chromium) {
  try {
    // The signal handlers above end the process, and Playwright closes the browser on exit.
    return await chromium.launch({
      channel: 'chrome',
      // GPU raster antialiases a rounded corner differently from one render to the next, even of
      // the same tree. Software raster gives the same pixels every time.
      args: ['--disable-gpu'],
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    });
  } catch (error) {
    throw new Error(`Chrome could not start, is Google Chrome installed? ${error.message}`);
  }
}

/**
 * Renders one page on one side and takes a screenshot per section.
 *
 * A page that fails here is reported, not fatal: its sections are then missing from that side,
 * which the report states as removed or added, beside the reason.
 * @param {import('playwright-core').Browser} browser
 * @param {{directory: string, url: string}} side
 * @param {Job} job
 * @param {string|null} only
 * @returns {Promise<Capture>}
 */
async function capture(browser, side, job, only) {
  /** @type {Capture} */
  const result = { sections: new Map(), found: 0, problems: [] };
  if (!existsSync(join(side.directory, job.source))) return result;

  const context = await browser.newContext({
    viewport: job.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light'
  });
  try {
    await context.clock.setFixedTime(FIXED_TIME);
    await context.addInitScript((entries) => {
      try {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
      } catch {
        // An opaque origin has no storage, and the page it loads next does.
      }
    }, job.storage);

    const page = await context.newPage();
    watch(page, result.problems);
    await page.goto(`${side.url}/${job.path}`, { waitUntil: 'load' });
    await page.waitForSelector(job.selector, { state: 'attached', timeout: READY_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: READY_TIMEOUT });
    await settle(page, job);
    if (side.directory === root) await confirmTheme(page, job);

    const sections = await page.evaluate(locateSections, { selector: job.selector, layout: job.layout ?? null });
    result.found = sections.length;
    for (const { id, title, clip } of sections) {
      if (only && only !== id) continue;
      const image = await page.screenshot({
        type: 'png', animations: 'disabled', caret: 'hide', scale: 'css', ...(clip ? { clip, fullPage: true } : {})
      });
      result.sections.set(id, { title, image });
    }
  } catch (error) {
    if (error instanceof ToolError) throw error;
    result.problems.push(String(error.message).split('\n')[0]);
  } finally {
    await context.close();
  }
  return result;
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string[]} problems Filled as the page complains.
 * @returns {void}
 */
function watch(page, problems) {
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('console', (message) => {
    // A failed request is reported with its URL by the response listener.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      problems.push(`console.error: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
  });
}

/**
 * Waits for web fonts and images, then until the sections stop moving: controls that measure
 * themselves (toolbars, truncation) take a few frames after the fonts arrive.
 * @param {import('playwright-core').Page} page
 * @param {Job} job
 * @returns {Promise<void>}
 */
async function settle(page, job) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });

  const argument = { selector: job.selector, layout: job.layout ?? null };
  let previous = null;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    await page.evaluate(() => new Promise((done) => {
      requestAnimationFrame(() => requestAnimationFrame(done));
    }));
    const current = JSON.stringify(await page.evaluate(locateSections, argument));
    if (current === previous) return;
    previous = current;
  }
  throw new Error('the page never stopped moving');
}

/**
 * Confirms that a page shows the theme its job asked for. Both sides get the same settings, so a
 * setting that stopped reaching the page would compare clean while testing nothing. Only the
 * working tree is held to this: the settings come from its theme model, not the ref's.
 * @param {import('playwright-core').Page} page
 * @param {Job} job
 * @returns {Promise<void>}
 */
async function confirmTheme(page, job) {
  const { theme, tokens } = await page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    return {
      theme: document.documentElement.dataset.zxTheme,
      tokens: Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]))
    };
  }, Object.keys(job.tokens));
  const wrong = Object.keys(job.tokens).filter((name) => tokens[name] !== job.tokens[name]);
  if (theme !== job.theme || wrong.length > 0) {
    throw new ToolError(`${job.label} did not reach the page: data-zx-theme is ${theme}`
      + `${wrong.map((name) => `, ${name} is ${tokens[name] || 'unset'}`).join('')}`);
  }
}

/**
 * Finds a page's sections from its own structure. Runs in the page.
 *
 * Clips are in document coordinates, so that a section far down the theme page is captured where
 * it sits rather than scrolled to, which would bring the pinned header and rail over it.
 * @param {{selector: string, layout: string|null}} target
 * @returns {{id: string, title: string,
 *   clip: {x: number, y: number, width: number, height: number}|null}[]}
 */
function locateSections({ selector, layout }) {
  if (layout) {
    return document.querySelector(selector)
      ? [{ id: layout, title: window.__layout?.meta?.title ?? layout, clip: null }]
      : [];
  }
  const sections = [];
  for (const node of document.querySelectorAll(selector)) {
    const box = node.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    // Rounded as the browser snaps a box to pixels, so a section that only moved keeps its size.
    const x = Math.round(box.left + window.scrollX);
    const y = Math.round(box.top + window.scrollY);
    sections.push({
      id: node.id.replace(/^card-/, ''),
      title: node.querySelector('.studio-card__title')?.textContent ?? node.id,
      clip: {
        x,
        y,
        width: Math.round(box.right + window.scrollX) - x,
        height: Math.round(box.bottom + window.scrollY) - y
      }
    });
  }
  return sections;
}

/**
 * Compares one section and writes its images when it differs.
 * @param {import('playwright-core').Page} comparison A blank page to decode and compare in.
 * @param {Job} job
 * @param {string} id
 * @param {{title: string, image: Buffer}|undefined} before
 * @param {{title: string, image: Buffer}|undefined} after
 * @param {string} out
 * @returns {Promise<{pixels: number, difference: Difference|null}>}
 */
async function measure(comparison, job, id, before, after, out) {
  const entry = {
    job: job.key,
    page: job.label,
    section: id,
    title: (after ?? before).title
  };
  const save = (name, image) => {
    if (!image) return null;
    const relative = `images/${job.key}--${id}--${name}.png`;
    writeFileSync(join(out, relative), image);
    return relative;
  };

  if (!before || !after) {
    const { width, height } = await comparison.evaluate(readSize, (before ?? after).image.toString('base64'));
    return {
      pixels: width * height,
      difference: {
        ...entry,
        status: after ? 'added' : 'removed',
        pixels: width * height,
        share: 1,
        resized: false,
        before: before ? { width, height } : null,
        after: after ? { width, height } : null,
        images: { before: save('before', before?.image), after: save('after', after?.image), diff: null }
      }
    };
  }

  const result = await comparison.evaluate(comparePixels, {
    before: before.image.toString('base64'),
    after: after.image.toString('base64'),
    channel: CHANNEL_TOLERANCE,
    tolerance: PIXEL_TOLERANCE
  });
  if (!result.diff) return { pixels: result.pixels, difference: null };
  return {
    pixels: result.pixels,
    difference: {
      ...entry,
      status: 'changed',
      pixels: result.pixels,
      share: result.pixels / result.area,
      resized: result.resized,
      before: result.before,
      after: result.after,
      images: {
        before: save('before', before.image),
        after: save('after', after.image),
        diff: save('diff', Buffer.from(result.diff, 'base64'))
      }
    }
  };
}

/**
 * Decodes a PNG far enough to read its size. Runs in the browser.
 * @param {string} base64
 * @returns {Promise<{width: number, height: number}>}
 */
async function readSize(base64) {
  const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
  return { width: image.width, height: image.height };
}

/**
 * Decodes two PNGs into canvases and compares them, on the union of their areas. Runs in the
 * browser, and only there, which is why it brings no dependency.
 * @param {{before: string, after: string, channel: number, tolerance: number}} input Base64 PNGs and
 *   the two thresholds.
 * @returns {Promise<{pixels: number, area: number, resized: boolean,
 *   before: {width: number, height: number}, after: {width: number, height: number},
 *   diff: string|null}>} `diff` is a base64 PNG, present only when the section differs.
 */
async function comparePixels({ before, after, channel, tolerance }) {
  /** @param {string} base64 @returns {Promise<ImageBitmap>} */
  const decode = async (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return createImageBitmap(new Blob([bytes], { type: 'image/png' }), {
      colorSpaceConversion: 'none', premultiplyAlpha: 'none'
    });
  };
  const [first, second] = await Promise.all([decode(before), decode(after)]);
  const width = Math.max(first.width, second.width);
  const height = Math.max(first.height, second.height);
  const area = width * height;
  const resized = first.width !== second.width || first.height !== second.height;

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  /** @param {ImageBitmap} image @returns {ImageData} */
  const read = (image) => {
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height);
  };
  const old = read(first).data;
  const image = read(second);
  const current = image.data;

  const changed = new Uint8Array(area);
  let pixels = 0;
  for (let pixel = 0; pixel < area; pixel += 1) {
    const at = pixel * 4;
    if (Math.abs(old[at] - current[at]) > channel
      || Math.abs(old[at + 1] - current[at + 1]) > channel
      || Math.abs(old[at + 2] - current[at + 2]) > channel
      || Math.abs(old[at + 3] - current[at + 3]) > channel) {
      changed[pixel] = 1;
      pixels += 1;
    }
  }

  const sizes = {
    pixels,
    area,
    resized,
    before: { width: first.width, height: first.height },
    after: { width: second.width, height: second.height }
  };
  if (!resized && pixels / area <= tolerance) return { ...sizes, diff: null };

  // Everything unchanged fades back, so the changed pixels read at a glance and still have context.
  for (let pixel = 0; pixel < area; pixel += 1) {
    const at = pixel * 4;
    if (changed[pixel]) {
      image.data.set([255, 0, 170, 255], at);
    } else {
      for (let band = 0; band < 3; band += 1) current[at + band] = 255 - (255 - current[at + band]) / 5;
      current[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const encoded = await new Promise((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result).split(',')[1]);
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(blob);
  });
  return { ...sizes, diff: encoded };
}

/**
 * @param {string} text
 * @returns {string} `text`, safe inside HTML.
 */
function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (mark) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[mark]);
}

/**
 * @param {{width: number, height: number}|null} size
 * @returns {string}
 */
function sizeText(size) {
  return size ? `${size.width} × ${size.height}` : 'absent';
}

/**
 * The report, as a plain page that opens from disk with its images beside it.
 * @param {{base: {ref: string, commit: string},
 *   summary: {sections: number, changed: number, added: number, removed: number, unchanged: number},
 *   problems: string[], differences: Difference[]}} report
 * @returns {string}
 */
function renderReport(report) {
  const { base, summary, problems, differences } = report;
  const figure = (caption, path) => (path
    ? `<figure><figcaption>${caption}</figcaption><a href="${escapeHtml(path)}">`
      + `<img src="${escapeHtml(path)}" alt="${caption} of this section" loading="lazy"></a></figure>`
    : '');
  const rows = differences.map((entry) => {
    const change = entry.status === 'changed'
      ? `${(entry.share * 100).toFixed(2)}% of its pixels changed`
      : entry.status;
    const size = entry.resized ? `, ${sizeText(entry.before)} to ${sizeText(entry.after)}` : '';
    return `<section>
<h2>${escapeHtml(entry.title)} <small>${escapeHtml(entry.page)}</small></h2>
<p>${change}${size}</p>
<div class="images">${figure('Before', entry.images.before)}${figure('After', entry.images.after)}${figure('Diff', entry.images.diff)}</div>
</section>`;
  });
  const problemList = problems.length === 0
    ? ''
    : `<h2>Problems</h2><ul>${problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join('')}</ul>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual comparison</title>
<style>
:root { color-scheme: light dark; font: 15px/1.5 system-ui, sans-serif; }
body { margin: 0 auto; max-inline-size: 110rem; padding: 1.5rem; }
h2 small { font-weight: normal; opacity: 0.7; }
section { border-block-start: 1px solid; margin-block-start: 2rem; }
.images { align-items: start; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
figure { margin: 0; min-inline-size: 0; }
img { block-size: auto; display: block; max-inline-size: 100%; outline: 1px solid; }
</style>
</head>
<body>
<h1>Visual comparison</h1>
<p>The working tree against ${escapeHtml(base.ref)} (${escapeHtml(base.commit.slice(0, 7))}).</p>
<p>${summary.sections} sections compared: ${summary.changed} changed, ${summary.added} added,
${summary.removed} removed, ${summary.unchanged} unchanged.</p>
${problemList}
${rows.join('\n')}
</body>
</html>
`;
}

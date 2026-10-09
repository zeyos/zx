/**
 * Audits one application layout from `website/layouts/` for accessibility problems a reviewer
 * would otherwise have to find by hand, in every theme and at any size.
 *
 *   node tools/audit-layout.js mail
 *   node tools/audit-layout.js mail --themes dark --width 390 --height 844
 *   node tools/audit-layout.js mail --steps ./steps.mjs     # drive it into a state first
 *   node tools/audit-layout.js mail --json report.json
 *
 * What it checks, inside the layout's stage only:
 * - names: every interactive element in the accessibility tree has an accessible name, and
 *   repeated landmarks (two navigations, two regions) are told apart by theirs;
 * - contrast: visible text against its painted background, 4.5:1 (3:1 for large text), with
 *   translucent colours, opacity, and stacked backgrounds composited the way the browser paints
 *   them; text over an image or gradient, disabled controls (and a disabled field's label), and
 *   decoration hidden with `aria-hidden` are skipped;
 * - focus: Tab walks the layout (up to 120 stops); every stop must be visible and show an indicator
 *   (outline, box shadow, border, or background differing from the unfocused state on the element
 *   or its two nearest ancestors);
 * - structure: heading levels never skip, ids are unique, no positive tabindex, nothing focusable
 *   inside `aria-hidden`, no interactive element nested in another;
 * - targets (warning only): controls smaller than 24 × 24 px that are not links inside a sentence.
 *
 * `--steps` names a module whose default export is `async (page, { theme }) => {}`, as for
 * `tools/shoot-layout.js`. Exits non-zero when anything but a warning was found.
 *
 * Uses `tests/layouts/harness.html` through its own `tools/serve.js` on a random port. Requires an
 * installed Google Chrome, like `npm run test:browser`.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const id = args.find((arg) => !arg.startsWith('--') && !isValueOf(arg));
if (!id) {
  console.error('Usage: node tools/audit-layout.js <id> [--themes light,dark] [--preset name] '
    + '[--width 1440] [--height 900] [--steps file.mjs] [--json file] [--limit 12]');
  process.exit(2);
}

const themes = (option('themes') ?? 'light,dark').split(',');
const preset = option('preset');
const width = Number(option('width') ?? 1440);
const height = Number(option('height') ?? 900);
const limit = Number(option('limit') ?? 12);
const jsonPath = option('json');
const stepsPath = option('steps');
const steps = stepsPath ? (await import(pathToFileURL(resolve(stepsPath)).href)).default : null;
const port = 9100 + Math.floor(Math.random() * 800);
const base = `http://127.0.0.1:${port}`;

/** Roles a user operates, which must have a name. */
const NAMED_ROLES = new Set([
  'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'slider',
  'spinbutton', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'option', 'treeitem',
  'listbox', 'tree', 'grid', 'treegrid', 'dialog', 'alertdialog', 'radiogroup', 'tablist', 'menu',
  'scrollbar', 'progressbar', 'meter'
]);
/** Landmarks that need a name once there is more than one of them. */
const LANDMARKS = new Set(['navigation', 'region', 'complementary', 'search', 'form', 'main', 'banner', 'contentinfo']);

const server = spawn(process.execPath, [resolve(root, 'tools/serve.js')], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore'
});
process.on('exit', () => server.kill());

const report = {};
let failed = false;
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome' });
  for (const theme of themes) {
    const result = await audit(theme);
    report[theme] = result;
    failed = print(theme, result) || failed;
  }
} catch (error) {
  console.error(`audit-layout: ${error.message}`);
  failed = true;
} finally {
  await browser?.close();
  server.kill();
}
if (jsonPath) writeFileSync(resolve(jsonPath), JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);

/**
 * @param {string} theme
 * @returns {Promise<Record<string, string[]>>} Findings by check.
 */
async function audit(theme) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));
  const query = new URLSearchParams({ id, theme, ...(preset ? { preset } : {}) });
  await page.goto(`${base}/tests/layouts/harness.html?${query}`, { waitUntil: 'load' });
  await page.waitForSelector('body[data-ready="true"]', { timeout: 10_000 });
  await page.waitForTimeout(400);
  if (steps) await steps(page, { theme, shot: async () => {} });

  const findings = { errors, ...(await page.evaluate(inPageChecks)) };
  findings.names = await unnamed(page);
  findings.landmarks = await landmarks(page);
  Object.assign(findings, await walkFocus(page));
  await page.close();
  return findings;
}

/**
 * Interactive nodes in the accessibility tree without a name, inside the stage.
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string[]>}
 */
async function unnamed(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const found = [];
  for (const node of nodes) {
    if (node.ignored || !node.backendDOMNodeId) continue;
    const role = node.role?.value;
    if (!NAMED_ROLES.has(role)) continue;
    if (String(node.name?.value ?? '').trim()) continue;
    const description = await describe(cdp, node.backendDOMNodeId);
    if (description) found.push(`${role}: ${description}`);
  }
  await cdp.detach();
  return found;
}

/**
 * Landmarks of one role that occur more than once without distinct names.
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string[]>}
 */
async function landmarks(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  /** @type {Map<string, string[]>} */
  const byRole = new Map();
  for (const node of nodes) {
    if (node.ignored || !node.backendDOMNodeId) continue;
    const role = node.role?.value;
    if (!LANDMARKS.has(role)) continue;
    // A region without a name is not a landmark at all.
    const name = String(node.name?.value ?? '').trim();
    if (role === 'region' && !name) continue;
    if (!(await describe(cdp, node.backendDOMNodeId))) continue;
    byRole.set(role, [...(byRole.get(role) ?? []), name]);
  }
  await cdp.detach();
  const found = [];
  for (const [role, names] of byRole) {
    if (names.length < 2) continue;
    const blank = names.filter((name) => !name).length;
    const duplicates = names.filter((name, index) => name && names.indexOf(name) !== index);
    if (blank) found.push(`${names.length} × ${role}, ${blank} without a name`);
    for (const name of new Set(duplicates)) found.push(`${role} "${name}" occurs more than once`);
  }
  return found;
}

/**
 * A short description of a DOM node inside the stage, or '' when it is outside it.
 * @param {import('playwright-core').CDPSession} cdp
 * @param {number} backendNodeId
 * @returns {Promise<string>}
 */
async function describe(cdp, backendNodeId) {
  try {
    const { object } = await cdp.send('DOM.resolveNode', { backendNodeId });
    const { result } = await cdp.send('Runtime.callFunctionOn', {
      objectId: object.objectId,
      returnByValue: true,
      functionDeclaration: `function () {
        const element = this.nodeType === 1 ? this : this.parentElement;
        if (!element || !element.closest('#stage')) return '';
        const classes = [...element.classList].slice(0, 3).map((name) => '.' + name).join('');
        const text = (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
        return '<' + element.localName + classes + '>' + (text ? ' "' + text + '"' : '');
      }`
    });
    await cdp.send('Runtime.releaseObject', { objectId: object.objectId });
    return result.value ?? '';
  } catch {
    return '';
  }
}

/**
 * Tabs through the layout and checks that every stop is visible and shows an indicator.
 * @param {import('playwright-core').Page} page
 * @returns {Promise<{focus: string[], focusStops: string[]}>}
 */
async function walkFocus(page) {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    // Start just before the stage, so the first Tab lands on its first stop.
    const anchor = document.createElement('button');
    anchor.id = '__audit-anchor';
    anchor.style.cssText = 'position:fixed;inset:0 auto auto 0;opacity:0';
    document.body.prepend(anchor);
    anchor.focus();
  });
  const focus = [];
  const stops = [];
  const seen = new Set();
  for (let step = 0; step < 120; step += 1) {
    await page.keyboard.press('Tab');
    const result = await page.evaluate(focusProbe);
    if (!result) break;
    if (result.outside) break;
    if (seen.has(result.path)) break;
    seen.add(result.path);
    stops.push(result.label);
    if (result.problem) focus.push(`${result.problem}: ${result.label}`);
  }
  await page.evaluate(() => document.getElementById('__audit-anchor')?.remove());
  return { focus, focusStops: stops };
}

/**
 * Runs in the page: describes the focused element and whether a focus indicator shows.
 * @returns {{outside?: boolean, path: string, label: string, problem?: string}|null}
 */
function focusProbe() {
  // Controls that fade in on focus are measured at the end of the fade, not the start.
  for (const animation of document.getAnimations()) {
    try { animation.finish(); } catch { /* an infinite animation cannot finish */ }
  }
  const element = document.activeElement;
  if (!element || element === document.body) return null;
  if (!element.closest('#stage')) return { outside: true, path: '', label: '' };
  const path = [];
  for (let node = element; node && node.id !== 'stage'; node = node.parentElement) {
    path.push(`${node.localName}:${[...node.parentElement.children].indexOf(node)}`);
  }
  const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join('');
  const name = element.getAttribute('aria-label') || (element.textContent || '').replace(/\s+/g, ' ').trim();
  const label = `<${element.localName}${classes}>${name ? ` "${name.slice(0, 40)}"` : ''}`;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return { path: path.join('/'), label, problem: 'focus on an invisible element' };
  }
  const chain = [element, element.parentElement, element.parentElement?.parentElement].filter(Boolean);
  const read = () => chain.map((node) => {
    const computed = getComputedStyle(node);
    return [computed.outlineStyle !== 'none' ? `${computed.outlineStyle} ${computed.outlineWidth} ${computed.outlineColor}` : 'none',
      computed.boxShadow, computed.borderColor, computed.backgroundColor].join('|');
  }).join('#');
  const settle = () => {
    for (const animation of document.getAnimations()) {
      try { animation.finish(); } catch { /* infinite */ }
    }
  };
  const focused = read();
  // Compare against the same element without focus, then put focus back where it was.
  element.blur();
  settle();
  const resting = read();
  element.focus({ focusVisible: true, preventScroll: true });
  settle();
  return { path: path.join('/'), label, problem: focused === resting ? 'no visible focus indicator' : undefined };
}

/**
 * Runs in the page: structure, contrast, and target checks over the stage.
 * @returns {Record<string, string[]>}
 */
function inPageChecks() {
  for (const animation of document.getAnimations()) {
    try { animation.finish(); } catch { /* infinite */ }
  }
  const stage = document.getElementById('stage');
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };
  const describe = (element) => {
    const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join('');
    const text = (element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `<${element.localName}${classes}>${text ? ` "${text}"` : ''}`;
  };
  const focusable = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [contenteditable="true"]';
  const interactive = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"]';

  // ---- structure
  const ids = new Map();
  for (const element of stage.querySelectorAll('[id]')) ids.set(element.id, (ids.get(element.id) ?? 0) + 1);
  const duplicateIds = [...ids].filter(([, count]) => count > 1).map(([key, count]) => `#${key} × ${count}`);

  const headings = [];
  let previous = 0;
  for (const heading of stage.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')) {
    if (!visible(heading) || heading.closest('[aria-hidden="true"]')) continue;
    const level = heading.getAttribute('aria-level')
      ? Number(heading.getAttribute('aria-level')) : Number(heading.localName.slice(1));
    if (previous && level > previous + 1) headings.push(`h${previous} → h${level}: ${describe(heading)}`);
    previous = level;
  }

  const tabindex = [...stage.querySelectorAll('[tabindex]')]
    .filter((element) => Number(element.getAttribute('tabindex')) > 0).map(describe);
  const hiddenFocusable = [...stage.querySelectorAll('[aria-hidden="true"]')]
    .flatMap((hidden) => [...hidden.querySelectorAll(focusable)])
    .filter((element) => !element.disabled && element.tabIndex >= 0 && visible(element)).map(describe);
  const nested = [...stage.querySelectorAll('button, a[href], [role="button"]')]
    .filter((element) => element.parentElement?.closest('button, a[href], [role="button"]')).map(describe);

  // ---- contrast
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const parse = (value) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = '#000';
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1
  });
  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const pageBackground = parse(getComputedStyle(document.body).backgroundColor);
  /** The background painted behind an element, or null over an image or gradient. */
  const backdrop = (element) => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none' && !style.backgroundImage.startsWith('url("data:')) return null;
      const color = parse(style.backgroundColor);
      if (color.a > 0) layers.push(color);
      if (color.a >= 1) break;
    }
    let result = pageBackground.a ? pageBackground : { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) result = over(layer, result);
    return result;
  };
  const opacity = (element) => {
    let value = 1;
    for (let node = element; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  };
  const contrast = [];
  const checked = new Set();
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (!text.textContent.trim()) continue;
    const element = text.parentElement;
    if (!element || checked.has(element)) continue;
    checked.add(element);
    if (!visible(element)) continue;
    // Disabled controls — their labels included, which a disabled Field fades with the control —
    // and decoration hidden from assistive technology are exempt (WCAG 1.4.3).
    if (element.closest('[disabled], [aria-disabled="true"], [data-disabled="true"], [inert], [aria-hidden="true"], svg, canvas, .visually-hidden, .zx-visually-hidden')) continue;
    const style = getComputedStyle(element);
    if (style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)') continue;
    const background = backdrop(element);
    if (!background) continue;
    const alpha = opacity(element);
    if (alpha < 0.05) continue;
    let foreground = over(parse(style.color), background);
    if (alpha < 1) foreground = over({ ...foreground, a: alpha }, background);
    const size = parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 700;
    const minimum = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const value = ratio(foreground, background);
    if (value < minimum) contrast.push(`${value.toFixed(2)}:1 < ${minimum}: ${describe(element)}`);
  }

  // ---- target size (warnings)
  const targets = [...stage.querySelectorAll(interactive)].filter((element) => {
    if (!visible(element) || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width >= 24 && rect.height >= 24) return false;
    // A link inside running text is exempt.
    if (element.localName === 'a' && getComputedStyle(element).display === 'inline') return false;
    return true;
  }).map((element) => {
    const rect = element.getBoundingClientRect();
    return `${Math.round(rect.width)}×${Math.round(rect.height)}: ${describe(element)}`;
  });

  return { duplicateIds, headings, tabindex, hiddenFocusable, nested, contrast, targets };
}

/**
 * @param {string} theme
 * @param {Record<string, string[]>} findings
 * @returns {boolean} Whether anything other than a warning was found.
 */
function print(theme, findings) {
  const titles = {
    errors: 'page errors', names: 'interactive elements without a name', landmarks: 'repeated landmarks',
    contrast: 'text below the contrast minimum', focus: 'focus problems', headings: 'skipped heading levels',
    duplicateIds: 'duplicate ids', tabindex: 'positive tabindex', hiddenFocusable: 'focusable inside aria-hidden',
    nested: 'interactive elements nested in another', targets: 'targets under 24 × 24 px (warning)'
  };
  let bad = false;
  console.log(`${id} · ${theme} · ${width}×${height} · ${findings.focusStops.length} tab stops`);
  for (const [key, title] of Object.entries(titles)) {
    const list = [...new Set(findings[key] ?? [])];
    if (!list.length) continue;
    if (key !== 'targets') bad = true;
    console.log(`  ${key === 'targets' ? 'WARN' : 'FAIL'} ${title}: ${list.length}`);
    for (const item of list.slice(0, limit)) console.log(`    ${item}`);
    if (list.length > limit) console.log(`    … ${list.length - limit} more`);
  }
  if (!bad) console.log('  ok');
  return bad;
}

/** @param {string} name @returns {string|undefined} */
function option(name) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

/** @param {string} arg @returns {boolean} Whether `arg` is the value of a preceding option. */
function isValueOf(arg) {
  const index = args.indexOf(arg);
  return index > 0 && args[index - 1].startsWith('--');
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

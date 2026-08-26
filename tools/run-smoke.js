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
  failed = (await runDocumentationShell(browser)) || failed;
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

/** Exercises the real documentation shell, which the isolated component fixture cannot cover. */
async function runDocumentationShell(instance) {
  const page = await instance.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = [];
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  try {
    await page.goto(`${base}/website/docs.html#components/filter`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('.docs-title')?.textContent === 'Filter');
    const search = page.locator('.site-docs-search').first();
    const searchBox = await search.boundingBox();
    if (!searchBox || Math.abs(searchBox.x + searchBox.width / 2 - 720) > 2) {
      throw new Error('documentation search is not centered');
    }
    await search.locator('input').fill('toolbar');
    await page.waitForSelector('.docs-global-search__result');
    const breadcrumb = await page.locator('.docs-global-search__meta').first().textContent();
    if (!String(breadcrumb).includes('Layout > Toolbar')) throw new Error(`search breadcrumb was ${breadcrumb}`);
    await search.locator('input').press('Escape');

    for (const width of [1280, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      const headerLayout = await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => {
        const searchRect = document.querySelector('.site-docs-search')?.getBoundingClientRect();
        const chrome = [...document.querySelectorAll('.site-brand, .site-version, .site-nav, .site-actions')]
          .map((node) => ({ name: node.className, rect: node.getBoundingClientRect() }));
        const overlaps = chrome.filter(({ rect }) => searchRect
          && searchRect.left < rect.right && searchRect.right > rect.left
          && searchRect.top < rect.bottom && searchRect.bottom > rect.top)
          .map(({ name }) => name);
        resolve({ overlaps, header: document.querySelector('.site-header')?.getBoundingClientRect().height });
      })));
      if (headerLayout.overlaps.length) {
        throw new Error(`documentation search overlaps header chrome at ${width}px: ${headerLayout.overlaps.join(', ')}`);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(`${base}/website/docs.html#components/app-icon`, { waitUntil: 'load' });
    await page.waitForSelector('#section-zeyos-app-icon .zx-app-icon');
    const appIcons = await page.evaluate(() => {
      const icons = [...document.querySelectorAll('#section-zeyos-app-icon .zx-app-icon')];
      const surfaces = icons.map((icon) => icon.querySelector('.zx-app-icon__surface'));
      const centres = icons.map((icon, index) => {
        const root = icon.getBoundingClientRect();
        const glyph = icon.querySelector('.zx-app-icon__glyph').getBoundingClientRect();
        return Math.max(
          Math.abs(root.left + root.width / 2 - glyph.left - glyph.width / 2),
          Math.abs(root.top + root.height / 2 - glyph.top - glyph.height / 2)
        );
      });
      return {
        count: icons.length,
        colours: new Set(surfaces.map((surface) => getComputedStyle(surface).backgroundColor)).size,
        circles: icons.every((icon) => icon.dataset.shape === 'circle'),
        white: icons.every((icon) => {
          const channels = getComputedStyle(icon).color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
          return channels.length === 3 && channels.every((channel) => channel >= 240);
        }),
        centred: Math.max(...centres),
        noBlur: surfaces.every((surface) => getComputedStyle(surface).backdropFilter === 'none')
      };
    });
    if (appIcons.count < 20 || appIcons.colours < 20 || !appIcons.circles || !appIcons.white
      || appIcons.centred >= 0.6 || !appIcons.noBlur) {
      throw new Error(`AppIcon gallery failed visual contracts: ${JSON.stringify(appIcons)}`);
    }

    await page.evaluate(async () => {
      const { AppIcon } = await import('/src/components/app-icon/app-icon.js');
      const target = document.createElement('button');
      target.id = 'qa-interactive-app-icon';
      target.type = 'button';
      target.style.position = 'fixed';
      target.style.inset = '80px auto auto 300px';
      document.body.append(target);
      window.__qaAppIcon = new AppIcon(target, { icon: 'file', color: '#535494', label: 'QA icon' });
    });
    const interactiveIcon = page.locator('#qa-interactive-app-icon');
    const materialOf = () => interactiveIcon.locator('.zx-app-icon__surface').evaluate((surface) => {
      const style = getComputedStyle(surface);
      return { filter: style.filter, shadow: style.boxShadow, transform: style.transform };
    });
    const restingMaterial = await materialOf();
    await interactiveIcon.hover();
    await page.waitForTimeout(180);
    const hoverMaterial = await materialOf();
    if (hoverMaterial.transform !== 'none'
      || (hoverMaterial.filter === restingMaterial.filter && hoverMaterial.shadow === restingMaterial.shadow)) {
      throw new Error(`AppIcon hover feedback is missing or moves geometry: ${JSON.stringify(hoverMaterial)}`);
    }
    await interactiveIcon.evaluate((button) => { button.disabled = true; });
    await page.waitForTimeout(300);
    const disabledMaterial = await materialOf();
    const disabledState = await interactiveIcon.evaluate((button) => ({
      attribute: button.hasAttribute('disabled'),
      disabled: button.disabled,
      pseudo: button.matches(':disabled'),
      guardedHover: button.matches(':not(:disabled):not([aria-disabled="true"]):hover')
    }));
    if (disabledMaterial.filter !== restingMaterial.filter || disabledMaterial.shadow !== restingMaterial.shadow) {
      throw new Error(`disabled AppIcon retained hover material: ${JSON.stringify({
        restingMaterial, disabledMaterial, disabledState
      })}`);
    }
    await page.evaluate(() => { window.__qaAppIcon?.destroy(); document.querySelector('#qa-interactive-app-icon')?.remove(); });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => {
      const scrollers = [...document.querySelectorAll('.docs-api__scroller')];
      return {
        root: document.documentElement.scrollWidth - innerWidth,
        apiOverflow: scrollers.some((node) => node.scrollWidth > node.clientWidth + 1)
      };
    });
    if (mobile.root > 1 || !mobile.apiOverflow) {
      throw new Error(`mobile docs overflow root=${mobile.root}, apiScroller=${mobile.apiOverflow}`);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/website/theme.html`, { waitUntil: 'load' });
    await page.waitForSelector('.theme-global-search input');
    const themeBox = await page.locator('.theme-global-search').boundingBox();
    if (!themeBox || Math.abs(themeBox.x + themeBox.width / 2 - 720) > 2) {
      throw new Error('theme search is not centered');
    }
    await assertOverlayMaterials(page);
    if (problems.length) throw new Error(problems.slice(0, 5).join(' / '));
    console.log('PASS  documentation shell — search, mobile API tables, and computed overlay materials');
    return false;
  } catch (error) {
    console.error(`FAIL  documentation shell: ${error.message}`);
    return true;
  } finally {
    await page.close();
  }
}

/**
 * Exercises the material selector against real top-layer components. CSS-string tests cannot tell
 * whether a blur is hidden behind an effectively opaque colour, so this contract uses computed
 * alpha, filtering, reflection layers, backdrop transmission, accessibility fallbacks, and a
 * nested theme scope.
 * @param {import('playwright-core').Page} page
 * @returns {Promise<void>}
 */
async function assertOverlayMaterials(page) {
  const studioSpecimens = await page.evaluate(() => ({
    buttonCount: document.querySelectorAll('#card-buttons button').length,
    overlayAurora: document.querySelector('#card-overlays .studio-overlay-canvas')
      ?.classList.contains('zx-aurora') ?? false
  }));
  if (studioSpecimens.buttonCount < 10 || !studioSpecimens.overlayAurora) {
    throw new Error(`Theme Studio material specimens are incomplete: ${JSON.stringify(studioSpecimens)}`);
  }

  await chooseStudioRadio(page, 'Appearance', 'Dark');
  await chooseStudioRadio(page, 'Material', 'Glass');
  const dateMaterial = await sampleDateboxMaterial(page);
  if (dateMaterial.surfaceImage === 'none' || dateMaterial.childImages.some((image) => image !== 'none')) {
    throw new Error(`Datebox repaints its material on child controls: ${JSON.stringify(dateMaterial)}`);
  }

  const appearances = ['Light', 'Dark'];
  const materials = ['Flat', 'Glass', 'Deep glass'];
  const samples = {};

  for (const appearance of appearances) {
    samples[appearance] = {};
    for (const material of materials) {
      samples[appearance][material] = await sampleOverlayMaterial(page, appearance, material);
    }
  }

  for (const appearance of appearances) {
    const flat = samples[appearance].Flat;
    const glass = samples[appearance].Glass;
    const deep = samples[appearance]['Deep glass'];
    assertRange(flat.compact.alpha, .995, 1, `${appearance} Flat compact alpha`);
    assertRange(flat.panel.alpha, .995, 1, `${appearance} Flat panel alpha`);
    if (flat.compact.filter !== 'none' || flat.panel.filter !== 'none'
      || flat.compact.image !== 'none' || flat.panel.image !== 'none'
      || flat.toast.filter !== 'none' || flat.toast.image !== 'none') {
      throw new Error(`${appearance} Flat retained glass effects: ${JSON.stringify(flat)}`);
    }

    assertRange(glass.compact.alpha, .62, .80, `${appearance} Glass compact alpha`);
    assertRange(glass.panel.alpha, .74, .88, `${appearance} Glass panel alpha`);
    assertRange(deep.compact.alpha, .42, .62, `${appearance} Deep Glass compact alpha`);
    assertRange(deep.panel.alpha, .58, .76, `${appearance} Deep Glass panel alpha`);
    if (glass.compact.image === 'none' || glass.panel.image === 'none'
      || deep.compact.image === 'none' || deep.panel.image === 'none') {
      throw new Error(`${appearance} glass lost its reflection layers`);
    }
    if (deep.compact.alpha > glass.compact.alpha - .099
      || deep.panel.alpha > glass.panel.alpha - .099) {
      throw new Error(`${appearance} Deep Glass is not materially more translucent`);
    }
    if (glass.panel.alpha < glass.compact.alpha + .059
      || deep.panel.alpha < deep.compact.alpha + .059) {
      throw new Error(`${appearance} reading panels are not calmer than compact overlays`);
    }
    if (blurRadius(deep.compact.filter) < blurRadius(glass.compact.filter) + 5.9
      || blurRadius(deep.panel.filter) < blurRadius(glass.panel.filter) + 5.9) {
      throw new Error(`${appearance} Deep Glass did not increase refraction`);
    }
    assertRange(glass.backdrop.alpha, .18, .40, `${appearance} Glass backdrop alpha`);
    assertRange(deep.backdrop.alpha, .08, .28, `${appearance} Deep Glass backdrop alpha`);
    if ((1 - glass.panel.alpha) * (1 - glass.backdrop.alpha) < .10
      || (1 - deep.panel.alpha) * (1 - deep.backdrop.alpha) < .18) {
      throw new Error(`${appearance} backdrop erases the page behind its reading panel`);
    }
    if (deep.toast.alpha > .70) {
      throw new Error(`${appearance} Deep Glass toast is effectively opaque (${deep.toast.alpha})`);
    }
  }

  for (const role of ['compact', 'panel']) {
    const delta = Math.abs(samples.Light.Glass[role].alpha - samples.Dark.Glass[role].alpha);
    if (delta > .02) throw new Error(`${role} alpha changes across light/dark by ${delta}`);
  }

  const cdp = await page.context().newCDPSession(page);
  try {
    await chooseStudioRadio(page, 'Appearance', 'Dark');
    await chooseStudioRadio(page, 'Material', 'Deep glass');
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
    });
    const reduced = await sampleCompactOverlay(page);
    if (reduced.alpha < .995 || reduced.filter !== 'none' || reduced.image !== 'none') {
      throw new Error(`reduced-transparency did not restore an opaque surface: ${JSON.stringify(reduced)}`);
    }
    const reducedSheetBackdrop = await sampleBlurredSheetBackdrop(page);
    if (reducedSheetBackdrop !== 'none') {
      throw new Error(`reduced-transparency retained Sheet backdrop blur: ${reducedSheetBackdrop}`);
    }

    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }]
    });
    const forced = await sampleCompactOverlay(page);
    if (forced.filter !== 'none' || forced.image !== 'none') {
      throw new Error(`forced colours retained optical effects: ${JSON.stringify(forced)}`);
    }
    const forcedSheetBackdrop = await sampleBlurredSheetBackdrop(page);
    if (forcedSheetBackdrop !== 'none') {
      throw new Error(`forced colours retained Sheet backdrop blur: ${forcedSheetBackdrop}`);
    }

    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-contrast', value: 'more' }]
    });
    const contrastSheetBackdrop = await sampleBlurredSheetBackdrop(page);
    if (contrastSheetBackdrop !== 'none') {
      throw new Error(`increased contrast retained Sheet backdrop blur: ${contrastSheetBackdrop}`);
    }
  } finally {
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });
    await cdp.detach();
  }

  const scoped = await page.evaluate(async () => {
    const { ContextMenu, Dropdown, Launcher, Message, Modal, Sheet, Tooltip } = await import('/src/index.js');
    const scope = document.createElement('section');
    scope.className = 'zx-scope';
    scope.dataset.zxTheme = 'dark';
    scope.style.setProperty('--zx-color-overlay-surface', 'rgb(1 2 3 / 41%)');
    scope.style.setProperty('--zx-color-overlay-panel', 'rgb(4 5 6 / 43%)');
    Object.assign(scope.style, {
      position: 'fixed', left: '100px', top: '100px', width: '300px', height: '300px',
      overflow: 'hidden', transform: 'translateZ(0)'
    });
    const anchor = document.createElement('button');
    scope.append(anchor);
    document.body.append(scope);

    const dropdown = new Dropdown(anchor, { content: 'Scoped', openOn: 'manual' });
    const tooltip = new Tooltip(anchor, { content: 'Scoped', trigger: 'manual' });
    const modal = new Modal(null, { content: 'Scoped', scope });
    const sheet = new Sheet(null, { content: 'Scoped', scope });
    const nonModalSheet = new Sheet(null, {
      content: 'Scoped non-modal', scope, modal: false, side: 'end', size: 250
    });
    nonModalSheet.open();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.allSettled(nonModalSheet.el.getAnimations().map((animation) => animation.finished));
    const nonModalRect = nonModalSheet.el.getBoundingClientRect();
    const nonModalBackdrop = getComputedStyle(nonModalSheet.el, '::backdrop');
    const launcher = new Launcher(null, { items: [], scope, shortcut: false });
    const contextMenu = new ContextMenu(scope, { items: [{ label: 'Scoped' }] });
    const toast = Message.info('Scoped', { scope, timeout: 0 });
    const result = {
      dropdown: dropdown.el.parentElement === scope,
      tooltip: tooltip.el.parentElement === scope,
      modal: modal.el.parentElement === scope,
      sheet: sheet.el.parentElement === scope,
      nonModalSheet: nonModalSheet.el.parentElement === scope,
      nonModalTopLayer: nonModalSheet.el.matches(':popover-open') && !nonModalSheet.el.matches(':modal'),
      nonModalRect: {
        left: nonModalRect.left, right: nonModalRect.right,
        top: nonModalRect.top, bottom: nonModalRect.bottom,
        width: nonModalRect.width, height: nonModalRect.height,
        viewportWidth: innerWidth, viewportHeight: innerHeight
      },
      nonModalGeometry: Math.abs(nonModalRect.right - innerWidth) <= 1
        && Math.abs(nonModalRect.top) <= 1 && Math.abs(nonModalRect.bottom - innerHeight) <= 1,
      nonModalBackdrop: nonModalBackdrop.backgroundColor === 'rgba(0, 0, 0, 0)'
        && (nonModalBackdrop.backdropFilter || nonModalBackdrop.webkitBackdropFilter || 'none') === 'none',
      nonModalAria: nonModalSheet.el.getAttribute('aria-modal') === 'false',
      launcher: launcher.el.parentElement === scope,
      contextMenu: Boolean(scope.querySelector('.zx-context-menu')),
      toast: Boolean(scope.querySelector('.zx-message-region')),
      compactAlpha: colourAlpha(getComputedStyle(dropdown.el).backgroundColor),
      panelAlpha: colourAlpha(getComputedStyle(modal.el).backgroundColor)
    };
    toast.close();
    contextMenu.destroy();
    launcher.destroy();
    nonModalSheet.destroy();
    sheet.destroy();
    modal.destroy();
    tooltip.destroy();
    dropdown.destroy();
    scope.remove();
    return result;

    function colourAlpha(value) {
      const slash = value.match(/\/\s*([\d.]+)\s*\)$/);
      if (slash) return Number(slash[1]);
      const rgba = value.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
      return rgba ? Number(rgba[1]) : 1;
    }
  });
  if (Object.entries(scoped).some(([key, value]) => ![
    'compactAlpha', 'panelAlpha', 'nonModalRect'
  ].includes(key) && !value)
    || Math.abs(scoped.compactAlpha - .41) > .01 || Math.abs(scoped.panelAlpha - .43) > .01) {
    throw new Error(`top-layer components lost their nearest theme scope: ${JSON.stringify(scoped)}`);
  }
}

/** @param {import('playwright-core').Page} page @param {string} group @param {string} label */
async function chooseStudioRadio(page, group, label) {
  const radio = page.getByRole('radiogroup', { name: group })
    .getByRole('radio', { name: label, exact: true });
  if (await radio.getAttribute('aria-checked') !== 'true') await radio.click();
}

/** @param {import('playwright-core').Page} page @param {string} appearance @param {string} material */
async function sampleOverlayMaterial(page, appearance, material) {
  await chooseStudioRadio(page, 'Appearance', appearance);
  await chooseStudioRadio(page, 'Material', material);
  const compact = await sampleCompactOverlay(page);
  const card = page.locator('#card-overlays');
  await card.getByRole('button', { name: 'Modal', exact: true }).click();
  const modal = page.locator('.zx-modal[open]').first();
  await modal.waitFor();
  const scrollLock = await page.locator('body').evaluate((body) => ({
    matches: body.matches(':has(.zx-modal:modal)'),
    overflow: getComputedStyle(body).overflow
  }));
  if (!scrollLock.matches || scrollLock.overflow !== 'hidden') {
    throw new Error(`scoped modal did not lock page scrolling: ${JSON.stringify(scrollLock)}`);
  }
  const panel = await materialStyle(modal);
  const backdrop = await modal.evaluate((element) => {
    const style = getComputedStyle(element, '::backdrop');
    const colour = style.backgroundColor;
    const slash = colour.match(/\/\s*([\d.]+)\s*\)$/);
    const rgba = colour.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
    return {
      alpha: slash ? Number(slash[1]) : rgba ? Number(rgba[1]) : 1,
      colour,
      image: style.backgroundImage,
      filter: style.backdropFilter || style.webkitBackdropFilter || 'none'
    };
  });
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });

  await card.getByRole('button', { name: 'Info', exact: true }).click();
  const toastNode = page.locator('.zx-message__toast[data-state="open"]').last();
  await toastNode.waitFor();
  const toast = await materialStyle(toastNode);
  await toastNode.getByRole('button', { name: 'Close message' }).click();
  return { compact, panel, backdrop, toast };
}

/** @param {import('playwright-core').Page} page */
async function sampleCompactOverlay(page) {
  const card = page.locator('#card-overlays');
  const anchor = card.getByRole('button', { name: 'Assign to', exact: true });
  await anchor.click();
  const panel = page.locator('.zx-dropdown[data-state="open"]').first();
  await panel.waitFor();
  const material = await materialStyle(panel);
  await anchor.click();
  return material;
}

/** @param {import('playwright-core').Page} page */
async function sampleBlurredSheetBackdrop(page) {
  return page.evaluate(async () => {
    const { Sheet } = await import('/src/index.js');
    const sheet = new Sheet(null, { backdrop: 'blur', content: 'Backdrop fallback probe' });
    sheet.open();
    const style = getComputedStyle(sheet.el, '::backdrop');
    const filter = style.backdropFilter || style.webkitBackdropFilter || 'none';
    sheet.destroy();
    return filter;
  });
}

/** @param {import('playwright-core').Page} page */
async function sampleDateboxMaterial(page) {
  return page.evaluate(async () => {
    const { Datebox } = await import('/src/index.js');
    const host = document.createElement('div');
    document.body.append(host);
    const datebox = new Datebox(host, { value: new Date(2026, 7, 26) });
    datebox.open();
    const surface = host.querySelector('.zx-date-picker__surface');
    const controls = [
      host.querySelector('.zx-date-picker__nav'),
      host.querySelector('.zx-date-picker__heading'),
      host.querySelector('.zx-date-picker__day:not([aria-selected="true"])')
    ].filter(Boolean);
    const result = {
      surfaceImage: getComputedStyle(surface).backgroundImage,
      childImages: controls.map((control) => getComputedStyle(control).backgroundImage)
    };
    datebox.destroy();
    host.remove();
    return result;
  });
}

/** @param {import('playwright-core').Locator} locator */
async function materialStyle(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const colour = style.backgroundColor;
    const slash = colour.match(/\/\s*([\d.]+)\s*\)$/);
    const rgba = colour.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
    return {
      alpha: slash ? Number(slash[1]) : rgba ? Number(rgba[1]) : 1,
      colour,
      image: style.backgroundImage,
      filter: style.backdropFilter || style.webkitBackdropFilter || 'none'
    };
  });
}

/** @param {string} filter */
function blurRadius(filter) {
  return Number(filter.match(/blur\(([\d.]+)px\)/)?.[1] ?? 0);
}

/** @param {number} value @param {number} min @param {number} max @param {string} label */
function assertRange(value, min, max, label) {
  if (value < min - .001 || value > max + .001) {
    throw new Error(`${label} ${value} is outside ${min}–${max}`);
  }
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

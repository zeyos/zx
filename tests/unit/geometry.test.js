import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/*
 * Xenon has one geometry. There used to be two view modes, cozy and compact, selected with
 * `data-zx-density`; they doubled every visual check and could not express a cozy island inside a
 * compact page. These tests hold the replacement in place: no density anywhere in the library, the
 * spacing and radius scales derived from one value each, and the tighter structured menus that came
 * with them.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));

/** @param {string} path Repository-relative path. @returns {string} */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

/** @param {string} dir Repository-relative directory. @returns {string[]} Repository-relative files. */
function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
  });
}

/**
 * Declarations of the first rule whose selector list is exactly `selector`.
 * @param {string} css
 * @param {string} selector
 * @returns {string}
 */
function rule(css, selector) {
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const names = selectors.replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((part) => part.trim());
    if (names.length === 1 && names[0] === selector) return body;
  }
  assert.fail(`no rule for ${selector}`);
}

/** @param {string} body @param {string} property @returns {string|undefined} */
function value(body, property) {
  const match = new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(body);
  return match?.[1].trim();
}

test('density is gone from the library, the website, the theme editor, and the docs', () => {
  // The changelog keeps the removal notice upgraders need, and the specs are the history of how
  // the library got here; everything a reader or an application meets today is checked.
  const files = [
    ...walk('src'), ...walk('styles'),
    ...walk('website').filter((path) => !path.startsWith('website/vendor/')),
    'docs/llms.md', 'docs/llms.txt', 'docs/api.json', 'docs/DESIGN-NOTES.md',
    'README.md', 'DESIGN-SYSTEM.md', 'AGENTS.md', '.claude/skills/zx/SKILL.md'
  ].filter((path) => /\.(js|css|html|md|txt|json)$/.test(path));
  const offenders = files.filter((path) => /densit|\bcozy\b/i.test(read(path)));
  assert.deepEqual(offenders, [], 'density is still mentioned');
});

test('the stylesheet no longer imports a density file', () => {
  const zx = read('styles/zx.css');
  assert.doesNotMatch(zx, /density/i, 'styles/zx.css still mentions density');
  assert.equal(existsSync(join(root, 'styles/tokens/density.css')), false,
    'styles/tokens/density.css still ships');
});

test('no stylesheet or module in the library mentions data-zx-density', () => {
  const files = [...walk('styles'), ...walk('src')].filter((path) => /\.(css|js)$/.test(path));
  assert.ok(files.length > 100, 'the walk did not reach the component sources');
  const offenders = files.filter((path) => /data-zx-density|zxDensity/.test(read(path)));
  assert.deepEqual(offenders, [], 'density is still referenced');
});

test('spacing steps are multiples of one unit', () => {
  const global = read('styles/tokens/global.css');
  assert.match(global, /--zx-space-unit:\s*4px;/);
  const steps = [1, 2, 3, 4, 5, 6, 8, 10];
  steps.forEach((factor, index) => {
    assert.match(global,
      new RegExp(`--zx-space-${index + 1}:\\s*calc\\(var\\(--zx-space-unit\\) \\* ${factor}\\);`),
      `--zx-space-${index + 1} is not ${factor} units`);
  });
});

test('radius steps are fractions of one base', () => {
  const global = read('styles/tokens/global.css');
  assert.match(global, /--zx-radius:\s*4px;/);
  assert.match(global, /--zx-radius-sm:\s*calc\(var\(--zx-radius\) \* \.5\);/);
  assert.match(global, /--zx-radius-md:\s*calc\(var\(--zx-radius\) \* \.75\);/);
  assert.match(global, /--zx-radius-lg:\s*var\(--zx-radius\);/);
  assert.match(global, /--zx-radius-xl:\s*calc\(var\(--zx-radius\) \* 1\.5\);/);

  const semantic = read('styles/tokens/semantic.css');
  assert.match(semantic, /--zx-control-height:\s*30px;/);
  assert.match(semantic, /--zx-control-pad-x:\s*10px;/);
  assert.match(semantic, /--zx-control-radius:\s*var\(--zx-radius-lg\);/);
});

test('the overlay scope follows theme and preset scopes only', () => {
  const host = read('src/core/overlay-host.js');
  assert.match(host, /SCOPE_SELECTOR = '\.zx-scope, \[data-zx-theme\], \[data-zx-preset\]'/);
});

test('AppSidebar rows are one control tall, close together, and start children under the label', () => {
  const css = read('src/components/app-sidebar/app-sidebar.css');
  const scale = rule(css, '.zx-app-sidebar');
  assert.equal(value(scale, '--zx-app-sidebar-item-height'), 'var(--zx-control-height)');
  assert.equal(value(scale, '--zx-app-sidebar-row-gap'), '2px');
  assert.equal(value(scale, '--zx-app-sidebar-group-gap'), 'var(--zx-space-3)');
  assert.equal(value(scale, '--zx-app-sidebar-radius'), 'var(--zx-radius-md)');

  // A child's indent is the parent list's icon column (or a short text step when it has none),
  // so it starts where the parent's label starts.
  const parent = rule(css, '.zx-app-sidebar__row[data-level="1"]');
  assert.match(value(parent, '--zx-app-sidebar-step-1'),
    /var\(--zx-app-sidebar-icon\) \+ var\(--zx-app-sidebar-item-gap\)/);
  assert.match(css, /\[data-level="2"\] > \.zx-app-sidebar__item \{ padding-inline-start: calc\(var\(--zx-app-sidebar-pad-x\) \+ var\(--zx-app-sidebar-step-1\)\); \}/);

  // The rail flyout re-declares the same scale.
  const flyout = rule(read('src/components/app-rail/app-rail.css'), '.zx-app-rail__popover');
  assert.equal(value(flyout, '--zx-app-rail-item-height'), 'var(--zx-control-height)');
  assert.equal(value(flyout, '--zx-app-rail-row-gap'), '2px');
  assert.equal(value(flyout, '--zx-app-rail-radius'), 'var(--zx-radius-md)');
});

test('TreeView indents one short step per level', () => {
  const css = read('src/components/tree/tree.css');
  assert.equal(value(rule(css, '.zx-tree'), '--zx-tree-indent'), 'var(--zx-space-3)');
  const row = rule(css, '.zx-tree__row');
  assert.equal(value(row, 'padding'), 'var(--zx-space-1) var(--zx-space-2)');
});

test('menus and listboxes share one tight row inside a large-radius panel', () => {
  const rows = [
    ['menu-button/menu-button.css', '.zx-menu-button__item'],
    ['context-menu/context-menu.css', '.zx-context-menu__item'],
    ['select/select.css', '.zx-select__option'],
    ['tag-picker/tag-picker.css', '.zx-tag-picker__option'],
    ['finder/finder.css', '.zx-finder__row']
  ];
  for (const [path, selector] of rows) {
    const body = rule(read(`src/components/${path}`), selector);
    assert.equal(value(body, 'padding'), 'var(--zx-space-1) var(--zx-space-2)', `${selector} padding`);
    assert.equal(value(body, 'border-radius'), 'var(--zx-radius-sm)', `${selector} radius`);
  }
  for (const [path, selector] of [
    ['dropdown/dropdown.css', '.zx-dropdown'],
    ['select/select.css', '.zx-select__panel'],
    ['tag-picker/tag-picker.css', '.zx-tag-picker__panel'],
    ['launcher/launcher.css', '.zx-launcher']
  ]) {
    assert.equal(value(rule(read(`src/components/${path}`), selector), 'border-radius'),
      'var(--zx-radius-lg)', `${selector} panel radius`);
  }
  for (const [path, selector] of [
    ['menu-button/menu-button.css', '.zx-menu-button__heading'],
    ['context-menu/context-menu.css', '.zx-context-menu__heading']
  ]) {
    assert.equal(value(rule(read(`src/components/${path}`), selector), 'padding'),
      'var(--zx-space-1) var(--zx-space-2)', `${selector} is taller than an item`);
  }
});

test('ModuleBar targets and tiles follow the control height, and a named column has a width of its own', () => {
  const css = read('src/components/module-bar/module-bar.css');
  const scale = rule(css, '.zx-module-bar');
  assert.equal(value(scale, '--zx-module-bar-target'), 'calc(var(--zx-control-height) + var(--zx-space-2))');
  assert.equal(value(scale, '--zx-module-bar-tile'), 'calc(var(--zx-control-height) - var(--zx-space-1))');
  assert.equal(value(scale, '--zx-module-bar-column'), '12rem');
  const item = rule(css, '.zx-module-bar__item');
  assert.equal(value(item, 'inline-size'), 'var(--zx-module-bar-target)');
  assert.equal(value(item, 'block-size'), 'var(--zx-module-bar-target)');
  assert.equal(value(rule(css, '.zx-module-bar__tile'), 'inline-size'), 'var(--zx-module-bar-tile)');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/*
 * The finish of menus, listboxes, the launcher and chips is a handful of declarations that are
 * easy to undo by accident: a state that disappears under the pointer, a keycap drawn twice, a
 * chip that grows a border again. `node --test` has no layout engine, so these read the
 * stylesheets and the one module that draws key hints.
 */
const read = (path) => readFileSync(new URL(`../../src/components/${path}`, import.meta.url), 'utf8');

/**
 * Splits a selector list on its top-level commas, so `:is(a, b)` stays one selector.
 * @param {string} list
 * @returns {string[]}
 */
function selectorsOf(list) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < list.length; index += 1) {
    if (list[index] === '(') depth += 1;
    else if (list[index] === ')') depth -= 1;
    else if (list[index] === ',' && depth === 0) {
      parts.push(list.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(list.slice(start));
  return parts.map((part) => part.trim());
}

/**
 * The declarations of every rule that names `selector` in its own selector list, in source order.
 * @param {string} css
 * @param {string} selector
 * @returns {string}
 */
function rule(css, selector) {
  const bodies = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectorsOf(selectors.replace(/\/\*[\s\S]*?\*\//g, '')).includes(selector)) bodies.push(body);
  }
  if (!bodies.length) assert.fail(`no rule for ${selector}`);
  return bodies.join(';\n');
}

/** @param {string} body @param {string} property @returns {string|undefined} */
function value(body, property) {
  return new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(body)?.[1].trim();
}

test('a chosen option under the cursor or the pointer keeps its pick and gains a step', () => {
  const css = read('select/select.css');
  const picked = rule(css, '.zx-select__option[aria-selected="true"]');
  assert.equal(value(picked, 'background'), 'var(--zx-color-overlay-selected)');
  for (const selector of [
    '.zx-select__option[aria-selected="true"][data-active="true"]',
    '.zx-select__option[aria-selected="true"]:hover'
  ]) {
    assert.match(value(rule(css, selector), 'background'),
      /^color-mix\(in srgb, var\(--zx-color-accent\) 26%, transparent\)$/, selector);
  }
});

test('the launcher row you are in stays neutral and one step stronger under the cursor', () => {
  const css = read('launcher/launcher.css');
  for (const selector of [
    '.zx-launcher__option[aria-current="page"][aria-selected="true"]',
    '.zx-launcher__option[aria-current="page"]:hover',
    '.zx-launcher__option[data-kind="application"][aria-current="page"][aria-selected="true"]',
    '.zx-launcher__option[data-kind="application"][aria-current="page"]:hover'
  ]) {
    const fill = value(rule(css, selector), 'background');
    assert.match(fill, /^color-mix\(in srgb, var\(--zx-color-text\) 14%, transparent\)$/, selector);
  }
});

test('the launcher draws every key hint with kbd(), and keeps no keycap styling of its own', () => {
  const css = read('launcher/launcher.css');
  const js = read('launcher/launcher.js');
  assert.match(js, /import \{ kbd \} from '\.\.\/kbd\/kbd\.js'/);
  assert.doesNotMatch(js, /h\('kbd'/, 'a hint is built by hand');
  assert.doesNotMatch(js, /zx-launcher__key['"]/, 'the local keycap class is back');
  assert.doesNotMatch(css, /zx-launcher__key\b|zx-launcher__hints kbd/, 'the local keycap rules are back');
  assert.doesNotMatch(css, /font-family:\s*var\(--zx-font-mono\)/);
});

test('menu and listbox shortcuts are text set the way a keycap label is', () => {
  for (const [path, selector] of [
    ['menu-button/menu-button.css', '.zx-menu-button__shortcut'],
    ['context-menu/context-menu.css', '.zx-context-menu__shortcut'],
    ['select/select.css', '.zx-select__status-shortcut']
  ]) {
    const body = rule(read(path), selector);
    assert.equal(value(body, 'font-family'), 'var(--zx-font-sans)', `${selector} family`);
    assert.equal(value(body, 'font-weight'), 'var(--zx-weight-medium)', `${selector} weight`);
    assert.equal(value(body, 'font-feature-settings'), '"case", "tnum"', `${selector} features`);
  }
});

test('counts and badges use tabular figures', () => {
  for (const [path, selector] of [
    ['menu-button/menu-button.css', '.zx-menu-button__badge'],
    ['context-menu/context-menu.css', '.zx-context-menu__badge'],
    ['launcher/launcher.css', '.zx-launcher__badge']
  ]) {
    assert.equal(value(rule(read(path), selector), 'font-variant-numeric'), 'tabular-nums', selector);
  }
});

test('a chip is one fill: its edge is kept for size and drawn only in forced colours', () => {
  for (const [path, selector] of [
    ['tag-picker/tag-picker.css', '.zx-tag-picker__tag'],
    ['value-list/value-list.css', '.zx-value-list__chip'],
    ['entity-ref/entity-ref.css', '.zx-entity-ref__icon']
  ]) {
    assert.equal(value(rule(read(path), selector), 'border'), '1px solid transparent', selector);
  }
  const tags = read('tag-picker/tag-picker.css');
  assert.doesNotMatch(rule(tags, '.zx-tag-picker__tag[data-colored="true"]'), /border/, 'a coloured tag draws a line again');
  assert.match(tags, /@media \(forced-colors: active\)\s*\{\s*\.zx-tag-picker__tag\s*\{\s*border-color: CanvasText;/);
  assert.match(read('value-list/value-list.css'),
    /@media \(forced-colors: active\)\s*\{\s*\.zx-value-list__chip\s*\{\s*border-color: CanvasText;/);
});

test('a remove button is held inside its chip so its hover fill never reaches the chip edge', () => {
  const tag = rule(read('tag-picker/tag-picker.css'), '.zx-tag-picker .zx-tag-picker__remove');
  assert.equal(value(tag, 'align-self'), 'stretch');
  assert.equal(value(tag, 'margin-block'), '1px');
  assert.ok(value(tag, 'margin-inline-end'), 'no inline inset');
  const list = rule(read('value-list/value-list.css'), '.zx-value-list__remove');
  assert.equal(value(list, 'align-self'), 'stretch');
  assert.equal(value(list, 'margin-block'), '1px');
});

test('the neutral status glyph reads as text-subtle, and its fill never sits under its ring', () => {
  const css = read('select/select.css');
  assert.match(css, /\.zx-status-icon\[data-tone="neutral"\] \{ color: var\(--zx-color-text-subtle\); \}/);
  assert.match(css, /\.zx-status-icon:is\([^)]*\[data-indicator="review"\][^)]*\) \{\s*background-clip: padding-box;/);
});

test('a segmented track is concentric with its thumb', () => {
  const track = rule(read('menu-button/menu-button.css'), '.zx-menu-button__choice-options');
  assert.equal(value(track, 'border-radius'), 'calc(var(--zx-radius-sm) + 2px)');
  assert.equal(value(track, 'padding'), '2px');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Component } from '../../src/core/component.js';
import {
  countLineText, ListToolbar, normalizeToolBadge, normalizeTools, normalizeViewList,
  recordViewCapabilities, resolveView, toolAccessibleName
} from '../../src/components/list-toolbar/list-toolbar.js';

/*
 * `tests/unit/` runs in Node with no DOM, so everything the component decides before it touches an
 * element is a module-level function this can call directly. The three properties the spec calls
 * the point of the component are checked here: the badge inside the accessible name, an empty
 * count line for `null`, and the 44 px target, which lives in the stylesheet and is read from it.
 */
const source = readFileSync(new URL('../../src/components/list-toolbar/list-toolbar.js',
  import.meta.url), 'utf8');
const css = readFileSync(new URL('../../src/components/list-toolbar/list-toolbar.css',
  import.meta.url), 'utf8');

/**
 * The body of one method, so an assertion about what it writes to the DOM names the method it
 * belongs to instead of scanning the whole file.
 * @param {string} signature First line of the method.
 * @returns {string}
 */
function methodSource(signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is no longer in list-toolbar.js`);
  const end = source.indexOf('\n  }', start);
  return source.slice(start, end);
}

/**
 * Innermost style rules, the way `tests/unit/size-containers.test.js` reads them: `@container` and
 * `@media` wrappers contain braces of their own and so never match as a body.
 * @param {(selector: string) => boolean} matches Selector predicate.
 * @returns {Array<{selector: string, declarations: string}>}
 */
function rules(matches) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, declarations]) => ({ selector: selector.trim().replace(/\s+/g, ' '), declarations }))
    .filter(({ selector }) => matches(selector));
}

/* ------------------------------------------------- the badge is part of the name -- */

test('a tool badge is composed into the accessible name, not left beside it', () => {
  assert.equal(toolAccessibleName('Filters', '2'), 'Filters (2)');
  assert.equal(toolAccessibleName('Columns', '5/6'), 'Columns (5/6)');
  assert.equal(toolAccessibleName('Filters', null), 'Filters');
  assert.equal(toolAccessibleName('Filters', ''), 'Filters');
  // A translated template may put the count anywhere, including in front of the label.
  assert.equal(toolAccessibleName('Filter', '2', '%2 %1'), '2 Filter');
});

test('a badge of zero is a value, and only the absent ones are dropped', () => {
  assert.equal(normalizeToolBadge(0), '0');
  assert.equal(normalizeToolBadge(2), '2');
  assert.equal(normalizeToolBadge('5/6'), '5/6');
  assert.equal(normalizeToolBadge(null), null);
  assert.equal(normalizeToolBadge(undefined), null);
  assert.equal(normalizeToolBadge(false), null);
  assert.equal(normalizeToolBadge(''), null);
  assert.equal(toolAccessibleName('Filters', normalizeToolBadge(0)), 'Filters (0)');
});

test('the rendered badge is hidden from assistive technology and the name carries the number', () => {
  const body = methodSource('  _syncTool(record) {');
  assert.match(body, /setAttribute\('aria-hidden', 'true'\)/,
    'the badge element must not be announced a second time beside the name it is already in');
  assert.match(body, /toolAccessibleName\(/);
  assert.match(body, /setAttribute\('aria-label', name\)/,
    'the composed name belongs on the button, so the badge is read as part of the control');
});

/* -------------------------------------------------------------- the count line -- */

test('setCount(null) clears the line rather than leaving a number describing old filters', () => {
  const format = (value) => `${value} results`;
  assert.equal(countLineText(null, format), '');
  assert.equal(countLineText(undefined, format), '');
  assert.equal(countLineText('', format), '');
  assert.equal(countLineText(Number.NaN, format), '');
  assert.equal(countLineText(true, format), '', 'a boolean is not a count');
});

test('a real count is formatted, and no rows is a count like any other', () => {
  const format = (value) => `${value} results`;
  assert.equal(countLineText(20, format), '20 results');
  assert.equal(countLineText(0, format), '0 results');
  assert.equal(countLineText('12', format), '12 results');
});

test('the count line is a live region that exists before the text does', () => {
  const body = methodSource('  render() {');
  assert.match(body, /class: 'zx-list-toolbar__count'/);
  assert.match(body, /ariaLive: 'polite'/,
    'a count that changes under the reader has to be announced');
  assert.match(body, /role: 'status'/);
  assert.doesNotMatch(methodSource('  setCount(count) {'), /hidden|display/,
    'clearing the line must not take the region out of the accessibility tree');
  assert.match(methodSource('  setCount(count) {'), /textContent = countLineText\(/);
  assert.equal(rules((selector) => selector.includes('zx-list-toolbar__count'))
    .some(({ declarations }) => /display\s*:\s*none/.test(declarations)), false,
    'a live region that was display:none does not reliably announce when it comes back');
});

/* ------------------------------------------------------------- the 44 px target -- */

test('tool and view targets are 44 px in both axes', () => {
  for (const selector of ['.zx-list-toolbar__tool', '.zx-list-toolbar__view']) {
    const declarations = rules((one) => one.split(',').map((part) => part.trim()).includes(selector))
      .map(({ declarations: body }) => body).join(';');
    assert.notEqual(declarations, '', `${selector} has no rule of its own`);
    assert.match(declarations, /min-block-size:\s*44px/, `${selector} is shorter than 44px`);
    assert.match(declarations, /min-inline-size:\s*44px/, `${selector} is narrower than 44px`);
  }
});

test('nothing later in the stylesheet shrinks a target below 44 px', () => {
  const targets = rules((selector) => /zx-list-toolbar__(tool|view)\b/.test(selector));
  const sizes = targets.flatMap(({ selector, declarations }) =>
    [...declarations.matchAll(/min-(?:block|inline)-size:\s*([^;]+)/g)]
      .map((match) => `${selector} → ${match[1].trim()}`));
  assert.deepEqual(sizes.filter((entry) => !entry.endsWith('44px')), [],
    'density tightens a layout; it does not make a finger smaller');
});

/* ------------------------------------------------------------ the shape switch -- */

test('view entries normalize from plain names and from descriptors', () => {
  assert.deepEqual(normalizeViewList(['auto', 'cards', 'table']),
    [{ id: 'auto' }, { id: 'cards' }, { id: 'table' }]);
  assert.deepEqual(normalizeViewList([{ id: 'cards', label: 'Karten', icon: 'square' }]),
    [{ id: 'cards', label: 'Karten', icon: 'square' }]);
  assert.deepEqual(normalizeViewList(['cards', 'cards', null, '', { id: ' table ' }]),
    [{ id: 'cards' }, { id: 'table' }], 'duplicates and empty entries are dropped, not rendered');
  assert.deepEqual(normalizeViewList([]), []);
  assert.deepEqual(normalizeViewList(undefined), []);
  assert.throws(() => normalizeViewList('cards'), TypeError);
});

test('the switch only ever reports a shape it was configured with', () => {
  const views = normalizeViewList(['auto', 'cards', 'table']);
  assert.equal(resolveView(views, null, null), 'auto', 'no initial shape takes the first entry');
  assert.equal(resolveView(views, 'table', null), 'table');
  assert.equal(resolveView(views, 'cards', 'table'), 'cards');
  assert.equal(resolveView(views, 'kanban', 'table'), 'table',
    'a shape the host cannot render leaves the current one alone');
  assert.equal(resolveView(views, undefined, 'cards'), 'cards');
  assert.equal(resolveView(views, 'kanban', null), 'auto');
  assert.equal(resolveView(views, 'cards', 'kanban'), 'cards');
  assert.equal(resolveView([], 'cards', null), null, 'no switch, no shape');
});

/* ------------------------------------------------------------------- the tools -- */

test('tool descriptors are copied, identified, and given a normalized badge', () => {
  const onclick = () => {};
  const [columns, filters] = normalizeTools([
    { id: 'columns', label: 'Columns', icon: 'fields', badge: '5/6', onclick },
    { id: 'filters', label: 'Filters', badge: 2, pressed: true }
  ]);
  assert.equal(columns.badge, '5/6');
  assert.equal(columns.onclick, onclick);
  assert.equal(columns.pressed, null, 'a tool without a pressed state is a plain button');
  assert.equal(columns.badgeKind, 'accent');
  assert.equal(filters.pressed, true);
  assert.equal(filters.icon, null);
  assert.equal(filters.title, null);
});

test('a pressed state of false is still a toggle, and an absent one is not', () => {
  const [toggle] = normalizeTools([{ id: 'filters', pressed: false }]);
  assert.equal(toggle.pressed, false);
  const [plain] = normalizeTools([{ id: 'refresh' }]);
  assert.equal(plain.pressed, null);
});

test('tools need an id, and no two may share one', () => {
  assert.deepEqual(normalizeTools([]), []);
  assert.deepEqual(normalizeTools(undefined), []);
  assert.deepEqual(normalizeTools([null, undefined]), []);
  assert.throws(() => normalizeTools([{ label: 'Filters' }]), /needs an id/);
  assert.throws(() => normalizeTools([{ id: 'a' }, { id: 'a' }]), /Duplicate/);
  assert.throws(() => normalizeTools({ id: 'a' }), TypeError);
  assert.throws(() => normalizeTools(['filters']), TypeError);
});

test('descriptors are copied, so a host may keep and reuse its own list', () => {
  const descriptor = { id: 'filters', label: 'Filters' };
  const [copy] = normalizeTools([descriptor]);
  copy.label = 'Changed';
  assert.equal(descriptor.label, 'Filters');
});

/* -------------------------------------------------------------------- bind() -- */

test('bind() recognises a record view by its state surface, not by its class', () => {
  const view = { setViewState() {}, getViewState() {}, on() {}, emit() {}, toElement() {} };
  const capabilities = recordViewCapabilities(view);
  assert.equal(capabilities.isRecordView, true);
  assert.equal(capabilities.events, true);
  // Neither TableView nor CardView offers a shape switch today; the toolbar still emits
  // `viewchange` and the host swaps the view itself.
  assert.equal(capabilities.setShape, null);
  assert.equal(capabilities.getShape, null);
  assert.equal(capabilities.fieldControls, false);
});

test('each capability is detected on its own, so a view that grows one is wired that day', () => {
  const capabilities = recordViewCapabilities({
    setViewState() {}, getViewState() {}, on() {}, emit() {}, toElement() {},
    setView() {}, getView() {}, getFieldControls() {}
  });
  assert.deepEqual(capabilities, {
    isRecordView: true, setShape: 'setView', getShape: 'getView',
    events: true, fieldControls: true
  });
  assert.equal(recordViewCapabilities({ setViewShape() {} }).setShape, 'setViewShape');
});

test('an object that is not a view reports nothing rather than throwing', () => {
  for (const candidate of [null, undefined, {}, 'view', 42]) {
    assert.deepEqual(recordViewCapabilities(candidate), {
      isRecordView: false, setShape: null, getShape: null, events: false, fieldControls: false
    });
  }
});

test('the toolbar imports no view, so binding one is sugar rather than a dependency', () => {
  assert.doesNotMatch(source, /import[^;]*(table-view|card-view|record-view)/,
    'bind() is feature-detected precisely so this component does not depend on the views');
  assert.match(source, /import \{ Search \}/, 'the search field is composed, not reimplemented');
  assert.match(source, /import \{ badge \}/, 'the badge is composed, not reimplemented');
});

/* --------------------------------------------------------------- the component -- */

test('ListToolbar is a Component with the documented option defaults', () => {
  assert.equal(ListToolbar.prototype instanceof Component, true);
  assert.equal(ListToolbar.cssName, 'list-toolbar');
  assert.deepEqual(ListToolbar.defaults, {
    search: {}, count: null, countText: null, views: [], view: null, tools: [], label: null
  });
});

test('the public surface a host is documented to call exists', () => {
  for (const method of ['setCount', 'getCount', 'setBadge', 'setPressed', 'setToolDisabled',
    'setTools', 'getTool', 'getToolsElement', 'addTool', 'setView', 'getView', 'getSearch',
    'setSearch', 'focusSearch', 'bind', 'unbind', 'destroy']) {
    assert.equal(typeof ListToolbar.prototype[method], 'function', `${method}() is missing`);
  }
});

test('every user-visible string goes through the message layer', () => {
  const literals = [...source.matchAll(/_message\('([^']+)', '([^']*)'/g)];
  assert.deepEqual(literals.map(([, key]) => key).sort(), [
    'listToolbar.label', 'listToolbar.results', 'listToolbar.search', 'listToolbar.toolBadge',
    'listToolbar.views'
  ], 'the view preset words are resolved through VIEW_PRESETS keys, the rest are named here');
  for (const [, key] of literals) assert.match(key, /^listToolbar\./);
  assert.match(source, /key: 'listToolbar\.viewAuto'/);
});

test('destroy() puts back what the toolbar borrowed before its own root goes away', () => {
  const body = methodSource('  destroy() {');
  assert.match(body, /this\.unbind\(\)/);
  assert.match(body, /restorePosition\(entry, this\.el\)/);
  assert.ok(body.indexOf('restorePosition') < body.indexOf('super.destroy()'),
    'an adopted control has to leave before the root it was moved into is removed');
  assert.match(body, /restoreTarget\(root, this\._snapshot\)/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  ModuleBar, fitModules, moduleOf, partitionModules, resolveModuleColor
} from '../../src/components/module-bar/module-bar.js';

const ids = (items) => items.map((item) => item.id);
const modules = (count, extra = {}) => Array.from({ length: count }, (_, index) => ({
  id: `m${index + 1}`, label: `Module ${index + 1}`, ...(extra[index] ?? {})
}));

test('partitionModules shows every module when they fit and nothing is pinned', () => {
  const result = partitionModules(modules(4), 10);
  assert.deepEqual(ids(result.visible), ['m1', 'm2', 'm3', 'm4']);
  assert.deepEqual(result.overflow, []);
  assert.equal(result.more, false);
  // No capacity means no limit.
  assert.equal(partitionModules(modules(30)).visible.length, 30);
});

test('partitionModules gives one slot to "All modules" when the bar overflows', () => {
  const result = partitionModules(modules(6), 4);
  assert.deepEqual(ids(result.visible), ['m1', 'm2', 'm3']);
  assert.deepEqual(ids(result.overflow), ['m4', 'm5', 'm6']);
  assert.equal(result.more, true);
});

test('partitionModules keeps the current module on the bar, displacing the last one', () => {
  const result = partitionModules(modules(6), 4, ['m6']);
  assert.deepEqual(ids(result.visible), ['m1', 'm2', 'm6']);
  assert.deepEqual(ids(result.overflow), ['m3', 'm4', 'm5']);
  // Two kept modules, and nulls ignored.
  const both = partitionModules(modules(6), 4, ['m5', null, 'm6', undefined]);
  assert.deepEqual(ids(both.visible), ['m1', 'm5', 'm6']);
});

test('partitionModules orders pinned modules first and keeps unpinned ones in the catalogue', () => {
  const items = modules(5, { 1: { pinned: 2 }, 3: { pinned: 1 }, 4: { pinned: true } });
  const result = partitionModules(items, Infinity);
  assert.deepEqual(ids(result.visible), ['m4', 'm2', 'm5']);
  assert.deepEqual(ids(result.overflow), ['m1', 'm3']);
  assert.equal(result.more, true);
  // A kept unpinned module joins the bar, after the pinned ones.
  assert.deepEqual(ids(partitionModules(items, Infinity, 'm3').visible), ['m4', 'm2', 'm5', 'm3']);
});

test('partitionModules tolerates junk and never returns a module twice', () => {
  assert.deepEqual(partitionModules(null), { visible: [], overflow: [], more: false });
  const result = partitionModules([{ id: 'a', label: 'A' }, null, { label: 'no id' }], 1, ['a', 'a']);
  assert.deepEqual(ids(result.visible), ['a']);
  assert.equal(result.overflow.length, 0);
});

test('resolveModuleColor prefers a valid colour, then a known tone, and rejects the rest', () => {
  assert.deepEqual(resolveModuleColor({ color: '#bc3885', tone: 'blue' }), { tone: null, color: '#bc3885' });
  assert.deepEqual(resolveModuleColor({ tone: 'teal' }), { tone: 'teal', color: null });
  assert.deepEqual(resolveModuleColor({ tone: 'chartreuse' }), { tone: null, color: null });
  // A custom property, a declaration break, or an image is not a colour.
  for (const color of ['var(--x)', 'red; background: url(x)', 'url(x)', '']) {
    assert.deepEqual(resolveModuleColor({ color, tone: 'red' }), { tone: 'red', color: null }, color);
  }
  assert.deepEqual(resolveModuleColor(null), { tone: null, color: null });
});

test('moduleOf finds the module that is, or contains, a destination', () => {
  const items = [
    { id: 'crm', label: 'CRM', children: [{ id: 'records', label: 'Records', children: [{ id: 'companies', label: 'Companies' }] }] },
    { id: 'mail', label: 'Mail' }
  ];
  assert.equal(moduleOf(items, 'companies')?.id, 'crm');
  assert.equal(moduleOf(items, 'mail')?.id, 'mail');
  assert.equal(moduleOf(items, 'nowhere'), null);
  assert.equal(moduleOf(items, null), null);
});

test('ModuleBar defaults: tint, flyout menus, one catalogue when needed', () => {
  assert.equal(ModuleBar.defaults.appearance, 'tint');
  assert.equal(ModuleBar.defaults.menus, 'flyout');
  assert.equal(ModuleBar.defaults.allModules, 'auto');
  assert.equal(ModuleBar.defaults.labels, 'hidden');
  assert.equal(ModuleBar.partBlock, 'zx-module-bar');
});

test('ModuleBar geometry follows the control height and keeps colour out of the stylesheet', () => {
  const css = readFileSync(fileURLToPath(new URL(
    '../../src/components/module-bar/module-bar.css', import.meta.url)), 'utf8');
  assert.match(css, /--zx-module-bar-target: calc\(var\(--zx-control-height\) \+ var\(--zx-space-2\)\)/);
  assert.match(css, /--zx-module-bar-tile: calc\(var\(--zx-control-height\) - var\(--zx-space-1\)\)/);
  // Every tone has its tint pair, and a host colour only enters through the custom property.
  for (const tone of ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate']) {
    assert.match(css, new RegExp(`\\[data-tone="${tone}"\\] \\{ --zx-module-bar-fill: var\\(--zx-color-tone-${tone}-bg\\); --zx-module-bar-ink: var\\(--zx-color-tone-${tone}-fg\\); \\}`));
  }
  assert.match(css, /color-mix\(in srgb, var\(--zx-module-bar-color\) 16%, var\(--zx-color-bg-surface\)\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  // Current is the neutral fill, never the accent.
  assert.match(css, /\[aria-current\][^{]*\{\s*background: var\(--zx-color-bg-current\)/);
});

test('partitionModules keeps a slot for an always-shown button even when every module fits', () => {
  const result = partitionModules(modules(5), 5, [], true);
  assert.deepEqual(ids(result.visible), ['m1', 'm2', 'm3', 'm4']);
  assert.deepEqual(ids(result.overflow), ['m5']);
  assert.equal(result.more, true);
  // With room to spare nothing moves, and the button still has its slot.
  assert.equal(partitionModules(modules(3), 10, [], true).visible.length, 3);
});

/*
 * fitModules() lays the measured rows out along the bar. A measured list is written here as rows in
 * bar order, `[id, size, section]`, with a heading before the first row of each section and the
 * "All modules" button last, as `_afterRebuild()` and `_buildCatalogue()` build the list.
 */
const GAP = 4;
const HEADING = 30;
const BUTTON = 38;
const measured = (room, rows) => {
  const entries = [];
  let section = null;
  for (const [id, size = 38, label = null] of rows) {
    if (label !== null && label !== section) entries.push({ heading: true, size: HEADING });
    section = label;
    entries.push({ id, size });
  }
  entries.push({ more: true, size: BUTTON });
  return { room, gap: GAP, entries };
};
/** What the list really takes: shown rows, the headings over them, the button, and the gaps. */
const taken = (space, visible, more) => {
  const ids = new Set(visible.map((item) => item.id));
  const shown = [];
  space.entries.forEach((entry, index) => {
    if (entry.more) {
      if (more) shown.push(entry);
    } else if (entry.heading) {
      const next = space.entries.slice(index + 1);
      const run = next.slice(0, next.findIndex((other) => other.heading || other.more));
      if (run.some((other) => ids.has(other.id))) shown.push(entry);
    } else if (ids.has(entry.id)) shown.push(entry);
  });
  return shown.reduce((sum, entry) => sum + entry.size, 0) + Math.max(0, shown.length - 1) * space.gap;
};
/** The application sidebar of the report: 18 pinned modules, and 7 unpinned in three more sections. */
const sidebar = ({ long = null } = {}) => {
  const items = [];
  const rows = [];
  const add = (id, section, pinned, size = 38) => {
    items.push({ id, label: id, pinned });
    rows.push([id, size, section]);
  };
  for (const id of ['dashboard', 'search', 'tasks', 'automations']) add(id, null, true);
  for (let index = 0; index < 13; index += 1) add(`c${index}`, 'Collections', true, index === long ? 44 : 38);
  add('agents', 'Agents', true);
  for (const [section, ids] of [['Administration', ['settings', 'packages', 'subscription']],
    ['Workspace', ['spaces', 'schema', 'library']], ['AI', ['ambient']]]) {
    for (const id of ids) add(id, section, false);
  }
  return { items, rows };
};

test('fitModules charges nothing for modules only the catalogue offers, nor for their headings', () => {
  const { items, rows } = sidebar();
  // 18 rows, two headings, the button, and 20 gaps: 862px. The unpinned rows and their three
  // headings are in the list too, and would cost 7 rows and 3 headings if they were counted.
  const result = fitModules(items, measured(862, rows), [], true);
  assert.equal(result.visible.length, 18);
  assert.ok(result.visible.every((item) => item.pinned === true));
  assert.equal(result.more, true);
  assert.deepEqual(ids(result.overflow), ['settings', 'packages', 'subscription', 'spaces', 'schema', 'library', 'ambient']);
});

test('fitModules charges a two-line name its own height, not every row the tallest', () => {
  const { items, rows } = sidebar({ long: 9 });
  assert.equal(fitModules(items, measured(868, rows), [], true).visible.length, 18, 'six pixels more fit the long row');
  // One pixel short, the last module goes, and its section heading with it.
  const short = fitModules(items, measured(867, rows), [], true);
  assert.equal(short.visible.length, 17);
  assert.ok(short.overflow.some((item) => item.id === 'agents'));
});

test('fitModules charges a heading only once a module of its section is on the bar', () => {
  // Four rows and the button take 206px. A section's heading, and its row, only take room together.
  const items = modules(6);
  const rows = items.map((item, index) => [item.id, 38, index < 4 ? null : 'Later']);
  const fit = (room) => ids(fitModules(items, measured(room, rows), [], true).visible);
  assert.deepEqual(fit(206), ['m1', 'm2', 'm3', 'm4']);
  assert.deepEqual(fit(206 + GAP + 38 + GAP + HEADING - 1), ['m1', 'm2', 'm3', 'm4']);
  assert.deepEqual(fit(206 + GAP + 38 + GAP + HEADING), ['m1', 'm2', 'm3', 'm4', 'm5']);
});

test('fitModules lets the last module give way to the button when it is the taller row', () => {
  // Nothing pinned: five modules take 218px without the button; four and the button take 206px.
  const items = modules(5);
  const rows = items.map((item, index) => [item.id, index === 4 ? 50 : 38]);
  assert.equal(fitModules(items, measured(218, rows)).more, false);
  const result = fitModules(items, measured(210, rows));
  assert.deepEqual(ids(result.visible), ['m1', 'm2', 'm3', 'm4']);
  assert.equal(result.more, true);
  // An always-shown button needs its slot even where every module would fit without it.
  const three = modules(3);
  const reserved = fitModules(three, measured(122, three.map((item) => [item.id])), [], true);
  assert.deepEqual(ids(reserved.visible), ['m1', 'm2']);
  assert.deepEqual(ids(fitModules(three, measured(122, three.map((item) => [item.id]))).visible), ['m1', 'm2', 'm3']);
});

test('fitModules keeps a module from another section, with its heading, and never cuts a row', () => {
  const items = [...modules(6, Object.fromEntries(Array.from({ length: 6 }, (_, index) => [index, { pinned: true }]))),
    { id: 'x1', label: 'Settings' }];
  const rows = [...items.slice(0, 6).map((item) => [item.id]), ['x1', 38, 'Administration']];
  // Four pinned rows, the heading, the kept row, and the button: 282px.
  assert.deepEqual(ids(fitModules(items, measured(282, rows), 'x1').visible), ['m1', 'm2', 'm3', 'm4', 'x1']);
  assert.deepEqual(ids(fitModules(items, measured(281, rows), 'x1').visible), ['m1', 'm2', 'm3', 'x1']);
  // With no room at all the kept module still stays, as with partitionModules().
  assert.deepEqual(ids(fitModules(items, measured(10, rows), 'x1').visible), ['x1']);

  // At every length, what is placed fits, and one more module would not.
  const { items: report, rows: reportRows } = sidebar({ long: 2 });
  for (let room = 90; room <= 900; room += 1) {
    for (const keep of [[], ['c12'], ['settings']]) {
      const space = measured(room, reportRows);
      const result = fitModules(report, space, keep, true);
      // Kept modules stay whatever the room; anything placed beside them fits.
      const forced = result.visible.every((item) => keep.includes(item.id));
      assert.ok(forced || taken(space, result.visible, true) <= room, `${room}px, keep ${keep}: a row is cut`);
      const next = partitionModules(report, result.visible.length + 2, keep, true);
      if (next.visible.length > result.visible.length) {
        assert.ok(taken(space, next.visible, true) > room, `${room}px, keep ${keep}: a module that fits was left off`);
      }
    }
  }
});

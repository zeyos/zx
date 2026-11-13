import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  TABLE_FR_MIN_WIDTH, TABLE_INTERACTIVE_SELECTOR, editorSelectsOnEntry, normalizeTableColumns,
  tableColumnName, tableColumnPin, tableColumnSizing, tableHeaderGroups, tableHeaderName, tablePinLayout
} from '../../src/components/table/table.js';

/*
 * What a column is called where it is named rather than shown, which editors replace their value
 * on the first keystroke, and the header and frame rules that keep a table's columns alike. The
 * DOM half — `data-column` on every cell, the `aria-label` on a blank header — is exercised in the
 * browser; the decisions are pure and live here.
 */

const css = readFileSync(new URL('../../src/components/table/table.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('../../src/components/table/table.js', import.meta.url), 'utf8');

/** @param {string} selector @returns {string} The declarations of the first rule for a selector. */
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(match, `no rule for ${selector}`);
  return match[1];
}

test('a column is named by its ariaLabel, then its label, then its id', () => {
  assert.equal(tableColumnName({ id: 'qty', label: 'Quantity' }), 'Quantity');
  assert.equal(tableColumnName({ id: 'pos', label: '#', ariaLabel: 'Position' }), 'Position');
  assert.equal(tableColumnName({ id: 'actions', label: '' }), 'actions');
  assert.equal(tableColumnName({ id: 'actions', label: '   ', ariaLabel: '  ' }), 'actions');
  assert.equal(tableColumnName({ id: 'actions', label: '', ariaLabel: 'Row actions' }), 'Row actions');
  assert.equal(tableColumnName(null), '');
});

test('only a blank or explicitly named header gets an aria-label', () => {
  // A visible label already names its header; repeating it as aria-label would add nothing.
  assert.equal(tableHeaderName({ id: 'qty', label: 'Quantity' }), null);
  // A blank header is announced by its key rather than as an empty column.
  assert.equal(tableHeaderName({ id: 'actions', label: '' }), 'actions');
  assert.equal(tableHeaderName({ id: 'flag', label: ' ' }), 'flag');
  // An explicit name wins, with or without a visible label.
  assert.equal(tableHeaderName({ id: 'actions', label: '', ariaLabel: 'Row actions' }), 'Row actions');
  assert.equal(tableHeaderName({ id: 'pos', label: '#', ariaLabel: 'Position' }), 'Position');
});

test('normalized columns keep an empty label empty, so the header can stay blank', () => {
  const [blank, missing] = normalizeTableColumns([{ id: 'actions', label: '' }, { id: 'name' }]);
  assert.equal(blank.label, '');
  assert.equal(tableHeaderName(blank), 'actions');
  // A missing label still falls back to the id as visible text, exactly as before.
  assert.equal(missing.label, 'name');
  assert.equal(tableHeaderName(missing), null);
});

test('text, number, and date editors select their content on entry; the others do not', () => {
  // Typing "6" into a number editor showing "1.00" must give 6, not 1.006.
  for (const type of ['text', 'number', 'date']) assert.equal(editorSelectsOnEntry(type), true, type);
  for (const type of ['textarea', 'select', 'checkbox', 'custom', '', undefined]) {
    assert.equal(editorSelectsOnEntry(/** @type {any} */ (type)), false, String(type));
  }
  assert.match(source, /if \(editorSelectsOnEntry\(entry\.type\) && typeof control\.select === 'function'\) control\.select\(\);/);
});

test('every header and body cell carries data-column, editable or not', () => {
  assert.match(source, /h\('th', \{ scope: 'col', dataset: \{ column: column\.id \} \}\)/);
  // Written outside the edit-mode branch, so a read-only table can be styled per column.
  assert.match(source, /cell\.dataset\.label = column\.label;\n\s*cell\.dataset\.column = column\.id;\n\s*if \(column\.popin === false\)/);
});

test('a click on a control inside a cell is held back from the row in every table', () => {
  // Unconditional in both handlers: not only where the click could otherwise open an editor.
  assert.equal(source.match(/^\s*if \(isInteractiveCellContent\(target\)\) return;/gm)?.length, 2);
  assert.doesNotMatch(source, /_editMode !== false && isInteractiveCellContent/);
  for (const control of ['a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary',
    '[role="button"]', '[role="link"]', '[role="switch"]', '[role="checkbox"]', '[role="combobox"]',
    '[contenteditable]:not([contenteditable="false"])', '[tabindex]:not([tabindex="-1"])',
    '[data-zx-table-no-edit]']) {
    assert.ok(TABLE_INTERACTIVE_SELECTOR.split(',').includes(control), control);
  }
  // A section row's single cell is a cell like any other for this purpose.
  assert.match(source, /closest\?\.\('td\[data-column\], th\.zx-table__section-cell'\)/);
});

test('fr columns become proportional percentages and fix the layout', () => {
  const sizing = tableColumnSizing([{ id: 'a', width: '2fr' }, { id: 'b', width: '1fr' }, { id: 'c', width: '1fr' }]);
  assert.equal(sizing.layout, 'fixed');
  assert.deepEqual(sizing.widths, ['50%', '25%', '25%']);
  // Content decides without fr columns; a windowed table is fixed whatever its widths are.
  assert.deepEqual(tableColumnSizing([{ id: 'a', width: '120px' }, { id: 'b' }, { id: 'c', width: 'auto' }]),
    { layout: 'auto', widths: ['120px', null, null], minInlineSize: null });
  assert.equal(tableColumnSizing([{ id: 'a' }], { virtual: true }).layout, 'fixed');
  assert.deepEqual(tableColumnSizing([], {}), { layout: 'auto', widths: [], minInlineSize: null });
});

test('an fr column beside fixed ones keeps a floor: the table gets a minimum width', () => {
  // The reported case: 10rem + 1fr + 8rem in a 320px container left the 1fr column 30px.
  const columns = [{ id: 'a', width: '10rem' }, { id: 'b', width: '1fr' }, { id: 'c', width: '8rem' }];
  assert.equal(TABLE_FR_MIN_WIDTH, '5rem');
  for (const virtual of [true, false]) {
    const sizing = tableColumnSizing(columns, { virtual });
    assert.deepEqual(sizing.widths, ['10rem', '100%', '8rem']);
    assert.equal(sizing.minInlineSize, 'calc(10rem + 8rem + 5rem)');
  }
  // The column's own minWidth wins over the default; a number is pixels.
  assert.equal(tableColumnSizing([columns[0], { id: 'b', width: '1fr', minWidth: '12rem' }]).minInlineSize,
    'calc(10rem + 12rem)');
  assert.equal(tableColumnSizing([{ id: 'b', width: '1fr', minWidth: 150 }]).minInlineSize, '150px');
  // 0 lifts the floor, and with nothing left to guarantee there is no minimum at all.
  assert.equal(tableColumnSizing([columns[0], { id: 'b', width: '1fr', minWidth: 0 }]).minInlineSize, null);
  // An unusable minWidth falls back to the default rather than producing invalid CSS.
  for (const minWidth of ['wide', '50%', -3, Number.NaN, {}]) {
    assert.equal(tableColumnSizing([{ id: 'b', width: '1fr', minWidth }]).minInlineSize, '5rem', String(minWidth));
  }
});

test('the minimum width lets the smallest share reach its floor', () => {
  // 1fr of 4 gets a quarter of what the fr columns share, so they need four floors between them.
  assert.equal(tableColumnSizing([{ id: 'a', width: '3fr' }, { id: 'b', width: '1fr' }]).minInlineSize,
    'calc(5rem * 4)');
  // Different floors: whichever column needs the most room decides.
  assert.equal(tableColumnSizing([
    { id: 'a', width: '2fr' }, { id: 'b', width: '1fr', minWidth: '120px' }
  ]).minInlineSize, 'calc(max(5rem * 1.5, 120px * 3))');
  // Factors are rounded up, never down: a floor must not be missed by a rounding error.
  assert.equal(tableColumnSizing([{ id: 'a', width: '2fr' }, { id: 'b', width: '.7fr' }]).minInlineSize,
    'calc(5rem * 3.858)');
});

test('structural, auto and percentage columns in the minimum width', () => {
  const fr = { id: 'b', width: '1fr' };
  assert.equal(tableColumnSizing([fr], { structural: 1 }).minInlineSize, 'calc(var(--zx-control-height) + 5rem)');
  assert.equal(tableColumnSizing([fr], { structural: 2 }).minInlineSize,
    'calc(var(--zx-control-height) * 2 + 5rem)');
  // A percentage would resolve against the container, so it is left out of the sum.
  assert.equal(tableColumnSizing([fr, { id: 'p', width: '30%' }]).minInlineSize, '5rem');
  assert.equal(tableColumnSizing([fr, { id: 'c', width: 'calc(4rem + 10px)' }]).minInlineSize,
    'calc(calc(4rem + 10px) + 5rem)');
  // An auto column counts only when it says how narrow it may get — and then on its own, too.
  assert.equal(tableColumnSizing([fr, { id: 'c' }]).minInlineSize, '5rem');
  assert.equal(tableColumnSizing([fr, { id: 'c', minWidth: '6rem' }]).minInlineSize, 'calc(6rem + 5rem)');
  assert.equal(tableColumnSizing([{ id: 'c', minWidth: '6rem' }, { id: 'd' }], { virtual: true }).minInlineSize, '6rem');
  // Auto columns of a windowed table share the width evenly, as before: no minimum by default.
  assert.equal(tableColumnSizing([{ id: 'c' }, { id: 'd' }], { virtual: true }).minInlineSize, null);
  // A fixed-width column ignores minWidth.
  assert.equal(tableColumnSizing([fr, { id: 'c', width: '4rem', minWidth: '9rem' }]).minInlineSize, 'calc(4rem + 5rem)');
});

test('pin accepts the two logical edges and nothing else', () => {
  assert.equal(tableColumnPin({ id: 'a', pin: 'start' }), 'start');
  assert.equal(tableColumnPin({ id: 'a', pin: 'end' }), 'end');
  for (const pin of [undefined, null, true, 'left', 'right', '', 'START']) {
    assert.equal(tableColumnPin({ id: 'a', pin: /** @type {any} */ (pin) }), null, String(pin));
  }
  assert.equal(tableColumnPin(null), null);
  // Normalizing keeps the descriptor's own properties, so a saved column object stays compatible.
  const [column] = normalizeTableColumns([{ id: 'a', pin: 'start', group: 'G', minWidth: '4rem' }]);
  assert.deepEqual(column, { id: 'a', pin: 'start', group: 'G', minWidth: '4rem', label: 'a' });
});

test('pinned columns take slots counted from their edge, in column order', () => {
  const layout = tablePinLayout([
    { id: 'a', pin: 'start' }, { id: 'b' }, { id: 'c', pin: 'start' }, { id: 'd', pin: 'end' }, { id: 'e', pin: 'end' }
  ]);
  assert.equal(layout.start, 2);
  assert.equal(layout.end, 2);
  assert.equal(layout.structural, false);
  assert.deepEqual([...layout.columns], [
    ['a', { side: 'start', slot: 0, edge: false }],
    // The last start column carries the rule towards the scrolling columns…
    ['c', { side: 'start', slot: 1, edge: true }],
    // …and the first end column the one on the other side; the last end column is slot 0.
    ['e', { side: 'end', slot: 0, edge: false }],
    ['d', { side: 'end', slot: 1, edge: true }]
  ]);
  assert.equal(layout.columns.has('b'), false);
});

test('the handle and checkbox columns are pinned with the first start column', () => {
  const layout = tablePinLayout([{ id: 'a', pin: 'start' }, { id: 'b' }], 2);
  assert.equal(layout.structural, true);
  assert.equal(layout.start, 3);
  assert.deepEqual(layout.columns.get('a'), { side: 'start', slot: 2, edge: true });
  // Nothing pinned to the start: they scroll with the rest, an end pin does not hold them.
  const end = tablePinLayout([{ id: 'a' }, { id: 'b', pin: 'end' }], 2);
  assert.equal(end.structural, false);
  assert.equal(end.start, 0);
  assert.deepEqual(end.columns.get('b'), { side: 'end', slot: 0, edge: true });
  assert.deepEqual(tablePinLayout([], 2), { start: 0, end: 0, structural: false, columns: new Map() });
  assert.deepEqual(tablePinLayout(/** @type {any} */ (null)), { start: 0, end: 0, structural: false, columns: new Map() });
});

test('adjacent columns with one group share a header cell', () => {
  assert.deepEqual(tableHeaderGroups([
    { id: 'name' }, { id: 'owner' },
    { id: 'q1p', group: 'Q1' }, { id: 'q1a', group: 'Q1' },
    { id: 'q2p', group: 'Q2' },
    { id: 'total' }
  ]), [
    { label: null, pin: null, columns: ['name', 'owner'] },
    { label: 'Q1', pin: null, columns: ['q1p', 'q1a'] },
    { label: 'Q2', pin: null, columns: ['q2p'] },
    { label: null, pin: null, columns: ['total'] }
  ]);
  // Every column is covered exactly once, so the colspans add up to the column count.
  const runs = tableHeaderGroups([{ id: 'a', group: 'G' }, { id: 'b' }, { id: 'c', group: 'G' }]);
  assert.deepEqual(runs.map((run) => [run.label, run.columns.length]), [['G', 1], [null, 1], ['G', 1]]);
});

test('no group row without a group, and blank or missing labels are no group', () => {
  assert.deepEqual(tableHeaderGroups([{ id: 'a' }, { id: 'b' }]), []);
  assert.deepEqual(tableHeaderGroups([{ id: 'a', group: '' }, { id: 'b', group: '  ' }, { id: 'c', group: null }]), []);
  assert.deepEqual(tableHeaderGroups([]), []);
  assert.deepEqual(tableHeaderGroups([{ id: 'a', group: ' Q1 ' }, { id: 'b', group: 'Q1' }]),
    [{ label: 'Q1', pin: null, columns: ['a', 'b'] }]);
  assert.deepEqual(tableHeaderGroups([{ id: 'a', group: 2026 }]).map((run) => run.label), ['2026']);
});

test('a group is split where the pin changes, so each header cell sticks whole or not at all', () => {
  assert.deepEqual(tableHeaderGroups([
    { id: 'a', group: 'G', pin: 'start' }, { id: 'b', group: 'G' }, { id: 'c', pin: 'end' }, { id: 'd', pin: 'end' }
  ]), [
    { label: 'G', pin: 'start', columns: ['a'] },
    { label: 'G', pin: null, columns: ['b'] },
    { label: null, pin: 'end', columns: ['c', 'd'] }
  ]);
});

test('pinned cells are opaque, logical, and stacked under the header', () => {
  const pinned = rule('.zx-table :is(th, td)[data-pin]');
  assert.match(pinned, /position:\s*sticky/);
  assert.match(pinned, /z-index:\s*1/);
  assert.match(rule('.zx-table :is(th, td)[data-pin="start"]'), /inset-inline-start:\s*var\(--zx-table-pin-offset, 0px\)/);
  assert.match(rule('.zx-table :is(th, td)[data-pin="end"]'), /inset-inline-end:\s*var\(--zx-table-pin-offset, 0px\)/);
  // No physical side anywhere in the pin rules: the start edge is the right one in RTL.
  assert.doesNotMatch(css, /\[data-pin[^{]*\{[^}]*\b(?:left|right)\s*:/);
  // Sticky header 2, pinned header cells 3, pinned body cells 1.
  assert.match(rule('.zx-table__scroll[data-sticky-header="true"] th'), /z-index:\s*2/);
  assert.match(rule('.zx-table .zx-table__head :is(th, td)[data-pin]'), /z-index:\s*3/);
  // The body cell paints hover and row fill over an opaque base instead of showing the row through.
  const body = rule('.zx-table__body td[data-pin]');
  assert.match(body, /--zx-table-pin-hover/);
  assert.match(body, /--zx-table-row-fill/);
  assert.match(body, /var\(--zx-table-pin-bg, var\(--zx-table-header-bg, var\(--zx-color-bg-surface\)\)\)/);
  assert.match(rule('.zx-table[data-stacked] .zx-table__body td[data-pin]'), /position:\s*static/);
  assert.match(rule('.zx-table .zx-table__body td[data-editing="true"][data-pin]'), /position:\s*sticky/);
});

test('the column labels stick below the group row, and row indices count both header rows', () => {
  assert.match(rule('.zx-table__scroll[data-sticky-header="true"] .zx-table__group-row ~ tr > th'),
    /inset-block-start:\s*var\(--zx-table-group-row-size, var\(--zx-row-height\)\)/);
  assert.match(source, /tr\.setAttribute\('aria-rowindex', String\(tree\.visibleIndex \+ 1 \+ this\._headerRows\)\)/);
  assert.match(source, /'aria-rowcount', String\(projected\.length \+ this\._headerRows\)/);
  // The group cell is a column header with a native colspan, not a role and aria-colspan by hand.
  assert.match(source, /class: 'zx-table__group', scope: 'col', colspan: run\.columns\.length/);
});

test('a fixed layout takes its minimum width from the columns, and a stacked table drops it', () => {
  assert.match(rule('.zx-table__table[data-layout="fixed"]'), /min-inline-size:\s*var\(--zx-table-min-inline-size, 0\)/);
  assert.match(rule('.zx-table[data-stacked] .zx-table__table'), /min-inline-size:\s*0/);
});

test('sortable and plain headers share the header type, and no gutter is reserved', () => {
  const button = rule('.zx-table__sort-button');
  assert.match(button, /font:\s*inherit/);
  assert.match(button, /letter-spacing:\s*inherit/);
  const scroll = rule('.zx-table__scroll');
  assert.match(scroll, /scrollbar-gutter:\s*auto/);
  assert.doesNotMatch(css, /scrollbar-gutter:\s*stable/);
});

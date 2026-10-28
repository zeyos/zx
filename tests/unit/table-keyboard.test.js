import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tableGridTarget, tablePageSize, tableRowLabel, treegridArrowAction
} from '../../src/components/table/table.js';

/*
 * The arithmetic of the Table's APG grid and treegrid keyboard model: where a key moves focus, how
 * far a page is, what ArrowLeft and ArrowRight do to a branch, and what a row's controls are named
 * after. The DOM half — roving tabindex, Enter firing rowclick, Space selecting, focus kept across
 * a sort — runs in a real browser in `tests/smoke/smoke.js`.
 */

const rowGrid = { rows: 5, page: 2 };
const cellGrid = { rows: 5, columns: 4, page: 2, cells: true };

test('row focus moves one row with the arrows and stops at either end', () => {
  assert.deepEqual(tableGridTarget({ row: 2 }, 'ArrowDown', rowGrid), { row: 3, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 2 }, 'ArrowUp', rowGrid), { row: 1, column: 0 });
  // A grid does not wrap.
  assert.deepEqual(tableGridTarget({ row: 4 }, 'ArrowDown', rowGrid), { row: 4, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 0 }, 'ArrowUp', rowGrid), { row: 0, column: 0 });
});

test('row focus ignores ArrowLeft and ArrowRight, which belong to cells or the tree', () => {
  assert.equal(tableGridTarget({ row: 1 }, 'ArrowLeft', rowGrid), null);
  assert.equal(tableGridTarget({ row: 1 }, 'ArrowRight', rowGrid), null);
  assert.equal(tableGridTarget({ row: 1 }, 'Tab', rowGrid), null);
  assert.equal(tableGridTarget({ row: 1 }, 'a', rowGrid), null);
});

test('Home and End go to the first and last row under row focus, with or without Ctrl', () => {
  assert.deepEqual(tableGridTarget({ row: 2 }, 'Home', rowGrid), { row: 0, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 2 }, 'End', rowGrid), { row: 4, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 2 }, 'End', { ...rowGrid, ctrl: true }), { row: 4, column: 0 });
});

test('PageUp and PageDown move by the page size and clamp at the ends', () => {
  assert.deepEqual(tableGridTarget({ row: 1 }, 'PageDown', rowGrid), { row: 3, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 3 }, 'PageDown', rowGrid), { row: 4, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 3 }, 'PageUp', rowGrid), { row: 1, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 1 }, 'PageUp', rowGrid), { row: 0, column: 0 });
  // Without a page size, a page is ten rows.
  assert.deepEqual(tableGridTarget({ row: 0 }, 'PageDown', { rows: 40 }), { row: 10, column: 0 });
});

test('cell focus moves between cells and keeps its column on vertical moves', () => {
  assert.deepEqual(tableGridTarget({ row: 1, column: 1 }, 'ArrowRight', cellGrid), { row: 1, column: 2 });
  assert.deepEqual(tableGridTarget({ row: 1, column: 1 }, 'ArrowLeft', cellGrid), { row: 1, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 1, column: 3 }, 'ArrowRight', cellGrid), { row: 1, column: 3 });
  assert.deepEqual(tableGridTarget({ row: 1, column: 0 }, 'ArrowLeft', cellGrid), { row: 1, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 1, column: 2 }, 'ArrowDown', cellGrid), { row: 2, column: 2 });
  assert.deepEqual(tableGridTarget({ row: 1, column: 2 }, 'PageDown', cellGrid), { row: 3, column: 2 });
});

test('Home and End stay in the row under cell focus; Ctrl takes them to the corners', () => {
  assert.deepEqual(tableGridTarget({ row: 2, column: 2 }, 'Home', cellGrid), { row: 2, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 2, column: 1 }, 'End', cellGrid), { row: 2, column: 3 });
  assert.deepEqual(tableGridTarget({ row: 2, column: 2 }, 'Home', { ...cellGrid, ctrl: true }), { row: 0, column: 0 });
  assert.deepEqual(tableGridTarget({ row: 2, column: 1 }, 'End', { ...cellGrid, ctrl: true }), { row: 4, column: 3 });
});

test('an empty body has nowhere to move, and out-of-range positions are clamped first', () => {
  assert.equal(tableGridTarget({ row: 0 }, 'ArrowDown', { rows: 0 }), null);
  assert.deepEqual(tableGridTarget({ row: 9, column: 9 }, 'ArrowUp', cellGrid), { row: 3, column: 3 });
  assert.deepEqual(tableGridTarget({ row: -3 }, 'ArrowDown', rowGrid), { row: 1, column: 0 });
});

test('a page is the rows that fit, less one kept in view, and ten when unmeasurable', () => {
  assert.equal(tablePageSize(400, 40), 9);
  assert.equal(tablePageSize(100, 40), 1);
  assert.equal(tablePageSize(30, 40), 1);
  assert.equal(tablePageSize(0, 40), 10);
  assert.equal(tablePageSize(400, 0), 10);
  assert.equal(tablePageSize(Number.NaN, 40, 6), 6);
});

test('treegrid rows: ArrowRight expands, then moves into the first child', () => {
  const collapsed = { focus: 'row', hasChildren: true, expanded: false, hasParent: false };
  assert.deepEqual(treegridArrowAction('ArrowRight', collapsed), { action: 'expand' });
  assert.deepEqual(treegridArrowAction('ArrowRight', { ...collapsed, expanded: true }), { action: 'child' });
  // A leaf has nothing to open and nowhere further right to go.
  assert.equal(treegridArrowAction('ArrowRight', { focus: 'row', hasChildren: false, hasParent: true }), null);
});

test('treegrid rows: ArrowLeft collapses, then moves to the parent', () => {
  const expanded = { focus: 'row', hasChildren: true, expanded: true, hasParent: true };
  assert.deepEqual(treegridArrowAction('ArrowLeft', expanded), { action: 'collapse' });
  assert.deepEqual(treegridArrowAction('ArrowLeft', { ...expanded, expanded: false }), { action: 'parent' });
  assert.deepEqual(treegridArrowAction('ArrowLeft', { focus: 'row', hasChildren: false, hasParent: true }),
    { action: 'parent' });
  assert.equal(treegridArrowAction('ArrowLeft', { focus: 'row', hasChildren: false, hasParent: false }), null);
  // `expanded` means nothing on a leaf.
  assert.deepEqual(treegridArrowAction('ArrowLeft', { focus: 'row', hasChildren: false, expanded: true, hasParent: true }),
    { action: 'parent' });
});

test('treegrid with cell focus: rows hand over to their first cell, and the first cell back to the row', () => {
  const row = { focus: 'row', cells: true, hasChildren: true, expanded: true, hasParent: false };
  assert.deepEqual(treegridArrowAction('ArrowRight', { ...row, expanded: false }), { action: 'expand' });
  assert.deepEqual(treegridArrowAction('ArrowRight', row), { action: 'cell', column: 0 });
  assert.deepEqual(treegridArrowAction('ArrowRight', { ...row, hasChildren: false }), { action: 'cell', column: 0 });

  const cell = { focus: 'cell', cells: true, columns: 3 };
  assert.deepEqual(treegridArrowAction('ArrowRight', { ...cell, column: 0 }), { action: 'cell', column: 1 });
  assert.equal(treegridArrowAction('ArrowRight', { ...cell, column: 2 }), null);
  assert.deepEqual(treegridArrowAction('ArrowLeft', { ...cell, column: 2 }), { action: 'cell', column: 1 });
  assert.deepEqual(treegridArrowAction('ArrowLeft', { ...cell, column: 0 }), { action: 'row' });
  assert.equal(treegridArrowAction('ArrowUp', cell), null);
});

test('a row is named by its first cell with text, whitespace collapsed', () => {
  assert.equal(tableRowLabel(['', '  Acme   GmbH \n', 'Berlin']), 'Acme GmbH');
  assert.equal(tableRowLabel([null, undefined, 'INV-1042']), 'INV-1042');
  assert.equal(tableRowLabel(['', '   ']), null);
  assert.equal(tableRowLabel([]), null);
  assert.equal(tableRowLabel('not an array'), null);
});

test('a long row name is cut short with an ellipsis', () => {
  const name = tableRowLabel(['x'.repeat(200)], 20);
  assert.equal(name.length, 20);
  assert.ok(name.endsWith('…'));
});

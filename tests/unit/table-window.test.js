import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tableWindow, tableWindowScroll, tableWindowSegments
} from '../../src/components/table/window.js';

/*
 * The arithmetic of a windowed Table: which rows to draw for a scroll position, what stands in for
 * the rest, and where to scroll to reach a row. The DOM half — spacers, rows drawn on demand, focus
 * surviving a scroll — runs in a real browser in `tests/smoke/smoke.js`.
 */

const view = { rowHeight: 40, viewport: 400 };

test('an empty table draws nothing, whatever the scroll position says', () => {
  assert.deepEqual(tableWindow({ ...view, total: 0, scrollTop: 0 }), { start: 0, end: 0 });
  assert.deepEqual(tableWindow({ ...view, total: 0, scrollTop: 900 }), { start: 0, end: 0 });
  assert.deepEqual(tableWindowSegments(0, 0, 0), []);
  assert.deepEqual(tableWindowSegments(0, 0, 0, [0, 3]), []);
});

test('the first rows are drawn with an overscan below and nothing above', () => {
  // Ten rows in view, ten of overscan below; there is nothing above the first row to overscan.
  assert.deepEqual(tableWindow({ ...view, total: 1000, scrollTop: 0 }), { start: 0, end: 20 });
});

test('the last rows are drawn with an overscan above and nothing below', () => {
  const scrollTop = 1000 * 40 - 400;
  assert.deepEqual(tableWindow({ ...view, total: 1000, scrollTop }), { start: 980, end: 1000 });
});

test('rows in the middle get one viewport of overscan either way', () => {
  assert.deepEqual(tableWindow({ ...view, total: 1000, scrollTop: 4000 }), { start: 90, end: 120 });
  // Part-way through a row, that row and the one it reveals below are both in view.
  assert.deepEqual(tableWindow({ ...view, total: 1000, scrollTop: 4020 }), { start: 90, end: 121 });
});

test('overscan is counted in viewports', () => {
  assert.deepEqual(tableWindow({ ...view, total: 1000, scrollTop: 4000, overscan: 0 }), { start: 100, end: 110 });
  assert.deepEqual(tableWindow({ ...view, total: 1000, scrollTop: 4000, overscan: 2 }), { start: 80, end: 130 });
});

test('a table shorter than its viewport draws every row', () => {
  assert.deepEqual(tableWindow({ ...view, total: 3, scrollTop: 0 }), { start: 0, end: 3 });
});

test('a scroll position past the end is clamped to the last rows', () => {
  // What a list that just got shorter reports until the browser has laid it out again.
  assert.deepEqual(tableWindow({ ...view, total: 20, scrollTop: 900000 }), { start: 0, end: 20 });
  assert.deepEqual(tableWindow({ ...view, total: 100, scrollTop: 900000 }), { start: 80, end: 100 });
  assert.deepEqual(tableWindow({ ...view, total: 100, scrollTop: -50 }), { start: 0, end: 20 });
});

test('heights that are not known yet still draw a row to measure', () => {
  assert.deepEqual(tableWindow({ total: 500, rowHeight: 0, scrollTop: 0, viewport: 0 }), { start: 0, end: 1 });
  assert.deepEqual(tableWindow({ total: 500, rowHeight: 40, scrollTop: 0, viewport: 0 }), { start: 0, end: 2 });
  assert.deepEqual(tableWindow({ total: 500, rowHeight: Number.NaN, scrollTop: Number.NaN, viewport: 400 }),
    { start: 0, end: 1 });
});

test('fractional row heights stay inside the table', () => {
  const { start, end } = tableWindow({ total: 10000, rowHeight: 36.4, scrollTop: 10000 * 36.4 - 300, viewport: 300 });
  assert.equal(end, 10000);
  assert.ok(start < end - 8);
});

test('segments put a gap either side of the window', () => {
  assert.deepEqual(tableWindowSegments(100, 40, 60), [{ gap: 40 }, { from: 40, to: 60 }, { gap: 40 }]);
});

test('no gap above the first row or below the last one', () => {
  assert.deepEqual(tableWindowSegments(100, 0, 20), [{ from: 0, to: 20 }, { gap: 80 }]);
  assert.deepEqual(tableWindowSegments(100, 80, 100), [{ gap: 80 }, { from: 80, to: 100 }]);
  assert.deepEqual(tableWindowSegments(20, 0, 20), [{ from: 0, to: 20 }]);
});

test('a pinned row above the window stays drawn in its place', () => {
  assert.deepEqual(tableWindowSegments(100, 40, 60, [5]),
    [{ gap: 5 }, { from: 5, to: 6 }, { gap: 34 }, { from: 40, to: 60 }, { gap: 40 }]);
});

test('a pinned row below the window stays drawn in its place', () => {
  assert.deepEqual(tableWindowSegments(100, 0, 20, [99]),
    [{ from: 0, to: 20 }, { gap: 79 }, { from: 99, to: 100 }]);
});

test('the rows of a segment list always add up to the table', () => {
  for (const pinned of [[], [0], [99], [0, 99], [39, 60], [5, 5], [5, 80], [41]]) {
    const parts = tableWindowSegments(100, 40, 60, pinned);
    const rows = parts.reduce((sum, part) => sum + ('gap' in part ? part.gap : part.to - part.from), 0);
    assert.equal(rows, 100, `pinned ${pinned} covered ${rows} rows`);
  }
});

test('a pin inside the window changes nothing, and neither does one twice over', () => {
  assert.deepEqual(tableWindowSegments(100, 40, 60, [45]), tableWindowSegments(100, 40, 60));
  assert.deepEqual(tableWindowSegments(100, 40, 60, [5, 5]), tableWindowSegments(100, 40, 60, [5]));
});

test('a pin touching the window joins it instead of leaving an empty gap', () => {
  assert.deepEqual(tableWindowSegments(100, 40, 60, [39]), [{ gap: 39 }, { from: 39, to: 60 }, { gap: 40 }]);
  assert.deepEqual(tableWindowSegments(100, 40, 60, [60]), [{ gap: 40 }, { from: 40, to: 61 }, { gap: 39 }]);
});

test('pins that are not rows are ignored', () => {
  assert.deepEqual(tableWindowSegments(100, 40, 60, [undefined, null, -1, 100, 1.5, Number.NaN]),
    tableWindowSegments(100, 40, 60));
});

test('the first and last rows can be pinned', () => {
  assert.deepEqual(tableWindowSegments(100, 40, 60, [0, 99]),
    [{ from: 0, to: 1 }, { gap: 39 }, { from: 40, to: 60 }, { gap: 39 }, { from: 99, to: 100 }]);
});

test('a row already in view keeps the scroll position', () => {
  assert.equal(tableWindowScroll({ ...view, index: 100, scrollTop: 4000 }), 4000);
  assert.equal(tableWindowScroll({ ...view, index: 109, scrollTop: 4000 }), 4000);
});

test('a row above the view lands on its top edge', () => {
  assert.equal(tableWindowScroll({ ...view, index: 99, scrollTop: 4000 }), 3960);
  assert.equal(tableWindowScroll({ ...view, index: 0, scrollTop: 4000 }), 0);
});

test('a row below the view lands on its bottom edge', () => {
  assert.equal(tableWindowScroll({ ...view, index: 110, scrollTop: 4000 }), 4040);
  assert.equal(tableWindowScroll({ ...view, index: 999, scrollTop: 0 }), 999 * 40 + 40 - 400);
});

test('in a view shorter than a row, the top of the row wins', () => {
  assert.equal(tableWindowScroll({ index: 2, rowHeight: 40, scrollTop: 0, viewport: 10 }), 80);
});

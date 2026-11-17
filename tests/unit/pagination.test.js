import assert from 'node:assert/strict';
import test from 'node:test';

import { fitPageSize, pageFitStep, paginationRange } from '../../src/components/pagination/pagination.js';

/** @param {number} page @param {number} pages @param {number} siblings @param {number} boundaries */
function window_(page, pages, siblings = 1, boundaries = 1) {
  return paginationRange({ page, pages, siblings, boundaries });
}

/* ------------------------------------------------------------------- few pages -- */

test('a range that fits in the window is returned whole', () => {
  assert.deepEqual(window_(1, 3), [1, 2, 3]);
  assert.deepEqual(window_(2, 3), [1, 2, 3]);
  assert.deepEqual(window_(3, 3), [1, 2, 3]);
  // boundaries*2 + siblings*2 + 3 = 7 slots, so seven pages still fit exactly.
  assert.deepEqual(window_(4, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('a single skipped page is printed instead of an ellipsis', () => {
  // Nine pages with a seven-slot window: page 6 would be the only gap, so it is shown.
  assert.deepEqual(window_(3, 9), [1, 2, 3, 4, 5, '…', 9]);
  assert.deepEqual(window_(3, 8), [1, 2, 3, 4, 5, '…', 8]);
  assert.deepEqual(window_(1, 8), [1, 2, 3, 4, 5, '…', 8]);
  assert.deepEqual(window_(8, 8), [1, '…', 4, 5, 6, 7, 8]);
});

/* ------------------------------------------------------------------ many pages -- */

test('the window keeps a constant width as the current page walks the whole range', () => {
  const widths = new Set();
  for (let page = 1; page <= 10; page += 1) widths.add(window_(page, 10).length);
  assert.deepEqual([...widths], [7]);
});

test('the current page sits between its siblings in the middle of a long range', () => {
  assert.deepEqual(window_(5, 10), [1, '…', 4, 5, 6, '…', 10]);
  assert.deepEqual(window_(6, 10), [1, '…', 5, 6, 7, '…', 10]);
});

test('the window sticks to the start while the current page is near the first page', () => {
  assert.deepEqual(window_(1, 10), [1, 2, 3, 4, 5, '…', 10]);
  assert.deepEqual(window_(2, 10), [1, 2, 3, 4, 5, '…', 10]);
  assert.deepEqual(window_(4, 10), [1, 2, 3, 4, 5, '…', 10]);
});

test('the window sticks to the end while the current page is near the last page', () => {
  assert.deepEqual(window_(7, 10), [1, '…', 6, 7, 8, 9, 10]);
  assert.deepEqual(window_(9, 10), [1, '…', 6, 7, 8, 9, 10]);
  assert.deepEqual(window_(10, 10), [1, '…', 6, 7, 8, 9, 10]);
});

test('every entry is a page number or the ellipsis, and numbers stay ascending', () => {
  const entries = window_(10, 40, 2, 2);
  assert.deepEqual(entries, [1, 2, '…', 8, 9, 10, 11, 12, '…', 39, 40]);
  const numbers = entries.filter((entry) => typeof entry === 'number');
  assert.deepEqual(numbers, [...numbers].sort((left, right) => left - right));
  assert.equal(new Set(numbers).size, numbers.length);
});

/* --------------------------------------------------------------------- options -- */

test('siblings 0 shows the current page alone between the boundaries', () => {
  assert.deepEqual(window_(5, 10, 0, 1), [1, '…', 5, '…', 10]);
  assert.deepEqual(window_(1, 10, 0, 1), [1, 2, 3, '…', 10]);
  assert.deepEqual(window_(10, 10, 0, 1), [1, '…', 8, 9, 10]);
});

test('siblings 2 widens the run around the current page', () => {
  assert.deepEqual(window_(10, 20, 2, 1), [1, '…', 8, 9, 10, 11, 12, '…', 20]);
  assert.deepEqual(window_(1, 20, 2, 1), [1, 2, 3, 4, 5, 6, 7, '…', 20]);
  assert.deepEqual(window_(20, 20, 2, 1), [1, '…', 14, 15, 16, 17, 18, 19, 20]);
});

test('boundaries 0 drops the pinned first and last pages', () => {
  assert.deepEqual(window_(5, 10, 1, 0), ['…', 4, 5, 6, '…']);
  assert.deepEqual(window_(1, 10, 1, 0), [1, 2, 3, 4, '…']);
  assert.deepEqual(window_(10, 10, 1, 0), ['…', 7, 8, 9, 10]);
  assert.deepEqual(window_(5, 10, 0, 0), ['…', 5, '…']);
});

test('boundaries 2 pins two pages at each end', () => {
  assert.deepEqual(window_(7, 15, 1, 2), [1, 2, '…', 6, 7, 8, '…', 14, 15]);
  assert.deepEqual(window_(1, 15, 1, 2), [1, 2, 3, 4, 5, 6, '…', 14, 15]);
  assert.deepEqual(window_(15, 15, 1, 2), [1, 2, '…', 10, 11, 12, 13, 14, 15]);
});

/* ----------------------------------------------------------------------- edges -- */

test('an empty range has no entries and a one-page range has one', () => {
  assert.deepEqual(paginationRange({ page: 1, pages: 0 }), []);
  assert.deepEqual(paginationRange({ page: 1, pages: -3 }), []);
  assert.deepEqual(paginationRange({ page: 5, pages: 1 }), [1]);
  assert.deepEqual(paginationRange({}), [1]);
});

test('the current page is clamped into the range before the window is computed', () => {
  assert.deepEqual(window_(99, 10), window_(10, 10));
  assert.deepEqual(window_(0, 10), window_(1, 10));
  assert.deepEqual(window_(-4, 10), window_(1, 10));
});

test('non-integer and non-numeric inputs are truncated rather than trusted', () => {
  assert.deepEqual(paginationRange({ page: 5.9, pages: 10.4, siblings: 1, boundaries: 1 }),
    window_(5, 10));
  assert.deepEqual(paginationRange({ page: '5', pages: '10', siblings: '1', boundaries: '1' }),
    window_(5, 10));
  assert.deepEqual(paginationRange({ page: NaN, pages: 10, siblings: NaN, boundaries: NaN }),
    window_(1, 10, 0, 0));
});

/* ------------------------------------------------- offset and clamping arithmetic -- */

/**
 * The arithmetic the component applies on every state change: pages from total and page size, the
 * page clamped into `[1, pages]`, and the zero-based offset the server is asked for.
 * @param {{page: number, pageSize: number, total: number}} state Requested state.
 * @returns {{page: number, pageSize: number, total: number, pages: number, offset: number}}
 */
function slice({ page, pageSize, total }) {
  const pages = total <= 0 ? 1 : Math.ceil(total / pageSize);
  const clamped = Math.min(Math.max(page, 1), pages);
  return { page: clamped, pageSize, total, pages, offset: (clamped - 1) * pageSize };
}

test('an empty total is one empty page at offset zero', () => {
  assert.deepEqual(slice({ page: 1, pageSize: 25, total: 0 }),
    { page: 1, pageSize: 25, total: 0, pages: 1, offset: 0 });
  assert.deepEqual(slice({ page: 9, pageSize: 25, total: 0 }).page, 1);
});

test('a partial last page still counts as a page', () => {
  assert.equal(slice({ page: 1, pageSize: 25, total: 312 }).pages, 13);
  assert.equal(slice({ page: 1, pageSize: 25, total: 25 }).pages, 1);
  assert.equal(slice({ page: 1, pageSize: 25, total: 26 }).pages, 2);
});

test('the offset is the zero-based first row of the current page', () => {
  assert.equal(slice({ page: 1, pageSize: 25, total: 312 }).offset, 0);
  assert.equal(slice({ page: 2, pageSize: 25, total: 312 }).offset, 25);
  assert.equal(slice({ page: 13, pageSize: 25, total: 312 }).offset, 300);
});

test('the page is clamped when the total shrinks under it', () => {
  assert.deepEqual(slice({ page: 13, pageSize: 25, total: 40 }),
    { page: 2, pageSize: 25, total: 40, pages: 2, offset: 25 });
  assert.equal(slice({ page: 0, pageSize: 25, total: 312 }).page, 1);
  assert.equal(slice({ page: 500, pageSize: 25, total: 312 }).page, 13);
});

test('growing the page size folds the range into fewer pages', () => {
  assert.equal(slice({ page: 1, pageSize: 50, total: 312 }).pages, 7);
  assert.equal(slice({ page: 1, pageSize: 100, total: 312 }).pages, 4);
  // Page 13 of 25 no longer exists once the size doubles, so it clamps onto the new last page.
  assert.deepEqual(slice({ page: 13, pageSize: 50, total: 312 }).page, 7);
});

/* ----------------------------------------------------------------- fitted size -- */

test('a fitted page holds the whole rows that fit below the reserved header', () => {
  // 500px of viewport, a 36px sticky header, 36px rows: 464 / 36 = 12.9, so 12 rows.
  assert.equal(fitPageSize({ available: 500, rowHeight: 36, reserve: 36 }), 12);
  assert.equal(fitPageSize({ available: 468, rowHeight: 36 }), 13);
});

test('subpixel layout does not cost a row that visibly fits', () => {
  assert.equal(fitPageSize({ available: 179.6, rowHeight: 36 }), 5);
  assert.equal(fitPageSize({ available: 179.4, rowHeight: 36 }), 4);
});

test('a grid fits whole rows of cards, and a negative reserve returns the last gap', () => {
  // Three columns of 200px cards with a 16px gap in 800px: (800 + 16) / 216 = 3.7 rows → 3 × 3.
  assert.equal(fitPageSize({ available: 800, rowHeight: 216, perRow: 3, reserve: -16 }), 9);
  assert.equal(fitPageSize({ available: 800, rowHeight: 216, perRow: 0 }), 3);
});

test('the fitted size is clamped into [min, max]', () => {
  assert.equal(fitPageSize({ available: 100, rowHeight: 36, min: 5 }), 5);
  assert.equal(fitPageSize({ available: 10000, rowHeight: 36, max: 200 }), 200);
  assert.equal(fitPageSize({ available: 10000, rowHeight: 36 }), 277);
  assert.equal(fitPageSize({ available: 10, rowHeight: 36 }), 1);
});

test('nothing to measure yet is 0, so a caller keeps the size it has', () => {
  assert.equal(fitPageSize({ available: 0, rowHeight: 36 }), 0);
  assert.equal(fitPageSize({ available: 500, rowHeight: 0 }), 0);
  assert.equal(fitPageSize({ available: Number.NaN, rowHeight: 36 }), 0);
  assert.equal(fitPageSize(), 0);
});

test('a grid keeps the fitted size within [min, max] in whole rows', () => {
  // Four cards a row and at least five: two full rows, not one row and a stray card.
  assert.equal(fitPageSize({ available: 100, rowHeight: 200, perRow: 4, min: 5 }), 8);
  // Three a row and at most 200: 66 full rows, not a 67th row with two cards in it.
  assert.equal(fitPageSize({ available: 100000, rowHeight: 100, perRow: 3, max: 200 }), 198);
  // Within the range the rows that fit decide.
  assert.equal(fitPageSize({ available: 650, rowHeight: 200, perRow: 4, min: 5, max: 200 }), 12);
  // A maximum below one row still leaves one row.
  assert.equal(fitPageSize({ available: 1000, rowHeight: 100, perRow: 4, min: 1, max: 3 }), 4);
  // No whole row lands in [5, 6] with four a row: the minimum wins, as it does for single items.
  assert.equal(fitPageSize({ available: 100, rowHeight: 100, perRow: 4, min: 5, max: 6 }), 8);
});

/* ------------------------------------------------------------- fitting decisions -- */

/**
 * Plays a sequence of measurements through pageFitStep the way the component does: the viewport
 * height each fit is measured at, and the height the applied fit leaves it at.
 * @param {Array<{size: number, viewport: number, after?: number}>} steps Measurements.
 * @param {number} start The size the pager starts with.
 * @returns {number[]} The page size after each step.
 */
function playFits(steps, start) {
  let current = start;
  let trail = [];
  let settled = null;
  return steps.map(({ size, viewport, after = viewport }) => {
    const step = pageFitStep({ size, current, trail, viewport, settled });
    trail = step.trail;
    if (step.apply) {
      current = size;
      settled = after;
    }
    return current;
  });
}

test('a viewport that shrinks and grows back takes the page size with it', () => {
  // 400px of 40px rows, a drawer halves it, the drawer closes: 10, 5, and 10 again.
  assert.deepEqual(playFits([
    { size: 10, viewport: 400 },
    { size: 5, viewport: 200 },
    { size: 10, viewport: 400 },
    { size: 5, viewport: 200 },
    { size: 10, viewport: 400 }
  ], 25), [10, 5, 10, 5, 10]);
});

test('a fit that resizes its own viewport settles on the smaller size', () => {
  // Ten rows wrap the footer, which takes 20px; nine rows unwrap it again.
  assert.deepEqual(playFits([
    { size: 10, viewport: 400, after: 380 },
    { size: 9, viewport: 380, after: 400 },
    { size: 10, viewport: 400, after: 380 },
    { size: 10, viewport: 400, after: 380 }
  ], 25), [10, 9, 9, 9]);
});

test('rows that change height with the page cannot make the size flip either', () => {
  assert.deepEqual(playFits([
    { size: 10, viewport: 400 },
    { size: 8, viewport: 400 },
    { size: 10, viewport: 400 }
  ], 25), [10, 8, 8]);
});

test('a real resize after a settled loop is followed, and the trail starts over', () => {
  const step = pageFitStep({ size: 12, current: 9, trail: [12, 9], viewport: 480, settled: 400 });
  assert.deepEqual(step, { apply: true, trail: [12] });
  assert.deepEqual(pageFitStep({ size: 12, current: 9, trail: [12, 9], viewport: 400, settled: 400 }),
    { apply: false, trail: [12, 9] }, 'the same size at the settled height is the loop');
});

test('an unchanged or unknown size is never applied, and the trail stays short', () => {
  assert.equal(pageFitStep({ size: 10, current: 10, viewport: 400, settled: 400 }).apply, false);
  assert.equal(pageFitStep({ size: 0, current: 10, viewport: 400, settled: null }).apply, false);
  assert.deepEqual(pageFitStep({ size: 6, current: 5, trail: [1, 2, 3, 4], viewport: 400, settled: 400 }).trail,
    [2, 3, 4, 6]);
});

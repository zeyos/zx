import assert from 'node:assert/strict';
import test from 'node:test';

import { paginationRange } from '../../src/components/pagination/pagination.js';

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

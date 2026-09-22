import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasSpanningRow, isSpanningRow, resolveRowKind, resolveRowKindSpec, spanRowContent,
  tableSpanColspan
} from '../../src/components/table/table.js';

/*
 * The decisions behind `rowKind` / `rowKinds`, tested where they live: as pure functions over data.
 * `Table` itself renders into a DOM that `node --test` does not have, so the DOM half — the single
 * `<th scope="colgroup">`, the withheld header buttons, the stacked card — is asserted in
 * `tests/smoke/`. Everything that decides *what* to render is here.
 */

/** A ZeyOS transaction: `type` 0 is a position, `type` 1 a section heading over the ones below. */
const lines = [
  { ID: 1, type: 1, description: 'Hardware', qty: null, total: null },
  { ID: 2, type: 0, description: 'Standing desk controller', qty: 4, total: 1152.8 },
  { ID: 3, type: 0, description: 'Occupancy sensor', qty: 10, total: 845 },
  { ID: 4, type: 1, description: 'Services', qty: null, total: null },
  { ID: 5, type: 0, description: 'On-site installation', qty: 13, total: 1105 }
];

const sectionKinds = { 1: { span: true, class: 'invoice__section' } };

const columns = [
  { id: 'description', label: 'Description' },
  { id: 'qty', label: 'Qty' },
  { id: 'total', label: 'Total', type: 'currency' }
];

test('a kind resolves from a string field and from a callback, and 0 is a kind', () => {
  assert.equal(resolveRowKind(lines[0], 'type'), '1');
  assert.equal(resolveRowKind(lines[1], 'type'), '0');
  assert.equal(resolveRowKind(lines[0], (row) => row.type), '1');
  assert.equal(resolveRowKind(lines[0], (row) => (row.type === 1 ? 'section' : 'line')), 'section');
  // `0` and `''` are kinds a transaction actually uses; only null and undefined are "no kind".
  assert.equal(resolveRowKind({ type: '' }, 'type'), '');
  assert.equal(resolveRowKind({ type: null }, 'type'), null);
  assert.equal(resolveRowKind({}, 'type'), null);
  assert.equal(resolveRowKind(null, 'type'), null);
});

test('no accessor means no kind, which is what keeps every existing table unchanged', () => {
  assert.equal(resolveRowKind(lines[0], null), null);
  assert.equal(resolveRowKind(lines[0], undefined), null);
  assert.equal(resolveRowKind(lines[0], ''), null);
  assert.equal(isSpanningRow(lines[0], null, sectionKinds), false);
  assert.equal(hasSpanningRow(lines, null, sectionKinds), false);
  assert.equal(hasSpanningRow(lines, 'type', null), false);
});

test('kinds are looked up by their string form, own properties only', () => {
  const spec = resolveRowKindSpec(sectionKinds, '1');
  assert.equal(spec, sectionKinds[1]);
  assert.equal(resolveRowKindSpec(sectionKinds, resolveRowKind(lines[0], 'type')), sectionKinds[1]);
  // A kind with no entry is an ordinary row, not an error.
  assert.equal(resolveRowKindSpec(sectionKinds, '0'), null);
  assert.equal(resolveRowKindSpec(sectionKinds, null), null);
  assert.equal(resolveRowKindSpec(null, '1'), null);
  // Server data naming a member of Object.prototype must not become configuration.
  assert.equal(resolveRowKindSpec(sectionKinds, 'toString'), null);
  assert.equal(resolveRowKindSpec(sectionKinds, 'constructor'), null);
  assert.equal(resolveRowKindSpec({ 1: 'section' }, '1'), null);
});

test('only a span kind spans; a kind entry without it stays an ordinary row', () => {
  assert.equal(isSpanningRow(lines[0], 'type', sectionKinds), true);
  assert.equal(isSpanningRow(lines[1], 'type', sectionKinds), false);
  assert.equal(isSpanningRow(lines[0], 'type', { 1: { class: 'tinted' } }), false);
  assert.equal(isSpanningRow(lines[0], 'type', { 1: { span: false, class: 'tinted' } }), false);
  assert.equal(isSpanningRow(lines[0], (row) => row.type, sectionKinds), true);
});

test('colspan covers the selection and reorder columns, never only the data ones', () => {
  assert.equal(tableSpanColspan(3, {}), 3);
  assert.equal(tableSpanColspan(3, { selectable: 'multi' }), 4);
  // Single selection is the whole row; it renders no column of its own.
  assert.equal(tableSpanColspan(3, { selectable: 'single' }), 3);
  assert.equal(tableSpanColspan(3, { selectable: false }), 3);
  assert.equal(tableSpanColspan(3, { rowReorder: true }), 4);
  assert.equal(tableSpanColspan(3, { selectable: 'multi', rowReorder: true }), 5);
  // Hidden columns shrink it, because it is asked of the visible ones.
  assert.equal(tableSpanColspan(columns.length - 1, { selectable: 'multi' }), 3);
});

test('colspan is never zero or negative, whatever it is handed', () => {
  assert.equal(tableSpanColspan(0, {}), 1);
  assert.equal(tableSpanColspan(0, { selectable: 'multi' }), 1);
  assert.equal(tableSpanColspan(-4, { selectable: 'multi' }), 1);
  assert.equal(tableSpanColspan(Number.NaN, {}), 1);
  assert.equal(tableSpanColspan(2), 2);
});

test('a spanning cell falls back to the first visible column value, and render wins', () => {
  const spec = resolveRowKindSpec(sectionKinds, '1');
  assert.equal(spanRowContent(lines[0], spec, columns), 'Hardware');
  // The first *visible* column: hiding description makes the fallback follow.
  assert.equal(spanRowContent(lines[0], spec, columns.slice(1)), null);
  assert.equal(spanRowContent(lines[0], spec, []), null);
  assert.equal(spanRowContent(lines[0], spec, undefined), null);
});

test('a kind render receives the row and its flat index and may return anything', () => {
  /** @type {unknown[]} */
  const seen = [];
  const spec = {
    span: true,
    render: (row, index) => {
      seen.push([row.ID, index]);
      return `${row.description} (${index})`;
    }
  };
  assert.equal(spanRowContent(lines[3], spec, columns, 3), 'Services (3)');
  assert.deepEqual(seen, [[4, 3]]);
  assert.equal(spanRowContent(lines[3], spec, columns), 'Services (0)');
});

test('the fallback is the raw value, not the first column display type', () => {
  // A currency column's renderer was written for a position. Run against a heading that carries no
  // amount it prints a formatted zero or an em dash where the section name belongs.
  const totalFirst = [columns[2], columns[0]];
  const spec = resolveRowKindSpec(sectionKinds, '1');
  assert.equal(spanRowContent(lines[0], spec, totalFirst), null);
  assert.equal(spanRowContent(lines[1], spec, totalFirst), 1152.8);
});

test('sort controls are withheld while the data holds a section and restored when it does not', () => {
  // This is the flag the header reads: true withholds every sort button and makes setSort() inert.
  assert.equal(hasSpanningRow(lines, 'type', sectionKinds), true);

  const positionsOnly = lines.filter((line) => line.type === 0);
  assert.equal(hasSpanningRow(positionsOnly, 'type', sectionKinds), false);

  // A kind map that spans nothing never takes the controls away in the first place.
  assert.equal(hasSpanningRow(lines, 'type', { 1: { class: 'tinted' } }), false);
  assert.equal(hasSpanningRow([], 'type', sectionKinds), false);
  assert.equal(hasSpanningRow(null, 'type', sectionKinds), false);
});

test('one section anywhere in the data is enough, including outside a growing prefix', () => {
  const grown = [...lines.filter((line) => line.type === 0), { ID: 9, type: 1, description: 'Later' }];
  assert.equal(hasSpanningRow(grown.slice(0, 2), 'type', sectionKinds), false);
  // Asked of the whole data, so a control cannot appear and then vanish on the next growBy().
  assert.equal(hasSpanningRow(grown, 'type', sectionKinds), true);
});

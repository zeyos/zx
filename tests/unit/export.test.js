import assert from 'node:assert/strict';
import test from 'node:test';

import { toCsv } from '../../src/core/export.js';

// downloadBlob() and copyToClipboard() need a document and are exercised by the demo, not here.

test('toCsv writes a header row and one line per record', () => {
  const rows = [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bo' }];
  assert.equal(toCsv(rows, ['id', 'name']), 'id,name\r\n1,Ann\r\n2,Bo');
});

test('toCsv omits the header with header: false', () => {
  const rows = [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bo' }];
  assert.equal(toCsv(rows, ['id', 'name'], { header: false }), '1,Ann\r\n2,Bo');
});

test('toCsv quotes fields containing the delimiter', () => {
  assert.equal(toCsv([{ a: 'x,y' }], ['a']), 'a\r\n"x,y"');
  // A field is only quoted for the delimiter actually in use.
  assert.equal(toCsv([{ a: 'x,y' }], ['a'], { delimiter: ';' }), 'a\r\nx,y');
  assert.equal(toCsv([{ a: 'x;y' }], ['a'], { delimiter: ';' }), 'a\r\n"x;y"');
});

test('toCsv quotes fields containing CR or LF', () => {
  assert.equal(toCsv([{ a: 'one\ntwo' }], ['a']), 'a\r\n"one\ntwo"');
  assert.equal(toCsv([{ a: 'one\rtwo' }], ['a']), 'a\r\n"one\rtwo"');
});

test('toCsv quotes fields containing a quote and doubles the inner quotes', () => {
  assert.equal(toCsv([{ a: 'say "hi"' }], ['a']), 'a\r\n"say ""hi"""');
});

test('toCsv uses a custom delimiter for the header and the rows', () => {
  const rows = [{ id: 1, name: 'Ann' }];
  assert.equal(toCsv(rows, ['id', 'name'], { delimiter: ';' }), 'id;name\r\n1;Ann');
});

test('toCsv separates records with CRLF by default and honours the newline option', () => {
  const rows = [{ a: 1 }, { a: 2 }];
  assert.equal(toCsv(rows, ['a']), 'a\r\n1\r\n2');
  assert.equal(toCsv(rows, ['a'], { newline: '\n' }), 'a\n1\n2');
});

test('toCsv writes Dates as ISO strings', () => {
  const rows = [{ at: new Date('2026-08-17T12:00:00Z') }];
  assert.equal(toCsv(rows, ['at'], { header: false }), '2026-08-17T12:00:00.000Z');
  // An invalid Date has no ISO form, so it becomes an empty field rather than throwing.
  assert.equal(toCsv([{ at: new Date('nope') }], ['at'], { header: false }), '');
});

test('toCsv writes null, undefined, and missing properties as empty fields', () => {
  assert.equal(toCsv([{ a: null, b: undefined }], ['a', 'b'], { header: false }), ',');
  assert.equal(toCsv([{ a: 1 }], ['a', 'missing'], { header: false }), '1,');
  // Non-finite numbers have no useful text form either.
  assert.equal(toCsv([{ a: Infinity }], ['a'], { header: false }), '');
});

test('toCsv defuses text that a spreadsheet would run as a formula', () => {
  for (const value of ['=SUM(A1)', '+1', '-1', '@cmd']) {
    assert.equal(
      toCsv([{ a: value }], ['a'], { header: false }),
      `\t${value}`,
      `expected a tab guard in front of ${value}`
    );
  }
});

test('toCsv leaves negative numbers alone', () => {
  // The guard is for text only, so a numeric -5 keeps its meaning.
  assert.equal(toCsv([{ a: -5 }], ['a'], { header: false }), '-5');
  assert.equal(toCsv([{ a: -5.25 }], ['a'], { header: false }), '-5.25');
});

test('toCsv guards a header label that looks like a formula', () => {
  assert.equal(toCsv([], ['=total']), '\t=total');
});

test('toCsv accepts {id, label, value} column descriptors', () => {
  const rows = [{ id: 7, first: 'Ann', last: 'Smith' }];
  const columns = [
    { id: 'id', label: 'ID' },
    { id: 'full', label: 'Full name', value: (row) => `${row.first} ${row.last}` }
  ];
  assert.equal(toCsv(rows, columns), 'ID,Full name\r\n7,Ann Smith');
});

test('toCsv falls back to the column id when a descriptor has no label', () => {
  assert.equal(toCsv([{ code: 'A' }], [{ id: 'code' }]), 'code\r\nA');
});

test('toCsv mixes plain ids and descriptors in one column list', () => {
  const rows = [{ id: 1, qty: 2, price: 3.5 }];
  const columns = ['id', { id: 'total', label: 'Total', value: (r) => r.qty * r.price }];
  assert.equal(toCsv(rows, columns), 'id,Total\r\n1,7');
});

test('toCsv writes booleans as true/false', () => {
  assert.equal(toCsv([{ a: true, b: false }], ['a', 'b'], { header: false }), 'true,false');
});

test('toCsv serialises object cells as JSON', () => {
  assert.equal(toCsv([{ a: { k: 1 } }], ['a'], { header: false }), '"{""k"":1}"');
});

test('toCsv handles empty and nullish row collections', () => {
  assert.equal(toCsv([], ['a', 'b']), 'a,b');
  assert.equal(toCsv(null, ['a', 'b']), 'a,b');
  assert.equal(toCsv(undefined, ['a', 'b']), 'a,b');
  assert.equal(toCsv([], ['a'], { header: false }), '');
});

test('toCsv accepts any iterable of rows', () => {
  const rows = new Set([{ a: 1 }, { a: 2 }]);
  assert.equal(toCsv(rows, ['a'], { header: false }), '1\r\n2');
});

test('toCsv tolerates nullish rows and an empty column list', () => {
  assert.equal(toCsv([null, { a: 1 }], ['a'], { header: false }), '\r\n1');
  assert.equal(toCsv([{ a: 1 }], []), '\r\n');
});

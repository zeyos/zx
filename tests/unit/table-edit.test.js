import assert from 'node:assert/strict';
import test from 'node:test';

import {
  diffChanges, firstValidationError, formatCellValue, normalizeEditorOptions, parseCellValue,
  resolveEditable, valuesEqual
} from '../../src/components/table/table.js';

const row = { id: 1, name: 'Alpha', qty: 3, locked: false };

test('editable true resolves to the text editor and false stays read-only', () => {
  assert.equal(resolveEditable({ id: 'name', editable: true }, row), 'text');
  assert.equal(resolveEditable({ id: 'name', editable: false }, row), false);
  assert.equal(resolveEditable({ id: 'name' }, row), false);
  assert.equal(resolveEditable(null, row), false);
});

test('named editor types resolve and unknown names stay read-only', () => {
  for (const type of ['text', 'number', 'select', 'date', 'checkbox', 'textarea']) {
    assert.equal(resolveEditable({ id: 'name', editable: type }, row), type);
  }
  assert.equal(resolveEditable({ id: 'name', editable: 'money' }, row), false);
  assert.equal(resolveEditable({ id: 'name', editable: 'TEXT' }, row), false);
  assert.equal(resolveEditable({ id: 'name', editable: 1 }, row), false);
});

test('a per-row editable function makes individual rows read-only', () => {
  const column = { id: 'name', editable: (candidate) => !candidate.locked };
  assert.equal(resolveEditable(column, { ...row, locked: false }), 'text');
  assert.equal(resolveEditable(column, { ...row, locked: true }), false);
});

test('a per-row editable function may also pick the editor type', () => {
  const column = { id: 'value', editable: (candidate) => (candidate.numeric ? 'number' : 'text') };
  assert.equal(resolveEditable(column, { numeric: true }), 'number');
  assert.equal(resolveEditable(column, { numeric: false }), 'text');
});

test('a custom editor wins over editable but a per-row predicate still blocks it', () => {
  const editor = () => null;
  assert.equal(resolveEditable({ id: 'name', editor, editable: 'number' }, row), 'custom');
  assert.equal(resolveEditable({ id: 'name', editor }, row), 'custom');
  assert.equal(
    resolveEditable({ id: 'name', editor, editable: (candidate) => !candidate.locked }, { ...row, locked: true }),
    false
  );
});

test('the changes map holds only the cells a row edit actually changed', () => {
  const changes = diffChanges(row, { name: 'Alpha', qty: 8, locked: true });
  assert.deepEqual(changes, { qty: 8, locked: true });
  assert.deepEqual(diffChanges(row, { name: 'Alpha', qty: 3 }), {});
  assert.deepEqual(diffChanges(row, {}), {});
});

test('the changes map reports values the row does not have yet', () => {
  assert.deepEqual(diffChanges({ id: 1 }, { note: '' }), { note: '' });
  assert.deepEqual(diffChanges({ id: 1, note: undefined }, { note: undefined }), {});
  assert.deepEqual(diffChanges(undefined, { note: 'x' }), { note: 'x' });
});

test('value comparison treats equal dates as unchanged and NaN as equal to itself', () => {
  const date = new Date(2026, 4, 17);
  assert.equal(valuesEqual(date, new Date(2026, 4, 17)), true);
  assert.equal(valuesEqual(date, new Date(2026, 4, 18)), false);
  assert.equal(valuesEqual(Number.NaN, Number.NaN), true);
  assert.equal(valuesEqual(null, undefined), false);
  assert.equal(valuesEqual(0, '0'), false);
  assert.deepEqual(diffChanges({ due: date }, { due: new Date(2026, 4, 17) }), {});
  assert.deepEqual(Object.keys(diffChanges({ due: date }, { due: new Date(2026, 4, 18) })), ['due']);
});

test('validation returns the first failing column in column order', () => {
  const columns = [
    { id: 'name', validate: (value) => (String(value).trim() === '' ? 'Name is required' : true) },
    { id: 'qty', validate: (value) => (value > 0 ? true : 'Quantity must be positive') }
  ];
  assert.equal(firstValidationError({ name: 'Alpha', qty: 3 }, columns, row), null);
  assert.deepEqual(
    firstValidationError({ name: 'Alpha', qty: 0 }, columns, row),
    { columnId: 'qty', message: 'Quantity must be positive' }
  );
  assert.deepEqual(
    firstValidationError({ name: '  ', qty: 0 }, columns, row),
    { columnId: 'name', message: 'Name is required' }
  );
});

test('validation short-circuits: no validator runs after the first rejection', () => {
  const calls = [];
  const columns = [
    { id: 'name', validate: () => { calls.push('name'); return 'nope'; } },
    { id: 'qty', validate: () => { calls.push('qty'); return true; } }
  ];
  firstValidationError({ name: 'Alpha', qty: 3 }, columns, row);
  assert.deepEqual(calls, ['name']);
});

test('validation skips columns without a validator or without an edited value', () => {
  const calls = [];
  const columns = [
    { id: 'name' },
    { id: 'qty', validate: () => { calls.push('qty'); return true; } },
    { id: 'missing', validate: () => { calls.push('missing'); return 'never'; } }
  ];
  assert.equal(firstValidationError({ name: 'Alpha', qty: 3 }, columns, row), null);
  assert.deepEqual(calls, ['qty']);
});

test('validation receives the edited value and the row, and passes on any non-string result', () => {
  const seen = [];
  const columns = [{ id: 'qty', validate: (value, candidate) => { seen.push([value, candidate]); return true; } }];
  assert.equal(firstValidationError({ qty: 9 }, columns, row), null);
  assert.deepEqual(seen, [[9, row]]);
  assert.equal(firstValidationError({ qty: 9 }, [{ id: 'qty', validate: () => undefined }], row), null);
  assert.equal(firstValidationError({ qty: 9 }, [{ id: 'qty', validate: () => true }], row), null);
});

test('a validator returning false rejects with the fallback message', () => {
  const columns = [{ id: 'qty', validate: () => false }];
  assert.deepEqual(firstValidationError({ qty: 1 }, columns, row), { columnId: 'qty', message: 'Invalid value' });
  assert.deepEqual(firstValidationError({ qty: 1 }, columns, row, 'Nope'), { columnId: 'qty', message: 'Nope' });
});

test('validation tolerates missing columns and values', () => {
  assert.equal(firstValidationError({}, [], row), null);
  assert.equal(firstValidationError(undefined, undefined, row), null);
  assert.equal(firstValidationError({ qty: 1 }, [null, undefined], row), null);
});

test('parse and format round-trip a value through a text editor', () => {
  const column = {
    id: 'amount',
    format: (value) => `${Number(value).toFixed(2)} €`,
    parse: (raw) => Number(String(raw).replace(/[^\d.-]/g, ''))
  };
  const text = formatCellValue(column, 1234.5, row);
  assert.equal(text, '1234.50 €');
  assert.equal(parseCellValue(column, text, row), 1234.5);
  assert.equal(parseCellValue(column, '99 €', row), 99);
});

test('format and parse fall back to String() and identity', () => {
  assert.equal(formatCellValue({ id: 'name' }, 'Alpha', row), 'Alpha');
  assert.equal(formatCellValue({ id: 'qty' }, 3, row), '3');
  assert.equal(formatCellValue({ id: 'name' }, null, row), '');
  assert.equal(formatCellValue({ id: 'name' }, undefined, row), '');
  assert.equal(formatCellValue({ id: 'name', format: () => null }, 'Alpha', row), '');
  assert.equal(parseCellValue({ id: 'name' }, 'Alpha', row), 'Alpha');
  assert.equal(parseCellValue({ id: 'name', parse: null }, 'Alpha', row), 'Alpha');
});

test('format and parse see the row they belong to', () => {
  const column = {
    id: 'qty',
    format: (value, candidate) => `${value}/${candidate.id}`,
    parse: (raw, candidate) => `${raw}#${candidate.id}`
  };
  assert.equal(formatCellValue(column, 3, row), '3/1');
  assert.equal(parseCellValue(column, 'x', row), 'x#1');
});

test('select options accept arrays, maps, and row callbacks', () => {
  assert.deepEqual(
    normalizeEditorOptions([{ value: 1, label: 'One' }, { value: 2, label: 'Two' }], row),
    [{ value: 1, label: 'One' }, { value: 2, label: 'Two' }]
  );
  assert.deepEqual(
    normalizeEditorOptions({ a: 'Alpha', b: 'Beta' }, row),
    [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]
  );
  assert.deepEqual(
    normalizeEditorOptions((candidate) => [{ value: candidate.id, label: candidate.name }], row),
    [{ value: 1, label: 'Alpha' }]
  );
});

test('select options tolerate primitives, missing labels, and empty sources', () => {
  assert.deepEqual(normalizeEditorOptions(['a', 'b'], row), [
    { value: 'a', label: 'a' },
    { value: 'b', label: 'b' }
  ]);
  assert.deepEqual(normalizeEditorOptions([{ value: 7 }], row), [{ value: 7, label: '7' }]);
  assert.deepEqual(normalizeEditorOptions(undefined, row), []);
  assert.deepEqual(normalizeEditorOptions(null, row), []);
  assert.deepEqual(normalizeEditorOptions('nonsense', row), []);
  assert.deepEqual(normalizeEditorOptions(() => null, row), []);
});

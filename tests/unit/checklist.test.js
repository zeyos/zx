import assert from 'node:assert/strict';
import test from 'node:test';

import { Checklist } from '../../src/components/checklist/checklist.js';

/*
 * setValues(), checkAll() and uncheckAll() take `{silent}`, as every other value setter does, so
 * the checklist field type and FilterPanel write a value without hearing it back as an edit. A
 * prototype probe holds the checked state the methods work on; rendering is stubbed out, and the
 * browser regressions (tests/regression/audit-inputs.js, tests/regression/followup-api.js) cover
 * the rendered list.
 */
const ITEMS = [{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }, { ID: 3, name: 'Three' }];

function checklistProbe(items = ITEMS) {
  const list = Object.create(Checklist.prototype);
  list.options = { ...Checklist.defaults };
  list._items = items.slice();
  list._visibleItems = items.slice();
  list._checked = new Set();
  list._pending = null;
  list._query = '';
  list._renderItems = () => {};
  list.emitted = [];
  list.emit = (type, detail) => { list.emitted.push([type, detail]); };
  return list;
}

test('Checklist setters still emit change without options', () => {
  const list = checklistProbe();
  list.setValues([1, 3]);
  list.checkAll();
  list.uncheckAll();
  assert.deepEqual(list.emitted, [
    ['change', { values: [1, 3] }],
    ['change', { values: [1, 2, 3] }],
    ['change', { values: [] }]
  ]);
});

test('Checklist setters with silent update the checked state and emit nothing', () => {
  const list = checklistProbe();
  assert.equal(list.setValues([2], { silent: true }), list);
  assert.deepEqual(list.getValues(), [2]);
  assert.equal(list.checkAll({ silent: true }), list);
  assert.deepEqual(list.getValues(), [1, 2, 3]);
  assert.equal(list.uncheckAll({ silent: true }), list);
  assert.deepEqual(list.getValues(), []);
  assert.deepEqual(list.emitted, []);

  // `silent: false` is the default spelled out.
  list.setValues([1], { silent: false });
  assert.deepEqual(list.emitted, [['change', { values: [1] }]]);
});

test('a silent value set before the items load is still checked once they arrive', () => {
  const list = checklistProbe([]);
  list.setValues([2, 3], { silent: true });
  assert.deepEqual(list.getValues(), [2, 3], 'the request stands while no item carries it');
  list._replaceItems([{ ID: 1, name: 'One', on: true }, { ID: 2, name: 'Two' }]);
  assert.deepEqual(list.getValues(), [2, 3], 'the arrived item is checked, the missing one still waits');
  list._replaceItems(ITEMS);
  assert.deepEqual(list.getValues(), [2, 3]);
  assert.equal(list._pending, null);
  assert.deepEqual(list.emitted, []);

  // A silent empty request before any item exists also stands in for the items' own flags.
  const empty = checklistProbe([]);
  empty.setValues([], { silent: true });
  empty._replaceItems([{ ID: 1, name: 'One', on: true }]);
  assert.deepEqual(empty.getValues(), []);
  assert.deepEqual(empty.emitted, []);
});

test('silent uncheckAll() drops a pending request, as the loud one does', () => {
  const list = checklistProbe([]);
  list.setValues([5], { silent: true });
  list.uncheckAll({ silent: true });
  assert.deepEqual(list.getValues(), []);
  list._replaceItems([{ ID: 5, name: 'Five', on: true }]);
  assert.deepEqual(list.getValues(), [5], 'with no request waiting, the items keep their own flags');
  assert.deepEqual(list.emitted, []);
});

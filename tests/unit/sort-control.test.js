import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSortValue, sortChoices } from '../../src/components/sort-control/sort-control.js';

const fields = [{id:'name',label:'Name'}, {id:'amount',label:'Amount'}];

test('sort choices contain each field once without direction permutations', () => {
  const choices = sortChoices(fields);
  assert.deepEqual(choices, fields);
  assert.equal(new Set(choices.map(item => item.id)).size, fields.length);
  choices[0].label = 'Changed';
  assert.equal(fields[0].label, 'Name');
  assert.deepEqual(sortChoices([]), []);
  assert.deepEqual(sortChoices([{id:'a\nasc',label:'A'}, {id:'a',label:'B'}]).map(item => item.id), ['a\nasc','a']);
});

test('sort state is defensive and rejects invalid fields and directions', () => {
  const value = {id:'amount',dir:'desc'};
  const result = normalizeSortValue(value, fields);
  result.id = 'name';
  assert.equal(value.id, 'amount');
  assert.deepEqual(normalizeSortValue(null, fields), {id:'name',dir:'asc'});
  assert.equal(normalizeSortValue(null, []), null);
  assert.throws(() => normalizeSortValue({id:'missing',dir:'asc'}, fields), /Unknown sort field/);
  assert.throws(() => normalizeSortValue({id:'name',dir:'sideways'}, fields), /Unknown sort direction/);
});
